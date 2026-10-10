import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { processCall, saveCall } from "@/lib/pipeline";
import { SAMPLES, sampleToCall, type SampleCall } from "@/lib/voice/mock";

export const runtime = "nodejs";
export const maxDuration = 60;

// Runs a sample call through the full flow synchronously:
// Database → Gemini → Cal.com → Resend → dashboard → HubSpot (or their mocks).
// Body: { "sample": "qualified" }  or  { "call": <SampleCall JSON> }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  let sample: SampleCall;
  if (body.call?.transcript) {
    sample = body.call;
  } else {
    const name = SAMPLES.includes(body.sample) ? body.sample : "qualified";
    sample = JSON.parse(await readFile(path.join(process.cwd(), "samples", `${name}.json`), "utf8"));
  }

  try {
    const { row } = await saveCall(sampleToCall(sample));
    const result = await processCall(row.id);
    return NextResponse.json({
      ok: true,
      id: result.id,
      status: result.status,
      reason: result.reason,
      designer: result.assigned_designer,
      booking_link: result.booking_link,
      hubspot_id: result.hubspot_id,
      errors: result.pipeline_errors,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
