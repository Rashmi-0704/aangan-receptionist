import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { requireEnv } from "./env";

let client: NeonQueryFunction<false, false> | null = null;

/** Server-only Neon Postgres client (HTTP driver, works on Vercel serverless). */
export function sql(): NeonQueryFunction<false, false> {
  if (!client) client = neon(requireEnv("DATABASE_URL"));
  return client;
}

export type CallStatus = "pending" | "qualified" | "unqualified" | "needs_review";

export interface CallRow {
  id: string;
  created_at: string | Date;
  external_call_id: string | null;
  source: string;
  caller_name: string | null;
  phone: string | null;
  area: string | null;
  company: string | null;
  space_type: string | null;
  size_sqft: number | null;
  budget_range: string | null;
  timeline: string | null;
  transcript: string | null;
  summary: string | null;
  status: CallStatus;
  reason: string | null;
  reason_category: string | null;
  after_hours: boolean;
  answer_delay_sec: number | null;
  call_duration_sec: number | null;
  call_cost_inr: number | string | null; // numeric columns come back as strings
  classifier_cost_inr: number | string | null;
  booking_link: string | null;
  booking_uid: string | null;
  assigned_designer: string | null;
  hubspot_id: string | null;
  email_sent_at: string | Date | null;
  pipeline_errors: string[];
}

// Columns the pipeline may update (guards the dynamic UPDATE below against injection).
const UPDATABLE = new Set([
  "caller_name", "phone", "area", "company", "space_type", "size_sqft", "budget_range", "timeline", "summary",
  "status", "reason", "reason_category", "classifier_cost_inr", "booking_link", "booking_uid",
  "assigned_designer", "hubspot_id", "email_sent_at", "pipeline_errors",
]);

export async function updateCall(id: string, patch: Partial<CallRow>): Promise<CallRow> {
  const keys = Object.keys(patch).filter((k) => UPDATABLE.has(k));
  if (keys.length === 0) return getCall(id);
  const values = keys.map((k) => {
    const v = patch[k as keyof CallRow];
    return k === "pipeline_errors" ? JSON.stringify(v) : v;
  });
  const set = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const rows = await sql().query(`update calls set ${set} where id = $1 returning *`, [id, ...values]);
  if (!rows[0]) throw new Error(`Call ${id} not found`);
  return rows[0] as CallRow;
}

export async function getCall(id: string): Promise<CallRow> {
  const rows = await sql()`select * from calls where id = ${id}`;
  if (!rows[0]) throw new Error(`Call ${id} not found`);
  return rows[0] as CallRow;
}
