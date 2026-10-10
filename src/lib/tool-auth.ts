import { timingSafeEqual } from "node:crypto";
import { env } from "./env";

/** Mid-call tool endpoints are called by Vaani with a shared secret header. */
export function toolAuthorized(req: Request): boolean {
  const secret = env("VAANI_TOOL_SECRET");
  if (!secret) return !env("VAANI_API_KEY"); // open only while voice is in mock mode
  const got = Buffer.from(req.headers.get("x-tool-secret") ?? "");
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}
