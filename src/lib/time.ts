import { numEnv } from "./env";

const TZ = "Asia/Kolkata";

/** Hour (0-23) and weekday (0=Sun) of a timestamp in IST. */
function istParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "numeric", hourCycle: "h23", weekday: "short",
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  return { hour, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd) };
}

/** Outside office hours (default 10:00–19:00 IST), or Sunday. */
export function isAfterHours(d: Date): boolean {
  const { hour, weekday } = istParts(d);
  const open = numEnv("OFFICE_OPEN_HOUR", 10);
  const close = numEnv("OFFICE_CLOSE_HOUR", 19);
  return weekday === 0 || hour < open || hour >= close;
}

/** Today's date at a given IST "HH:MM", as a Date. Used by sample calls. */
export function todayAtIst(hhmm: string): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  return new Date(`${ymd}T${hhmm}:00+05:30`);
}

export function formatIst(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TZ, dateStyle: "medium", timeStyle: "short",
  }).format(new Date(iso));
}
