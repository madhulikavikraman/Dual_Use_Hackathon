// Formatting for the board. Pure functions; times render only after data arrives on the client.

const FRESH_MS = 15 * 60_000; // a last-seen fix is "fresh" under 15 minutes (PRD 11)

export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

/** "41,000" or "9.8 million": the dose preview reads as an estimate, not a census. */
export function fmtPeople(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} million`;
  if (n >= 10_000) return fmtInt(Math.round(n / 1000) * 1000);
  return fmtInt(n);
}

export const fmtArea = (sqMi: number) => (sqMi >= 100 ? fmtInt(sqMi) : sqMi.toFixed(1));

export const fmtUsd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const fmtPct = (n: number | null) => (n === null ? "—" : `${n}%`);

/** "3:41:05 AM" in the viewer's time zone. */
export const fmtClock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

export const fmtTime = (iso: string | null) => (iso ? fmtClock(Date.parse(iso)) : "—");

/** "12 s", "3 min", "1 h 4 min" */
export function fmtSpan(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Age of `iso` relative to the server's `now` (both from the same snapshot, so no clock skew). */
export function fmtAgo(iso: string | null, now: string): string {
  if (!iso) return "—";
  const d = Date.parse(now) - Date.parse(iso);
  return d < 5_000 ? "just now" : `${fmtSpan(d)} ago`;
}

export const isFresh = (iso: string, now: string) => Date.parse(now) - Date.parse(iso) < FRESH_MS;

/** "1:29" */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
