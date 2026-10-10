import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { processCall, saveCall } from "@/lib/pipeline";
import { toTranscript, type Turn } from "@/lib/talk";

export const runtime = "nodejs";
export const maxDuration = 60;

// Ends a browser voice call and runs it through the same pipeline as a phone call.
// Body: { turns: Turn[], startedAt: ISO string, phone?: string }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const turns: Turn[] = Array.isArray(body.turns) ? body.turns : [];
  if (!turns.some((t) => t.role === "caller")) {
    return NextResponse.json({ ok: false, error: "Nothing was said on the call." }, { status: 400 });
  }
  const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
  try {
    const { row } = await saveCall({
      externalId: `web_${randomUUID()}`,
      source: "web",
      phone: null, // taken from what the caller says (classifier extracts callback_phone)
      startedAt,
      durationSec: Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000)),
      answerDelaySec: 0,
      costInr: 0, // browser speech + Gemini free tier
      transcript: toTranscript(turns),
    });
    const result = await processCall(row.id);
    return NextResponse.json({
      ok: true,
      status: result.status,
      reason: result.reason,
      designer: result.assigned_designer,
      booking: !!result.booking_uid,
      errors: result.pipeline_errors,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
