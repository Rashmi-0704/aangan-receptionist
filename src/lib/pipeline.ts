import { bookConsultation, pickSlot, prefilledBookingLink, type Booking } from "./calcom";
import { classifyTranscript, type Classification } from "./classify";
import { crm } from "./crm";
import { pickDesigner } from "./designers";
import { sendDesignerEmail } from "./email";
import { env, numEnv } from "./env";
import { getCall, sql, updateCall as update, type CallRow } from "./db";
import { isAfterHours } from "./time";
import type { NormalizedCall } from "./voice";

// Flow: save → classify → (qualified: booking + designer email) → CRM. The dashboard reads the database.
// Each step records its own failure in pipeline_errors; a failing step never drops the call (hard rule #4).

/** Step 1: store the call immediately. Idempotent on external_call_id (webhook retries). */
export async function saveCall(call: NormalizedCall): Promise<{ row: CallRow; duplicate: boolean }> {
  const costInr = call.costInr ?? ((call.durationSec ?? 0) / 60) * numEnv("VAANI_COST_PER_MIN_INR", 6);
  const inserted = await sql()`
    insert into calls (external_call_id, source, created_at, phone, transcript, after_hours,
                       answer_delay_sec, call_duration_sec, call_cost_inr, status)
    values (${call.externalId}, ${call.source}, ${call.startedAt.toISOString()}, ${call.phone}, ${call.transcript},
            ${isAfterHours(call.startedAt)}, ${call.answerDelaySec}, ${call.durationSec},
            ${Math.round(costInr * 100) / 100}, 'pending')
    on conflict (external_call_id) do nothing
    returning *`;
  if (inserted[0]) return { row: inserted[0] as CallRow, duplicate: false };

  const existing = await sql()`select * from calls where external_call_id = ${call.externalId}`;
  return { row: existing[0] as CallRow, duplicate: true };
}

/** Missing, or masked like "+91******1234" / "98XXXXXX12". */
function isMasked(phone: string | null): boolean {
  return !phone || /[*xX•#]/.test(phone);
}

/** "98000 00001" → "+919800000001"; leaves anything else as spoken. */
function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return p.trim();
}

/** Bookings made mid-call by the agent's tool are stored here and matched by phone. */
export async function recordBooking(b: Booking, phone: string | null, externalCallId?: string) {
  await sql()`
    insert into bookings (phone, external_call_id, booking_uid, start_time, booking_link, mock)
    values (${phone}, ${externalCallId ?? null}, ${b.uid}, ${b.start}, ${b.link}, ${b.mock})`;
}

/** A booking made during this call: same call id, or same phone and made after the call started. */
async function findCallBooking(call: CallRow) {
  const rows = await sql()`
    select booking_uid, booking_link, start_time from bookings
    where (external_call_id is not null and external_call_id = ${call.external_call_id})
       or (${call.phone}::text is not null and phone = ${call.phone}
           and created_at >= ${new Date(call.created_at).toISOString()}::timestamptz - interval '1 minute'
           and created_at <= now())
    order by created_at desc limit 1`;
  return (rows[0] ?? null) as { booking_uid: string; booking_link: string; start_time: string | Date } | null;
}

/** Steps 2–5. Safe to re-run for a call stuck in pending / needs_review. */
export async function processCall(id: string, priorErrors: string[] = []): Promise<CallRow> {
  const errors: string[] = [...priorErrors];
  const fail = (step: string, e: unknown) => {
    const msg = `${step}: ${e instanceof Error ? e.message : String(e)}`;
    console.error(`[pipeline ${id}] ${msg}`);
    errors.push(msg);
  };

  let call = await getCall(id);
  let cls: Classification | null = null;

  // 2. Classify
  try {
    const { result, costInr } = await classifyTranscript(call.transcript ?? "", new Date(call.created_at));
    cls = result;
    call = await update(id, {
      status: result.status, reason: result.reason, reason_category: result.reason_category, summary: result.summary,
      caller_name: result.caller_name, area: result.area, company: result.company,
      // Vaani masks caller ID in webhooks; fall back to the number the caller said on the call.
      ...(isMasked(call.phone) && result.callback_phone ? { phone: normalizePhone(result.callback_phone) } : {}),
      space_type: result.space_type, size_sqft: result.size_sqft,
      budget_range: result.budget_range, timeline: result.timeline,
      classifier_cost_inr: Math.round(costInr * 10000) / 10000,
    });
  } catch (e) {
    fail("classify", e);
    call = await update(id, { status: "needs_review", reason: "Classifier failed — review transcript manually" });
  }

  // 3. Qualified + caller agreed: book the slot closest to their preference (Vaani can't book mid-call)
  if (call.status === "qualified" && cls?.wants_consultation && cls.email && !(await findCallBooking(call))) {
    try {
      // Sample emails (example.com) are rejected by Cal.com; TEST_BOOKING_EMAIL routes simulated calls to a real inbox.
      const email = call.source === "mock" ? env("TEST_BOOKING_EMAIL", cls.email) : cls.email;
      const start = await pickSlot(cls.preferred_start);
      if (!start) throw new Error("No free Cal.com slots in the next 14 days");
      const b = await bookConsultation({ start, name: call.caller_name ?? "Caller", email, phone: call.phone });
      await recordBooking(b, call.phone, call.external_call_id ?? undefined);
    } catch (e) {
      fail("booking", e);
    }
  }

  // 4. Qualified: designer handoff (with the booking, or a prefilled link to send the caller)
  if (call.status === "qualified") {
    try {
      const designer = await pickDesigner();
      const booking = await findCallBooking(call);
      call = await update(id, {
        assigned_designer: designer?.name ?? null,
        booking_uid: booking?.booking_uid ?? null,
        booking_link: booking?.booking_link ?? prefilledBookingLink(call.caller_name),
      });
      if (designer) {
        if (await sendDesignerEmail(call, designer, booking?.start_time ?? null)) {
          call = await update(id, { email_sent_at: new Date().toISOString() });
        }
      } else {
        fail("assign", "DESIGNERS is empty");
      }
    } catch (e) {
      fail("handoff", e);
    }
  }

  // 5. CRM: every lead (qualified, unqualified, needs_review) becomes a contact
  try {
    const { contactId, dealId } = await crm().syncLead(call);
    call = await update(id, { hubspot_id: dealId ? `${contactId} deal:${dealId}` : contactId });
  } catch (e) {
    fail("crm", e);
  }

  if (errors.length) call = await update(id, { pipeline_errors: errors });
  return call;
}
