import { env, logMode } from "../env";
import { mockProvider } from "./mock";
import type { VoiceProvider } from "./types";
import { vaaniProvider } from "./vaani";

export type { NormalizedCall, VoiceProvider } from "./types";

/** Real Vaani adapter when VAANI_API_KEY is set; otherwise mock. Switching needs only .env. */
export function voice(): VoiceProvider {
  if (env("VAANI_API_KEY")) {
    if (!env("VAANI_WEBHOOK_SECRET")) throw new Error("VAANI_WEBHOOK_SECRET is required when VAANI_API_KEY is set");
    return vaaniProvider;
  }
  logMode("voice", "VAANI_API_KEY not set: MOCK MODE ON (webhook accepts sample-call JSON, no signature check)");
  return mockProvider;
}
