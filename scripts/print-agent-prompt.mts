// Prints the voice agent's system prompt so it can be pasted into Vaani Labs.
// Usage: npm run agent-prompt
import { readFileSync } from "node:fs";
import { buildAgentPrompt } from "../src/lib/voice/agent-prompt.ts";

const read = (f: string) => readFileSync(new URL(`../seed/${f}`, import.meta.url), "utf8");
console.log(buildAgentPrompt(read("services.md"), read("qualified.md")));
