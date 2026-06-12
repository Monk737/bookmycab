import type Stripe from "stripe";

/**
 * Pure pricing helpers + Stripe param builders for the two-product model.
 *
 * No I/O, no `server-only`, safe to import anywhere and unit-test directly.
 * Money: prices are authored in MAJOR units (whole pounds, 2-dp max); Stripe
 * wants MINOR units (pence). GBP is 2-decimal, so the factor is always 100.
 * Subscriptions use inline `price_data` against a shared product, so there is
 * no per-tier Stripe price catalog to maintain.
 */

/** Major → minor units (×100, rounded to avoid float dust). */
export function minorUnits(major: number): number {
  return Math.round(major * 100);
}

/** Minor → major units. */
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/** One-time setup-fee invoice item for the new model (GBP). */
export function buildNewSetupInvoiceItemParams(args: {
  customerId: string;
  setupGbp: number;
  tenantId: string;
}): Stripe.InvoiceItemCreateParams {
  return {
    customer: args.customerId,
    amount: minorUnits(args.setupGbp),
    currency: "gbp",
    description: "BookMyCab — one-time setup fee",
    metadata: { tenant_id: args.tenantId },
  };
}

/** A rolling-monthly GBP subscription for one product (chat or voice). */
export function buildProductSubscriptionParams(args: {
  customerId: string;
  productId: string;
  product: "chat" | "voice";
  monthlyGbp: number;
  tenantId: string;
}): Stripe.SubscriptionCreateParams {
  return {
    customer: args.customerId,
    automatic_tax: { enabled: true },
    items: [
      {
        price_data: {
          currency: "gbp",
          product: args.productId,
          unit_amount: minorUnits(args.monthlyGbp),
          recurring: { interval: "month" },
        },
      },
    ],
    metadata: { tenant_id: args.tenantId, product: args.product },
  };
}
