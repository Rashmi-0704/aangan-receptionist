import { sql } from "./db";
import { env } from "./env";

export interface Designer { name: string; email: string }

export function designers(): Designer[] {
  return env("DESIGNERS")
    .split(",")
    .map((d) => d.trim().split(":"))
    .filter(([name, email]) => name && email)
    .map(([name, email]) => ({ name: name.trim(), email: email.trim() }));
}

/** Round-robin: the designer with the fewest qualified leads in the last 30 days. */
export async function pickDesigner(): Promise<Designer | null> {
  const list = designers();
  if (list.length === 0) return null;
  const rows = await sql()`
    select assigned_designer, count(*)::int as n from calls
    where status = 'qualified' and created_at >= now() - interval '30 days'
    group by assigned_designer`;
  const counts = new Map(rows.map((r) => [r.assigned_designer as string, r.n as number]));
  return [...list].sort((a, b) => (counts.get(a.name) ?? 0) - (counts.get(b.name) ?? 0))[0];
}
