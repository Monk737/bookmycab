/**
 * BookMyCab pricing model.
 *
 * GBP is the single source of truth. All prices below are MONTHLY in GBP,
 * excluding VAT, EXCEPT the one-time setup fees and the per-call credit price.
 * EUR/USD figures shown on the page are derived at render time from live FX
 * rates (see ./fx.ts) via convert()/priceFor(); they are never stored here.
 *
 * Two fixed plans:
 *   1. WhatsApp Booking Suite — chat + voice note, £499/mo.
 *   2. AI Voice Booking "Ignition" — 1000 calls, £1999/mo.
 * Custom "Full Throttle" plans have no fixed numbers and are quoted on a
 * discovery call, then configured per tenant in the admin console.
 */

export type Currency = "GBP" | "EUR" | "USD";

export const CURRENCIES = ["GBP", "EUR", "USD"] as const satisfies readonly Currency[];

/** Prices are authored in this currency; everything else is derived. */
export const BASE_CURRENCY: Currency = "GBP";

/* ----------------------------------------------------------------------------
   THE TWO FIXED PLANS (GBP, monthly excl. VAT). The Custom "Full Throttle"
   plan has no fixed numbers — it is quoted on a discovery call and configured
   per tenant in the admin console.
   -------------------------------------------------------------------------- */

/** 1. WhatsApp Booking Suite — WhatsApp Chatbot + Voice Note. */
export const CHAT_SUITE = {
  name: "WhatsApp Booking Suite",
  blurb: "WhatsApp Chatbot + Voice Note. One bot that books by text or voice note and writes the job straight to dispatch.",
  priceGbp: 499,
  setupGbp: 999,
} as const;

/** 2a. AI Voice Booking — Ignition (the only fixed voice plan). */
export const VOICE_IGNITION = {
  name: "Ignition",
  callsPerMonth: 1000,
  priceGbp: 1999,
  setupGbp: 999,
} as const;

/** Pay-as-you-go base voice credit, GBP per call (custom plans override this). */
export const EXTRA_CALL_PRICE_GBP = 0.9;

/* ----------------------------------------------------------------------------
   FORMAT / CONVERT HELPERS
   -------------------------------------------------------------------------- */

const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};

/** Convert a GBP amount into `currency` using `rates` (rates[GBP] === 1). */
export function convert(
  amountGbp: number,
  currency: Currency,
  rates: Record<Currency, number>,
): number {
  const rate = rates[currency];
  return amountGbp * (typeof rate === "number" && rate > 0 ? rate : 1);
}

/**
 * Format a monetary amount for display: symbol + grouped digits.
 * Default 0 decimals (plan prices); pass { decimals: 2 } for the per-call price.
 * Non-finite/negative amounts coerce to 0 so we never render "£NaN".
 */
export function formatPrice(
  currency: Currency,
  amount: number,
  opts: { decimals?: number } = {},
): string {
  const decimals = opts.decimals ?? 0;
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
  return `${CURRENCY_SYMBOL[currency]}${formatted}`;
}

/** Convenience: convert a GBP amount and format it in one call. */
export function priceFor(
  amountGbp: number,
  currency: Currency,
  rates: Record<Currency, number>,
  decimals = 0,
): string {
  return formatPrice(currency, convert(amountGbp, currency, rates), { decimals });
}
