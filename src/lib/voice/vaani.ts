import { timingSafeEqual } from "node:crypto";
import { requireEnv } from "../env";
import type { NormalizedCall, ParseResult, VoiceProvider } from "./types";

// Vaani agent webhooks (https://docs.vaanivoice.ai/guides/webhook-setup.md).
// Events: call_started { room_name, phone_number }, call_ended { call_duration (seconds) },
//         call_postprocessing { call_id, timestamp, data: { room_name, call_duration (ms), summary,
//                                entities, dispositions, recording_url, transcript } }
// We process call_postprocessing (it has the transcript). Other events are stored raw by the
// route so the caller's phone_number from call_started can be matched by room_name.
//
// Vaani documents no signature header, so the webhook URL carries a secret:
//   https://<app>/api/webhooks/vaani?token=<VAANI_WEBHOOK_SECRET>

type Obj = Record<string, unknown>;

const num = (v: unknown) => (v === undefined || v === null || isNaN(Number(v)) ? null : Number(v));
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function tokenOk(url: string): boolean {
  const got = Buffer.from(new URL(url).searchParams.get("token") ?? "");
  const want = Buffer.from(requireEnv("VAANI_WEBHOOK_SECRET"));
  return got.length === want.length && timingSafeEqual(got, want);
}

export const vaaniProvider: VoiceProvider = {
  mode: "real",
  parseWebhook(rawBody, _headers, url): ParseResult {
    if (!url || !tokenOk(url)) return { kind: "rejected", status: 401, error: "invalid token" };

    let evt: Obj;
    try {
      evt = JSON.parse(rawBody);
    } catch {
      return { kind: "rejected", status: 400, error: "invalid JSON" };
    }
    if (evt.event !== "call_postprocessing") return { kind: "ignored", reason: `event ${String(evt.event)}` };

    const d = (evt.data ?? {}) as Obj;
    const durationMs = num(d.call_duration); // milliseconds in this event
    const endedAt = str(evt.timestamp) ? new Date(String(evt.timestamp)) : new Date();
    const durationSec = durationMs === null ? null : Math.round(durationMs / 1000);

    const call: NormalizedCall = {
      externalId: String(evt.call_id ?? d.call_id ?? d.room_name),
      roomName: str(d.room_name),
      source: "vaani",
      phone: str(d.phone_number), // usually absent here; route backfills from call_started
      startedAt: durationSec === null ? endedAt : new Date(endedAt.getTime() - durationSec * 1000),
      durationSec,
      answerDelaySec: null, // Vaani picks up immediately; not reported
      costInr: null, // not in payload; estimated from duration (VAANI_COST_PER_MIN_INR)
      transcript: str(d.transcript) ?? "",
      recordingUrl: str(d.recording_url),
    };
    return { kind: "call", call };
  },
};
