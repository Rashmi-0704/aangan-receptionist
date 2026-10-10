import { randomUUID } from "node:crypto";
import { todayAtIst } from "../time";
import type { NormalizedCall, ParseResult, VoiceProvider } from "./types";

/** Files in /samples (without .json). */
export const SAMPLES = ["qualified", "unqualified", "pricing-ask", "after-hours"];

/** Shape of the files in /samples. */
export interface SampleCall {
  label?: string;
  from?: string;
  ist_time?: string; // "HH:MM" today in IST; default = now
  duration_sec?: number;
  answer_delay_sec?: number;
  cost_inr?: number;
  transcript: string;
}

export function sampleToCall(s: SampleCall): NormalizedCall {
  return {
    externalId: `mock_${randomUUID()}`,
    source: "mock",
    phone: s.from ?? null,
    startedAt: s.ist_time ? todayAtIst(s.ist_time) : new Date(),
    durationSec: s.duration_sec ?? null,
    answerDelaySec: s.answer_delay_sec ?? null,
    costInr: s.cost_inr ?? null,
    transcript: s.transcript,
  };
}

/** Mock mode: no signature check, body is a sample-call JSON. */
export const mockProvider: VoiceProvider = {
  mode: "mock",
  parseWebhook(rawBody): ParseResult {
    try {
      const s = JSON.parse(rawBody) as SampleCall;
      if (!s.transcript) return { kind: "rejected", status: 400, error: "transcript required" };
      return { kind: "call", call: sampleToCall(s) };
    } catch {
      return { kind: "rejected", status: 400, error: "invalid JSON" };
    }
  },
};
