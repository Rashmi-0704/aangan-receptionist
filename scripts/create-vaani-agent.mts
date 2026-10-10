// Creates the Aangan receptionist agent in Vaani (app.vaanivoice.ai) with our prompt and consent greeting.
// Usage: node --env-file=.env.local --experimental-strip-types scripts/create-vaani-agent.mts
// Voice and LLM are left at Vaani's defaults — pick them in the Vaani dashboard (Voice Lab).
import { readFileSync } from "node:fs";
import { buildAgentPrompt, CONSENT_GREETING } from "../src/lib/voice/agent-prompt.ts";

const key = process.env.VAANI_API_KEY;
if (!key) throw new Error("VAANI_API_KEY missing");

const read = (f: string) => readFileSync(new URL(`../seed/${f}`, import.meta.url), "utf8");
const body = {
  agent_display_name: "Aangan Studio Receptionist",
  config: {
    persona: {
      identity: {
        system_prompt: buildAgentPrompt(read("services.md"), read("qualified.md")),
        personality: { tone: "warm, polite, concise" },
        greeting_message: {
          agent_message: CONSENT_GREETING,
          agent_speech_delay: 1,
          user_speech_delay: 1,
          interruptible: false, // the recording notice must be heard in full
          let_user_speak_first: false,
        },
      },
      senses_capabilities: { language: "en", auto_detect: true }, // caller may switch to Hindi/Marathi
    },
  },
};

const res = await fetch("https://api.vaanivoice.ai/api/create-agent", {
  method: "POST",
  headers: { "X-API-Key": key, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log(res.status, await res.text());
