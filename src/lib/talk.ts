import { env, requireEnv } from "./env";
import { loadSeed } from "./seed";
import { buildAgentPrompt, CONSENT_GREETING } from "./voice/agent-prompt";

// Free browser voice receptionist: the browser does speech-to-text and text-to-speech
// (Web Speech API), Gemini plays the agent using the same prompt as the Vaani agent.

export interface Turn { role: "agent" | "caller"; text: string }

export const END_MARKER = "[END_CALL]";

function systemPrompt(): string {
  return `${buildAgentPrompt(loadSeed("services.md"), loadSeed("qualified.md"))}

## Voice-call style (this is a live spoken conversation)
- Reply in 1–2 short sentences, like a person on the phone. No lists, no markdown, no emojis.
- Ask one question at a time.
- When the conversation is complete and you have said goodbye, end your reply with ${END_MARKER}.`;
}

/** Next agent line given the conversation so far. */
export async function agentReply(turns: Turn[]): Promise<{ text: string; end: boolean }> {
  const model = env("GEMINI_MODEL", "gemini-3.8-flash");
  // Gemini expects the conversation to start with a user turn.
  const contents = [
    { role: "user", parts: [{ text: "(The phone call has connected.)" }] },
    ...turns.map((t) => ({ role: t.role === "agent" ? "model" : "user", parts: [{ text: t.text }] })),
  ];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": requireEnv("GEMINI_API_KEY") },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 300 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const raw: string = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const end = raw.includes(END_MARKER);
  return { text: raw.replace(END_MARKER, "").trim() || "Sorry, could you say that again?", end };
}

export function greeting(): string {
  return CONSENT_GREETING;
}

export function toTranscript(turns: Turn[]): string {
  return turns.map((t) => `${t.role === "agent" ? "Agent" : "Caller"}: ${t.text}`).join("\n");
}
