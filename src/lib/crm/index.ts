import { env, logMode } from "../env";
import { hubspotProvider } from "./hubspot";
import { mockCrmProvider } from "./mock";
import type { CrmProvider } from "./types";

/** Real HubSpot when HUBSPOT_ACCESS_TOKEN is set; otherwise mock (crm_mock table). */
export function crm(): CrmProvider {
  if (env("HUBSPOT_ACCESS_TOKEN")) return hubspotProvider;
  logMode("crm", "HUBSPOT_ACCESS_TOKEN not set: MOCK MODE ON (writing to crm_mock table)");
  return mockCrmProvider;
}
