/**
 * Billing / provisioning pricing — the LEGACY A/B plan-band commercial model.
 *
 * Decoupled (B0) from the marketing pricing module
 * (`src/lib/marketing/pricing.ts`), which now advertises the new
 * Chat / AI Voice / Double Decker model. The billing stack still charges
 * tenants on the A/B fleet-band model until the B1–B4 billing migration lands;
 * these are the figures Stripe actually charges.
 *
 * The `Currency` primitive (and `CURRENCIES`) still lives in the marketing
 * module as a shared type — only the commercial constants move here.
 *
 * Source: PRD §6.1 (the original A/B model).
 */
import type { Currency } from "@/lib/marketing/pricing";

/** Minimum contract length in months (legacy fixed-term model). */
export const CONTRACT_MONTHS = 12;

/** One-time setup fee per currency (legacy A/B model), in major units. */
export const SETUP_FEE: Record<Currency, number> = {
  GBP: 1000,
  EUR: 1000,
  USD: 1200,
};

/** Monthly band prices per currency (legacy A/B model), in major units. */
export interface BandPrices {
  single: Record<Currency, number>;
  bundle: Record<Currency, number>;
}

/** Plan A (smaller fleets). */
export const BAND_A: BandPrices = {
  single: { GBP: 500, EUR: 500, USD: 600 },
  bundle: { GBP: 1000, EUR: 1000, USD: 1200 },
};

/** Plan B (larger fleets). */
export const BAND_B: BandPrices = {
  single: { GBP: 800, EUR: 800, USD: 800 },
  bundle: { GBP: 1800, EUR: 1800, USD: 2000 },
};
