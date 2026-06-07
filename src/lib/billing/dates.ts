/**
 * Pure date helpers for billing. No clock reads, callers pass the date in, so
 * renewal math is deterministic and testable. All UTC.
 */

/** Stripe period timestamps are unix SECONDS. Convert to an ISO string, or null. */
export function unixToIso(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Add `months` to a date-only string (`YYYY-MM-DD`) in UTC, clamping to the last
 * day of the target month when needed (31 Jan + 1mo → 28/29 Feb). Returns a
 * date-only string.
 */
export function addMonthsUTC(dateOnly: string, months: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const out = new Date(Date.UTC(targetYear, targetMonth, day));
  return out.toISOString().slice(0, 10);
}
