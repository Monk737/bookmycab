/** Client-safe formatting helpers shared by the voice log components. */

/** Local calendar day key (YYYY-MM-DD) for an ISO timestamp, in the viewer's tz. */
export function localDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA");
}

/** Today's local calendar day key. */
export function todayKey(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** "14 Jun, 21:18" from an ISO timestamp. */
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Friendly label for a date key (Today / Yesterday / 14 Jun 2026). */
export function fmtDayLabel(dayKey: string): string {
  if (dayKey === todayKey()) return "Today";
  const y = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA");
  if (dayKey === y) return "Yesterday";
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Call/booking duration in seconds → "4m 38s" / "52s". */
export function formatDuration(s: number | null): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

/** pickup_time is UK local wall-clock ISO without tz, e.g. 2026-06-15T06:00. */
export function fmtPickup(s: string | null): string {
  if (!s) return "ASAP";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return s;
  const [, y, mo, d, hh, mm] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm));
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
