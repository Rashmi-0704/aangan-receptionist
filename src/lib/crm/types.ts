import type { CallRow } from "../db";

export interface ContactPayload {
  firstname: string;
  lastname: string;
  phone: string;
  company: string;
  city: string;
  lifecyclestage: string;
}

export interface DealPayload {
  dealname: string;
  pipeline: string;
  dealstage: string;
  description: string;
}

export interface CrmProvider {
  mode: "real" | "mock";
  /** Every lead becomes a contact; qualified leads also get a deal. Returns the contact id. */
  syncLead(call: CallRow): Promise<{ contactId: string; dealId: string | null }>;
}

export function toContact(call: CallRow): ContactPayload {
  const [first, ...rest] = (call.caller_name ?? "Unknown caller").trim().split(/\s+/);
  return {
    firstname: first,
    lastname: rest.join(" "),
    phone: call.phone ?? "",
    company: call.company ?? "",
    city: call.area ?? "",
    lifecyclestage: "lead",
  };
}

export function toDeal(call: CallRow): DealPayload {
  return {
    dealname: `${call.caller_name ?? "Caller"} — ${call.space_type ?? "Interior"}${call.area ? `, ${call.area}` : ""}`,
    pipeline: "default",
    dealstage: call.booking_uid ? "appointmentscheduled" : "qualifiedtobuy",
    description: [
      call.summary,
      `Size: ${call.size_sqft ?? "?"} sq ft · Budget: ${call.budget_range ?? "?"} · Timeline: ${call.timeline ?? "?"}`,
      `Designer: ${call.assigned_designer ?? "unassigned"} · Booking: ${call.booking_link ?? "none"}`,
    ].join("\n"),
  };
}
