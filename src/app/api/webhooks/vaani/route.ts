import { after, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { processCall, saveCall } from "@/lib/pipeline";
import { voice } from "@/lib/voice";

export const runtime = "nodejs";
export const maxDuration = 60;

// Agent webhook from Vaani (one URL receives every event: call_started, call_ended,
// call_postprocessing, ...). Responds fast, then classifies / books / emails / syncs CRM via after().
export async function POST(req: Request) {
  const raw = await req.text();
  const parsed = voice().parseWebhook(raw, req.headers, req.url);

  if (parsed.kind === "rejected") return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  // Keep every authenticated payload: lets us inspect the real format and recover phone_number
  // from call_started (call_postprocessing doesn't carry it).
  let eventType: string | null = null;
  try {
    const body = JSON.parse(raw);
    eventType = body.event ?? body.type ?? null;
    await sql()`insert into webhook_events (event_type, payload) values (${eventType}, ${raw}::jsonb)`;
  } catch (e) {
    console.error("[webhook] could not store raw event", e);
  }

  if (parsed.kind === "ignored") return NextResponse.json({ ok: true, ignored: parsed.reason });

  const call = parsed.call;
  if (!call.phone && call.roomName) {
    const rows = await sql()`
      select payload->>'phone_number' as phone from webhook_events
      where payload->>'room_name' = ${call.roomName} and payload->>'phone_number' is not null
      order by received_at desc limit 1`;
    call.phone = (rows[0]?.phone as string | undefined) ?? null;
  }

  const { row, duplicate } = await saveCall(call);
  if (!duplicate) {
    after(async () => {
      try {
        await processCall(row.id);
      } catch (e) {
        console.error(`[webhook] processing ${row.id} failed`, e);
      }
    });
  }
  return NextResponse.json({ ok: true, id: row.id, duplicate });
}
