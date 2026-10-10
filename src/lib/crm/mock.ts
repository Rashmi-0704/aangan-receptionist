import { sql } from "../db";
import { toContact, toDeal, type CrmProvider } from "./types";

/** Writes the would-be HubSpot contact/deal into the `crm_mock` table for inspection. */
export const mockCrmProvider: CrmProvider = {
  mode: "mock",
  async syncLead(call) {
    const [contact] = await sql()`
      insert into crm_mock (call_id, object_type, payload)
      values (${call.id}, 'contact', ${JSON.stringify({ properties: toContact(call) })})
      returning id`;
    if (call.status !== "qualified") return { contactId: `mock:${contact.id}`, dealId: null };

    const [deal] = await sql()`
      insert into crm_mock (call_id, object_type, payload)
      values (${call.id}, 'deal', ${JSON.stringify({ properties: toDeal(call), associations: ["contact"] })})
      returning id`;
    return { contactId: `mock:${contact.id}`, dealId: `mock:${deal.id}` };
  },
};
