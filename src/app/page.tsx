import Link from "next/link";
import { env } from "@/lib/env";
import { getDashboard } from "@/lib/stats";
import { formatIst } from "@/lib/time";
import { SAMPLES } from "@/lib/voice/mock";
import { BackgroundSlideshow } from "./background-slideshow";
import { SimulateCall } from "./simulate-call";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: n < 100 ? 2 : 0 })}`;
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
const label = (s: string) => s.replace(/_/g, " ");
const STATUS_LABEL: Record<string, string> = {
  qualified: "Qualified", unqualified: "Unqualified", needs_review: "Needs review", pending: "Processing",
};

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
const today = () =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(new Date());

function BarList({ rows, empty }: { rows: [string, number][]; empty: string }) {
  if (!rows.length) return <p className="empty">{empty}</p>;
  const max = Math.max(...rows.map(([, n]) => n));
  return (
    <ul className="bars">
      {rows.map(([name, n]) => (
        <li key={name} title={`${label(name)}: ${n}`}>
          <span className="name">{label(name)}</span>
          <span className="val">{n}</span>
          <span className="track"><span className="fill" style={{ width: `${(n / max) * 100}%` }} /></span>
        </li>
      ))}
    </ul>
  );
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden="true">A</div>
      <div>
        <div className="brand-name">Aangan Studio</div>
        <div className="brand-tag">AI Receptionist</div>
      </div>
    </div>
  );
}

/** Minimal page frame for the error state. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BackgroundSlideshow />
      <main className="shell">
        <header className="topbar"><Brand /></header>
        {children}
      </main>
    </>
  );
}

export default async function Dashboard() {
  let d: Awaited<ReturnType<typeof getDashboard>>;
  try {
    d = await getDashboard();
  } catch (e) {
    return (
      <Shell>
        <div className="glass error-card">
          <h2 style={{ fontFamily: "var(--font-display)", margin: "0 0 6px" }}>Couldn&apos;t load call data</h2>
          <p style={{ margin: 0, color: "var(--text-2)" }}>
            {e instanceof Error ? e.message : String(e)}. Check DATABASE_URL and run db/schema.sql.
          </p>
        </div>
      </Shell>
    );
  }

  const integrations = [
    { name: "Voice", live: !!env("VAANI_API_KEY"), off: "mock" },
    { name: "Classifier", live: !!env("GEMINI_API_KEY"), off: "missing" },
    { name: "Calendar", live: !!env("CAL_API_KEY"), off: "mock" },
    { name: "Email", live: !!env("RESEND_API_KEY"), off: "off" },
    { name: "CRM", live: !!env("HUBSPOT_ACCESS_TOKEN"), off: "mock" },
  ];

  const classified = d.qualified + d.unqualified + d.needsReview;
  const share = (n: number) => (classified ? n / classified : 0);
  const segments = [
    { key: "q", label: "Qualified", n: d.qualified, color: "var(--s-qualified)" },
    { key: "u", label: "Unqualified", n: d.unqualified, color: "var(--s-unqualified)" },
    { key: "r", label: "Needs review", n: d.needsReview, color: "var(--s-review)" },
  ];

  return (
    <>
      <BackgroundSlideshow />
      <main className="shell">
        <header className="topbar">
          <Brand />
          <div className="topbar-right">
            <div className="chips" aria-label="Integrations">
              {integrations.map((i) => (
                <span key={i.name} className={`chip${i.live ? " live" : ""}`}>
                  <span className="dot" aria-hidden="true" />
                  {i.name} <span className="state">{i.live ? "live" : i.off}</span>
                </span>
              ))}
            </div>
            <Link href="/talk" className="talk-link">🎙 Talk to receptionist</Link>
            <SimulateCall samples={SAMPLES} />
          </div>
        </header>

        <section className="glass hero" aria-label="Calls overview">
          <div>
            <div className="eyebrow">{greeting()} · {today()}</div>
            <div className="hero-number">{d.month}</div>
            <div className="hero-label">calls answered this month</div>
            <div className="hero-meta"><b>{d.today}</b> today · <b>{d.week}</b> this week</div>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="v">{pct(d.afterHoursShare)}</div>
              <div className="k">after office hours</div>
            </div>
            <div className="hero-stat">
              <div className="v">{pct(d.answeredWithin5Min)}</div>
              <div className="k">answered within 5 min</div>
            </div>
            <div className="hero-stat">
              <div className="v">{classified ? pct(share(d.qualified)) : "—"}</div>
              <div className="k">became qualified leads</div>
            </div>
          </div>
        </section>

        <div className="grid-2">
          <section className="glass panel" aria-label="Lead quality">
            <h2>Lead quality</h2>
            <p className="sub">This month, {classified} classified call{classified === 1 ? "" : "s"}</p>
            <div className="seg" role="img" aria-label={segments.map((s) => `${s.label} ${s.n}`).join(", ")}>
              {segments.filter((s) => s.n > 0).map((s) => (
                <span key={s.key} className={s.key} style={{ flexGrow: s.n }} title={`${s.label}: ${s.n} (${pct(share(s.n))})`} />
              ))}
            </div>
            <div className="legend">
              {segments.map((s) => (
                <div key={s.key} className="legend-item">
                  <span className="lk"><span className="sw" style={{ background: s.color }} aria-hidden="true" />{s.label}</span>
                  <span className="lv">{s.n}</span>
                  <span className="lp">{classified ? pct(share(s.n)) : "—"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="glass panel" aria-label="Tool cost">
            <h2>Tool cost</h2>
            <p className="sub">This month, voice + classifier</p>
            <div className="costs">
              <div className="cost"><div className="v">{inr(d.totalCost)}</div><div className="k">total</div></div>
              <div className="cost"><div className="v">{inr(d.costPerCall)}</div><div className="k">per call</div></div>
              <div className="cost">
                <div className="v">{d.costPerQualified === null ? "—" : inr(d.costPerQualified)}</div>
                <div className="k">per qualified lead</div>
              </div>
            </div>
            <p className="note">Voice cost is estimated from call length until Vaani reports actual cost.</p>
          </section>
        </div>

        <div className="grid-2">
          <section className="glass panel" aria-label="Disqualification reasons">
            <h2>Why leads didn&apos;t qualify</h2>
            <BarList rows={d.topReasons} empty="No unqualified calls this month." />
          </section>
          <section className="glass panel" aria-label="Leads per designer">
            <h2>Qualified leads per designer</h2>
            <BarList rows={d.perDesigner} empty="No qualified leads assigned yet." />
          </section>
        </div>

        <section className="glass panel" style={{ marginTop: 16 }} aria-label="Recent calls">
          <h2>Recent calls</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>When</th><th>Caller</th><th>Company</th><th>Status</th><th>Designer</th><th className="num">Cost</th></tr>
              </thead>
              <tbody>
                {d.recent.map((c) => (
                  <tr key={c.id}>
                    <td className="dim">
                      {formatIst(c.created_at)}
                      {c.after_hours && <span className="tag">After hours</span>}
                    </td>
                    <td className="name">{c.caller_name ?? "Unknown caller"}</td>
                    <td className={c.company ? "" : "dim"}>{c.company ?? "—"}</td>
                    <td><span className={`pill ${c.status}`}>{STATUS_LABEL[c.status] ?? label(c.status)}</span></td>
                    <td className={c.assigned_designer ? "" : "dim"}>{c.assigned_designer ?? "—"}</td>
                    <td className="num">{inr(Number(c.call_cost_inr ?? 0) + Number(c.classifier_cost_inr ?? 0))}</td>
                  </tr>
                ))}
                {d.recent.length === 0 && (
                  <tr><td colSpan={6} className="dim">No calls yet. Try “Simulate call” above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer>
          Interior photography from <a href="https://unsplash.com" target="_blank" rel="noreferrer">Unsplash</a>
        </footer>
      </main>
    </>
  );
}
