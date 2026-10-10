/** Provider-neutral call record. WhatsApp / web-form adapters can produce the same shape later. */
export interface NormalizedCall {
  externalId: string;
  roomName?: string | null; // Vaani session id, used to find phone_number from call_started
  source: "vaani" | "mock" | "web";
  phone: string | null;
  startedAt: Date;
  durationSec: number | null;
  answerDelaySec: number | null;
  costInr: number | null; // null = estimate from duration
  transcript: string;
  recordingUrl?: string | null;
}

export type ParseResult =
  | { kind: "call"; call: NormalizedCall }
  | { kind: "ignored"; reason: string }
  | { kind: "rejected"; status: number; error: string };

export interface VoiceProvider {
  mode: "real" | "mock";
  /** Verify (if applicable) and normalize a raw webhook body. */
  parseWebhook(rawBody: string, headers: Headers, url?: string): ParseResult;
}
