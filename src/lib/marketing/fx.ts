/**
 * Live GBP→EUR/USD foreign-exchange rates for the pricing page.
 *
 * Source: Frankfurter (https://www.frankfurter.app), free, no API key, ECB data.
 * Cached 24h via Next.js fetch revalidation. On ANY failure we return
 * FX_FALLBACK so the pricing page always renders sane numbers.
 *
 * Call getFxRates() from a SERVER component only, then pass the result down to
 * client components as a plain prop.
 */
import type { Currency } from "@/lib/marketing/pricing";

/** Conservative manual snapshot; update if the API is ever retired. */
export const FX_FALLBACK: Record<Currency, number> = {
  GBP: 1,
  EUR: 1.18,
  USD: 1.27,
};

const FX_URL = "https://api.frankfurter.app/latest?base=GBP&symbols=EUR,USD";

/** Pure parser — extracted so it is unit-testable without network. */
export function parseFxResponse(data: unknown): Record<Currency, number> | null {
  if (!data || typeof data !== "object") return null;
  const rates = (data as { rates?: Record<string, unknown> }).rates;
  if (!rates || typeof rates !== "object") return null;
  const eur = (rates as Record<string, unknown>).EUR;
  const usd = (rates as Record<string, unknown>).USD;
  if (typeof eur !== "number" || typeof usd !== "number") return null;
  return { GBP: 1, EUR: eur, USD: usd };
}

export async function getFxRates(): Promise<Record<Currency, number>> {
  try {
    const res = await fetch(FX_URL, { next: { revalidate: 86400 } });
    if (!res.ok) return FX_FALLBACK;
    const parsed = parseFxResponse(await res.json());
    return parsed ?? FX_FALLBACK;
  } catch {
    return FX_FALLBACK;
  }
}
