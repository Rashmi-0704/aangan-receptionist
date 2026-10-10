import { requireEnv } from "../env";
import { toContact, toDeal, type CrmProvider } from "./types";

const API = "https://api.hubapi.com";

async function hs(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${requireEnv("HUBSPOT_ACCESS_TOKEN")}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HubSpot ${method} ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export const hubspotProvider: CrmProvider = {
  mode: "real",
  async syncLead(call) {
    const contact = toContact(call);

    // Upsert by phone so repeat callers don't create duplicates.
    let contactId: string | null = null;
    if (contact.phone) {
      const found = await hs("/crm/v3/objects/contacts/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value: contact.phone }] }],
        limit: 1,
      });
      contactId = found.results?.[0]?.id ?? null;
    }
    if (contactId) {
      const { lifecyclestage: _keep, ...update } = contact; // don't move lifecycle backwards
      await hs(`/crm/v3/objects/contacts/${contactId}`, "PATCH", { properties: update });
    } else {
      contactId = (await hs("/crm/v3/objects/contacts", "POST", { properties: contact })).id as string;
    }

    if (call.status !== "qualified") return { contactId, dealId: null };

    const deal = await hs("/crm/v3/objects/deals", "POST", {
      properties: toDeal(call),
      // 3 = HubSpot-defined deal → contact association
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
    });
    return { contactId, dealId: deal.id as string };
  },
};
