import { readFileSync } from "node:fs";
import path from "node:path";

// Hard rule #1: pricing must never reach the agent or any caller-facing output.
// Only these files may be loaded; anything else (e.g. pricing.md) is refused.
const ALLOWED = ["services.md", "qualified.md"] as const;
type SeedFile = (typeof ALLOWED)[number];

export function loadSeed(file: SeedFile): string {
  if (!ALLOWED.includes(file) || /pric/i.test(file)) {
    throw new Error(`Refusing to load seed file "${file}"`);
  }
  return readFileSync(path.join(process.cwd(), "seed", file), "utf8");
}
