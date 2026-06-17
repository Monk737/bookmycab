import type Stripe from "stripe";
import { minorUnits } from "@/lib/billing/plan-price";
import { CREDIT_UNIT_GBP } from "@/lib/billing/credit";

/** Pure Stripe Checkout params for a one-time AI Voice credit top-up. The
 *  coupon (if any) discounts the GBP charged but never the credits granted.
 *  When a tenant has a custom overage rate, pass `unitGbp` so the session
 *  metadata carries `credit_unit_micros` for the webhook ledger insert. */
export function buildCreditCheckoutParams(args: {
  customerId: string;
  tenantId: string;
  orgId: string;
  origin: string;
  gbp: number;
  credits: number;
  finalGbp: number;
  couponCode?: string;
  /** Per-credit unit price (GBP) recorded in the ledger. Custom tenants pass
   *  their overage rate; pack purchases pass the pack's effective per-credit
   *  price. Defaults to the base rate (£2) when omitted. */
  unitGbp?: number;
}): Stripe.Checkout.SessionCreateParams {
  const unit = (args.unitGbp && args.unitGbp > 0) ? args.unitGbp : CREDIT_UNIT_GBP;
  const creditUnitMicros = Math.round(unit * 1_000_000);
  return {
    mode: "payment",
    customer: args.customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: minorUnits(args.finalGbp),
          product_data: { name: `AI Voice credit — ${args.credits} calls` },
        },
      },
    ],
    success_url: `${args.origin}/dashboard/billing?credit=success`,
    cancel_url: `${args.origin}/dashboard/billing?credit=cancelled`,
    metadata: {
      tenant_id: args.tenantId,
      credits: String(args.credits),
      reason: "topup_purchase",
      credit_unit_micros: String(creditUnitMicros),
      ...(args.couponCode ? { coupon_code: args.couponCode } : {}),
    },
  };
}
