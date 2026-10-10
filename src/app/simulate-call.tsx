"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const LABELS: Record<string, string> = {
  qualified: "Qualified lead",
  unqualified: "Unqualified lead",
  "pricing-ask": "Caller asks for pricing",
  "after-hours": "After-hours call",
};

export function SimulateCall({ samples }: { samples: string[] }) {
  const router = useRouter();
  const [sample, setSample] = useState(samples[0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/test-call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample }),
      });
      const j = await res.json();
      setResult(
        j.ok
          ? {
              ok: true,
              text: `${j.status === "qualified" ? "Qualified" : j.status === "unqualified" ? "Unqualified" : "Needs review"} — ${j.reason ?? ""}${j.designer ? ` · assigned to ${j.designer}` : ""}${j.errors?.length ? ` · ${j.errors.length} step(s) failed` : ""}`,
            }
          : { ok: false, text: j.error ?? "Something went wrong" },
      );
      router.refresh();
    } catch (e) {
      setResult({ ok: false, text: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="sim">
        <select value={sample} onChange={(e) => setSample(e.target.value)} aria-label="Sample call to simulate">
          {samples.map((s) => <option key={s} value={s}>{LABELS[s] ?? s}</option>)}
        </select>
        <button onClick={run} disabled={busy}>{busy ? "Simulating…" : "Simulate call"}</button>
      </div>
      {result && (
        <div className="toast glass" role="status">
          <b>{result.ok ? "Done" : "Failed"}</b>
          <span>{result.text}</span>
        </div>
      )}
    </div>
  );
}
