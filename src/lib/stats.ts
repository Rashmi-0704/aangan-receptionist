import { sql } from "./db";

// Dashboard columns only: phone numbers and transcripts are never selected here.
const COLUMNS =
  "id, created_at, caller_name, company, status, reason_category, after_hours, answer_delay_sec, call_cost_inr, classifier_cost_inr, assigned_designer";

export interface DashboardCall {
  id: string;
  created_at: string | Date;
  caller_name: string | null;
  company: string | null;
  status: string;
  reason_category: string | null;
  after_hours: boolean;
  answer_delay_sec: number | null;
  call_cost_inr: number | string | null; // numeric → string from Postgres
  classifier_cost_inr: number | string | null;
  assigned_designer: string | null;
}

const istDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d); // YYYY-MM-DD

function istStartOf(kind: "day" | "week" | "month"): Date {
  const today = istDay(new Date());
  const d = new Date(`${today}T00:00:00+05:30`);
  if (kind === "week") d.setTime(d.getTime() - ((new Date(`${today}T12:00:00+05:30`).getUTCDay() + 6) % 7) * 86400_000);
  if (kind === "month") return new Date(`${today.slice(0, 8)}01T00:00:00+05:30`);
  return d;
}

export async function getDashboard() {
  const dayStart = istStartOf("day");
  const weekStart = istStartOf("week");
  const monthStart = istStartOf("month");
  const since = weekStart < monthStart ? weekStart : monthStart;

  const all = (await sql().query(
    `select ${COLUMNS} from calls where created_at >= $1 order by created_at desc`,
    [since.toISOString()],
  )) as DashboardCall[];
  const month = all.filter((c) => new Date(c.created_at) >= monthStart);

  const count = (pred: (c: DashboardCall) => boolean) => month.filter(pred).length;
  const qualified = count((c) => c.status === "qualified");
  const timed = month.filter((c) => c.answer_delay_sec !== null);
  const cost = month.reduce((s, c) => s + Number(c.call_cost_inr ?? 0) + Number(c.classifier_cost_inr ?? 0), 0);

  const tally = (rows: DashboardCall[], key: (c: DashboardCall) => string | null) => {
    const m = new Map<string, number>();
    for (const r of rows) { const k = key(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  return {
    today: all.filter((c) => new Date(c.created_at) >= dayStart).length,
    week: all.filter((c) => new Date(c.created_at) >= weekStart).length,
    month: month.length,
    afterHoursShare: month.length ? count((c) => c.after_hours) / month.length : 0,
    answeredWithin5Min: timed.length ? timed.filter((c) => c.answer_delay_sec! <= 300).length / timed.length : null,
    qualified,
    unqualified: count((c) => c.status === "unqualified"),
    needsReview: count((c) => c.status === "needs_review" || c.status === "pending"),
    topReasons: tally(month.filter((c) => c.status === "unqualified"), (c) => c.reason_category ?? "other").slice(0, 5),
    perDesigner: tally(month.filter((c) => c.status === "qualified"), (c) => c.assigned_designer ?? "Unassigned"),
    totalCost: cost,
    costPerCall: month.length ? cost / month.length : 0,
    costPerQualified: qualified ? cost / qualified : null,
    recent: all.slice(0, 25),
  };
}
