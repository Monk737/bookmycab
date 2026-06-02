const DASH = "—";
const CURRENCY_LOCALE: Record<string, string> = { GBP: "en-GB", EUR: "en-IE", USD: "en-US" };

export function formatCurrency(amount: number | null | undefined, currency: string): string {
  if (amount == null || Number.isNaN(amount)) return DASH;
  const locale = CURRENCY_LOCALE[currency] ?? "en-GB";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount).replace(/ /g, " ");
}

export function formatDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d).replace(/ /g, " ");
}

export function addressOneLine(addr: unknown): string {
  if (!addr || typeof addr !== "object") return DASH;
  const a = addr as Record<string, unknown>;
  const town = typeof a.town === "string" ? a.town : null;
  const postcode = typeof a.postcode === "string" ? a.postcode : null;
  const parts = [town, postcode].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(", ");
  if (typeof a.label === "string" && a.label) return a.label;
  return DASH;
}

export function truncateId(id: string | null | undefined): string {
  if (!id) return DASH;
  return id.slice(0, 8);
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return DASH;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}
