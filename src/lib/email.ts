import type { CallRow } from "./db";
import type { Designer } from "./designers";
import { env, logMode, requireEnv } from "./env";
import { formatIst } from "./time";

const esc = (s: unknown) =>
  String(s ?? "—").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Designer handoff email (internal only — never sent to the caller). */
export function designerEmailHtml(call: CallRow, designer: Designer, bookedAt: string | Date | null): string {
  const rows: [string, unknown][] = [
    ["Name", call.caller_name], ["Phone", call.phone], ["Area", call.area], ["Company", call.company],
    ["Space", call.space_type], ["Size", call.size_sqft ? `${call.size_sqft} sq ft` : null],
    ["Budget", call.budget_range], ["Timeline", call.timeline],
    ["Called at", `${formatIst(call.created_at)}${call.after_hours ? " (after hours)" : ""}`],
  ];
  return `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#222">
  <h2 style="margin:0 0 4px">New qualified lead: ${esc(call.caller_name)}</h2>
  <p style="margin:0 0 16px;color:#666">Assigned to ${esc(designer.name)} · ${esc(call.reason)}</p>
  <h3 style="margin:16px 0 4px">Summary</h3>
  <p style="margin:0">${esc(call.summary)}</p>
  <h3 style="margin:16px 0 4px">Caller details</h3>
  <table style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`)
    .join("")}</table>
  <h3 style="margin:16px 0 4px">Consultation</h3>
  <p style="margin:0">${
    bookedAt
      ? `Booked for <b>${esc(formatIst(bookedAt))}</b>. <a href="${esc(call.booking_link)}">View booking</a>`
      : `Not booked on the call. Send the caller this link: <a href="${esc(call.booking_link)}">${esc(call.booking_link)}</a>`
  }</p>
  <p style="margin:16px 0 0;color:#999;font-size:12px">The caller has not been quoted any price. Full transcript is in the dashboard.</p>
</div>`;
}

/** Returns true if sent, false if skipped (no key). */
export async function sendDesignerEmail(call: CallRow, designer: Designer, bookedAt: string | Date | null): Promise<boolean> {
  if (!env("RESEND_API_KEY")) {
    logMode("resend", "RESEND_API_KEY not set: designer emails are skipped (logged only)");
    console.info(`[resend] would email ${designer.email}: lead ${call.caller_name}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${requireEnv("RESEND_API_KEY")}` },
    body: JSON.stringify({
      from: requireEnv("RESEND_FROM"),
      to: [designer.email],
      subject: `New lead: ${call.caller_name ?? "Unknown"} · ${call.space_type ?? ""} ${call.area ? `in ${call.area}` : ""}`.trim(),
      html: designerEmailHtml(call, designer, bookedAt),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return true;
}
