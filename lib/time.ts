// Dhaka time helpers. Bangladesh is UTC+6 all year (no daylight saving).
const OFFSET_MS = 6 * 60 * 60 * 1000;

export function dhakaDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
}

/** Today's date in Dhaka as YYYY-MM-DD. */
export function dhakaToday(now = new Date()): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant when the given Dhaka date (YYYY-MM-DD) starts. */
export function dhakaDayStartUtc(date: string): Date {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - OFFSET_MS);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday-start week containing `date`, and first day of its month. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((day + 6) % 7));
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** MySQL DATETIME string (UTC) for a Date. */
export function sqlUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
