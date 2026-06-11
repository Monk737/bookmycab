import type Stripe from "stripe";
import { minorUnits } from "@/lib/billing/plan-price";

/** Pure Stripe Checkout params for a one-time AI Voice credit top-up. The
 *  coupon (if any) discounts the GBP charged but never the credits granted. */
export function buildCreditCheckoutParams(args: {
  customerId: string;
  tenantId: string;
  orgId: string;
  origin: string;
  gbp: number;
  credits: number;
  finalGbp: number;
  couponCode?: string;
}): Stripe.Checkout.SessionCreateParams {
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
      ...(args.couponCode ? { coupon_code: args.couponCode } : {}),
    },
  };
}
