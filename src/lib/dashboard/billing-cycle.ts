/**
 * Billing-cycle (month) windowing for the tenant dashboard.
 *
 * The meter resets per UTC calendar month (record_voice_call uses
 * date_trunc('month', now())), so a "billing cycle" here is one UTC month. The
 * dashboard defaults to the current cycle; the cycle picker lets a tenant view a
 * past month, and every windowed data layer re-scopes its `calls` query to that
 * month's [startIso, endIso) bounds and its pool counter to `periodStart`.
 *
 * Pure + isomorphic: the server pages resolve a cycle from the URL, the client
 * picker lists selectable cycles. No server-only imports here.
 */

export interface CycleWindow {
  /** "YYYY-MM" (UTC) — the URL/`?cycle=` key. */
  key: string;
  /** "June 2026". */
  label: string;
  /** ISO start of the month (inclusive). */
  startIso: string;
  /** ISO start of the NEXT month (exclusive upper bound). */
  endIso: string;
  /** "YYYY-MM-01" — matches usage_counters.period_start. */
  periodStart: string;
  /** True when this is the live, in-progress cycle. */
  isCurrent: boolean;
  /** Days the window covers: elapsed-so-far for the current cycle, full month for a past one. Drives day-by-day trends. */
  days: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const KEY_RE = /^\d{4}-\d{2}$/;

const keyFor = (y: number, m0: number) => `${y}-${pad(m0 + 1)}`;
const labelFor = (d: Date) => d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** "YYYY-MM" for the cycle containing `now` (UTC). */
export function currentCycleKey(now: Date = new Date()): string {
  return keyFor(now.getUTCFullYear(), now.getUTCMonth());
}

/**
 * Resolve a `?cycle=` value into a concrete month window. Falls back to the
 * current cycle for a missing, malformed, or future key.
 */
export function resolveCycle(key: string | undefined | null, now: Date = new Date()): CycleWindow {
  const current = currentCycleKey(now);
  let k = key && KEY_RE.test(key) ? key : current;

  let [y, m] = k.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  // Never resolve a future month — clamp to the current cycle.
  if (Number.isNaN(start.getTime()) || start.getTime() > now.getTime()) {
    k = current;
    [y, m] = k.split("-").map(Number);
  }

  const s = new Date(Date.UTC(y, m - 1, 1));
  const e = new Date(Date.UTC(y, m, 1));
  const isCurrent = k === current;
  const windowEnd = isCurrent ? now : e;
  const days = Math.max(1, Math.ceil((windowEnd.getTime() - s.getTime()) / 86_400_000));

  return {
    key: k,
    label: labelFor(s),
    startIso: s.toISOString(),
    endIso: e.toISOString(),
    periodStart: `${y}-${pad(m)}-01`,
    isCurrent,
    days,
  };
}

/** The selectable cycles for the picker: the current month and the prior `monthsBack`. */
export function listCycles(monthsBack = 12, now: Date = new Date()): { key: string; label: string; isCurrent: boolean }[] {
  const out: { key: string; label: string; isCurrent: boolean }[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ key: keyFor(d.getUTCFullYear(), d.getUTCMonth()), label: labelFor(d), isCurrent: i === 0 });
  }
  return out;
}
