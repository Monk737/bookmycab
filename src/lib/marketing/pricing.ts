/**
 * CabbyBot multi-currency pricing model.
 *
 * All prices are MONTHLY, excluding VAT. Source of truth: PRD §6.1.
 * Three tiers: A (≤25 drivers), B (26–100 drivers), C (101+ / custom → Contact Us).
 * Currencies supported: GBP, EUR, USD.
 */

// §6.1 — supported currencies
export type Currency = "GBP" | "EUR" | "USD";

export const CURRENCIES = ["GBP", "EUR", "USD"] as const satisfies readonly Currency[];

// §6.1 — minimum contract duration
export const CONTRACT_MONTHS = 12;

// §6.1 — one-time setup fee per currency
export const SETUP_FEE: Record<Currency, number> = {
  GBP: 1000,
  EUR: 1000,
  USD: 1200,
};

/** Monthly prices per currency, or null when no fixed price applies. */
type PriceMap = Record<Currency, number | null>;

export interface PricingTierAB {
  /** Fixed price for a single channel per month. */
  single: PriceMap;
  /** Fixed price for a channel bundle (minimum bundleMinChannels) per month. */
  bundle: PriceMap;
  /** Minimum number of channels required for the bundle rate. */
  bundleMinChannels: number;
  /** Contact sales for a quote — always false for A/B. */
  contactOnly: false;
}

export interface PricingTierC {
  /** No fixed price — always null. */
  single: PriceMap;
  /** No fixed price — always null. */
  bundle: PriceMap;
  /** Applies to 101+ drivers, 4+ channels, or any custom requirement. */
  contactOnly: true;
}

export type PricingOption = PricingTierAB | PricingTierC;

/**
 * §6.1 pricing options.
 *
 * A — up to 25 drivers/fleet
 * B — 26–100 drivers/fleet
 * C — 101+ drivers OR 4+ channels OR anything outside A/B (Contact Us)
 */
export const PRICING: { A: PricingTierAB; B: PricingTierAB; C: PricingTierC } =
  {
    // §6.1 Option A
    A: {
      single: { GBP: 500, EUR: 500, USD: 600 },
      bundle: { GBP: 1000, EUR: 1000, USD: 1200 },
      bundleMinChannels: 3,
      contactOnly: false,
    },

    // §6.1 Option B
    B: {
      single: { GBP: 800, EUR: 800, USD: 800 },
      bundle: { GBP: 1800, EUR: 1800, USD: 2000 },
      bundleMinChannels: 3,
      contactOnly: false,
    },

    // §6.1 Option C — quoted individually, no fixed price
    C: {
      single: { GBP: null, EUR: null, USD: null },
      bundle: { GBP: null, EUR: null, USD: null },
      contactOnly: true,
    },
  };

// Currency display symbols (prepended manually; see formatPrice).
const CURRENCY_SYMBOL: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};

/**
 * Format a monetary amount for display.
 *
 * Produces: symbol + integer with thousands separators, no decimals.
 * Examples: formatPrice("GBP", 500) → "£500"
 *           formatPrice("EUR", 1000) → "€1,000"
 *           formatPrice("USD", 1200) → "$1,200"
 *
 * Non-finite or negative amounts are coerced to 0 (prices are never negative),
 * so display can never render "£NaN" or "£-5".
 */
export function formatPrice(currency: Currency, amount: number): string {
  const safe = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
  // Use en-US locale to reliably get comma thousands separators across all
  // three currencies. We prepend the correct symbol manually.
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(safe);
  return `${CURRENCY_SYMBOL[currency]}${formatted}`;
}
