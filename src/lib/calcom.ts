import { randomUUID } from "node:crypto";
import { env, logMode } from "./env";

// Cal.com API v2: GET /v2/slots (cal-api-version 2024-09-04), POST /v2/bookings (2026-02-25).
const API = "https://api.cal.com/v2";

export interface Booking {
  uid: string;
  start: string;
  link: string;
  mock: boolean;
}

function isMock() {
  const mock = !env("CAL_API_KEY") || !env("CAL_USERNAME");
  if (mock) logMode("calcom", "CAL_API_KEY/CAL_USERNAME not set: mock bookings");
  return mock;
}

const tz = () => env("CAL_TIMEZONE", "Asia/Kolkata");
const slug = () => env("CAL_EVENT_SLUG", "consultation");

function headers(version: string) {
  return { "content-type": "application/json", "cal-api-version": version, authorization: `Bearer ${env("CAL_API_KEY")}` };
}

/** Available start times (ISO) over the next `days` days. */
export async function getSlots(days = 7): Promise<string[]> {
  if (isMock()) {
    const t = new Date(Date.now() + 24 * 3600_000);
    t.setUTCHours(5, 30, 0, 0); // 11:00 IST tomorrow
    return [t.toISOString(), new Date(t.getTime() + 3 * 3600_000).toISOString()];
  }
  const start = new Date();
  const end = new Date(Date.now() + days * 24 * 3600_000);
  const qs = new URLSearchParams({
    start: start.toISOString(), end: end.toISOString(),
    username: env("CAL_USERNAME"), eventTypeSlug: slug(), timeZone: tz(),
  });
  const res = await fetch(`${API}/slots?${qs}`, { headers: headers("2024-09-04") });
  if (!res.ok) throw new Error(`Cal.com slots ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return Object.values(json.data as Record<string, { start: string }[]>).flat().map((s) => s.start);
}

/** The free slot closest to the caller's preference (or the first free slot if none given). */
export async function pickSlot(preferred: string | null): Promise<string | null> {
  const slots = await getSlots(14);
  const want = preferred ? new Date(preferred).getTime() : NaN;
  if (!slots.length || isNaN(want)) return slots[0] ?? null;
  return slots.reduce((best, s) =>
    Math.abs(new Date(s).getTime() - want) < Math.abs(new Date(best).getTime() - want) ? s : best);
}

/** Book a consultation. `start` = ISO time or "next_available". */
export async function bookConsultation(input: {
  start: string; name: string; email: string; phone?: string | null; notes?: Record<string, string>;
}): Promise<Booking> {
  const start = input.start === "next_available" ? (await getSlots())[0] : input.start;
  if (!start) throw new Error("No Cal.com slots available");

  if (isMock()) {
    const uid = `mock_${randomUUID().slice(0, 8)}`;
    return { uid, start, link: `https://cal.com/booking/${uid}`, mock: true };
  }

  const res = await fetch(`${API}/bookings`, {
    method: "POST",
    headers: headers("2026-02-25"),
    body: JSON.stringify({
      start: new Date(start).toISOString(),
      username: env("CAL_USERNAME"),
      eventTypeSlug: slug(),
      attendee: {
        name: input.name, email: input.email, timeZone: tz(),
        ...(input.phone ? { phoneNumber: input.phone } : {}),
      },
      metadata: { source: "ai-receptionist", ...(input.notes ?? {}) },
    }),
  });
  if (!res.ok) throw new Error(`Cal.com booking ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const { data } = await res.json();
  return { uid: data.uid, start: data.start, link: `https://cal.com/booking/${data.uid}`, mock: false };
}

/** When nothing was booked on the call: a prefilled link the designer can send the caller. */
export function prefilledBookingLink(name?: string | null): string {
  const user = env("CAL_USERNAME", "aangan-studio");
  const qs = name ? `?${new URLSearchParams({ name })}` : "";
  return `https://cal.com/${user}/${slug()}${qs}`;
}
