import type Stripe from "stripe";
import { SETUP_FEE, type Currency } from "@/lib/marketing/pricing";
import { planBandMonthlyPrice, type PlanBand } from "@/lib/admin/plan-bands";

/**
 * Pure pricing helpers + Stripe param builders.
 *
 * No I/O, no `server-only` — safe to import anywhere and unit-test directly.
 * Money: PRD prices are MAJOR units (whole pounds/euros/dollars, 2-dp max);
 * Stripe wants MINOR units (pence/cents). GBP/EUR/USD are all 2-decimal
 * currencies, so the factor is always 100.
 */

/** Major → minor units (×100, rounded to avoid float dust). */
export function minorUnits(major: number): number {
  return Math.round(major * 100);
}

/** Minor → major units. */
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/** The one-time setup fee for a currency, in minor units (PRD §6.1). */
export function setupFeeMinor(currency: Currency): number {
  return minorUnits(SETUP_FEE[currency]);
}

/** Params for the one-time setup-fee invoice item (legacy amount form — no
 *  product catalog entry needed for a one-off charge). */
export function buildSetupInvoiceItemParams(args: {
  customerId: string;
  currency: Currency;
}): Stripe.InvoiceItemCreateParams {
  return {
    customer: args.customerId,
    amount: setupFeeMinor(args.currency),
    currency: args.currency.toLowerCase(),
    description: "BookMyCab automation — one-time setup fee",
  };
}

/** Params for the monthly subscription. Uses inline `price_data` against a
 *  shared product so we don't maintain a per-band Stripe price catalog.
 *  Throws for Custom (null price — those are quoted and started manually). */
export function buildSubscriptionCreateParams(args: {
  customerId: string;
  productId: string;
  band: PlanBand;
  currency: Currency;
  tenantId: string;
}): Stripe.SubscriptionCreateParams {
  const major = planBandMonthlyPrice(args.band, args.currency);
  if (major == null) {
    throw new Error(
      `Cannot build a subscription for Custom band (no fixed price). Configure it manually in Stripe.`,
    );
  }
  return {
    customer: args.customerId,
    automatic_tax: { enabled: true },
    items: [
      {
        price_data: {
          currency: args.currency.toLowerCase(),
          product: args.productId,
          unit_amount: minorUnits(major),
          recurring: { interval: "month" },
        },
      },
    ],
    metadata: {
      tenant_id: args.tenantId,
      plan_band: args.band,
    },
  };
}
