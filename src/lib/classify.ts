import { env, numEnv, requireEnv } from "./env";
import { loadSeed } from "./seed";

/** e.g. "Friday, 9 October 2026 at 12:22 pm" — the weekday lets Gemini resolve "Saturday morning". */
const callDate = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(d);

export interface Classification {
  status: "qualified" | "unqualified";
  reason: string; // one line
  reason_category: (typeof REASON_CATEGORIES)[number];
  summary: string;
  caller_name: string | null;
  callback_phone: string | null; // Vaani masks caller ID, so the agent asks for a number on the call
  area: string | null;
  company: string | null;
  space_type: string | null;
  size_sqft: number | null;
  budget_range: string | null;
  timeline: string | null;
  // Post-call booking (Vaani can't call Cal.com mid-call)
  wants_consultation: boolean;
  email: string | null;
  preferred_start: string | null; // ISO 8601 with +05:30
}

export const REASON_CATEGORIES = [
  "good_fit", "out_of_area", "too_small", "budget_too_low", "timeline_too_far", "not_a_lead", "insufficient_info", "other",
] as const;

const nullableString = { type: "STRING", nullable: true };
const SCHEMA = {
  type: "OBJECT",
  properties: {
    status: { type: "STRING", enum: ["qualified", "unqualified"] },
    reason: { type: "STRING", description: "One line explaining the decision" },
    reason_category: { type: "STRING", enum: [...REASON_CATEGORIES], description: "good_fit when qualified" },
    summary: { type: "STRING", description: "3-5 sentence summary for the designer" },
    caller_name: nullableString,
    callback_phone: { type: "STRING", nullable: true, description: "Phone number the caller gave, digits with country code if said, e.g. +919812345678" },
    area: nullableString,
    company: nullableString,
    space_type: nullableString,
    size_sqft: { type: "INTEGER", nullable: true },
    budget_range: nullableString,
    timeline: nullableString,
    wants_consultation: { type: "BOOLEAN", description: "Caller agreed to have a consultation booked" },
    email: { type: "STRING", nullable: true, description: "Email the caller gave, spelled out as an address" },
    preferred_start: {
      type: "STRING", nullable: true,
      description: "Caller's preferred consultation start as ISO 8601 in IST (+05:30), resolved against the call time; null if none given",
    },
  },
  required: ["status", "reason", "reason_category", "summary", "wants_consultation"],
};

/** Reads the transcript with Gemini Flash and returns the tag, extracted fields and cost in INR. */
export async function classifyTranscript(
  transcript: string, callTime: Date,
): Promise<{ result: Classification; costInr: number }> {
  const model = env("GEMINI_MODEL", "gemini-3.8-flash");
  const prompt = `You classify inbound phone enquiries for Aangan Studio, an interior design studio in Pune.

Qualification criteria:
${loadSeed("qualified.md")}

Read the call transcript. Extract the caller details (null when not mentioned) and tag the lead
"qualified" or "unqualified" with a one-line reason. Write a short summary a designer can read
before calling back, including anything the caller asked for (e.g. preferred callback time).
Do not include any prices or estimates of your own.

The call took place on ${callDate(callTime)} IST. Resolve relative times ("Saturday morning",
"tomorrow at 4") against that date; "morning" = 11:00, "afternoon" = 15:00, "evening" = 17:00.

Transcript:
"""
${transcript}
"""`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": requireEnv("GEMINI_API_KEY") },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const json = await res.json();
  const text: string | undefined = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");

  const usage = json.usageMetadata ?? {};
  const costInr =
    ((usage.promptTokenCount ?? 0) * numEnv("GEMINI_INPUT_COST_PER_M_INR", 25) +
      ((usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0)) * numEnv("GEMINI_OUTPUT_COST_PER_M_INR", 210)) /
    1_000_000;

  return { result: JSON.parse(text) as Classification, costInr };
}
