// Central access to environment variables. No secrets live in code.

export function env(name: string, fallback = ""): string {
  return (process.env[name] ?? "").trim() || fallback;
}

export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export function numEnv(name: string, fallback: number): number {
  const n = Number(env(name));
  return Number.isFinite(n) && env(name) !== "" ? n : fallback;
}

const warned = new Set<string>();
/** Log a mock/skip notice once per server instance so logs stay readable. */
export function logMode(integration: string, message: string) {
  if (warned.has(integration)) return;
  warned.add(integration);
  console.warn(`[${integration}] ${message}`);
}
