import type Stripe from "stripe";
import { unixToIso } from "@/lib/billing/dates";
import { fromMinor } from "@/lib/billing/plan-price";

/**
 * Pure Stripe-event → local-row mapping. No I/O. The webhook handler builds
 * these rows and hands them to injected DB writers.
 */

/** A row for `public.subscriptions` (migration 0004). `tenant_id` is null when
 *  the subscription has no `tenant_id` metadata — the caller skips those. */
export interface SubscriptionMirrorRow {
  tenant_id: string | null;
  stripe_sub_id: string;
  plan_band: string | null;
  monthly_price: number | null;
  currency: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
}

export function subscriptionToMirror(sub: Stripe.Subscription): SubscriptionMirrorRow {
  const item = sub.items?.data?.[0];
  const unitAmount = item?.price?.unit_amount ?? null;
  const currency = item?.price?.currency ?? null;
  const md = (sub.metadata ?? {}) as Record<string, string | undefined>;
  return {
    tenant_id: md.tenant_id ?? null,
    stripe_sub_id: sub.id,
    plan_band: md.plan_band ?? null,
    monthly_price: unitAmount == null ? null : fromMinor(unitAmount),
    currency: currency ? currency.toUpperCase() : null,
    status: sub.status ?? null,
    // Stripe Basil (API 2025-03+) moved current_period_* from the subscription
    // onto each subscription ITEM. Read from the first item.
    current_period_start: unixToIso(item?.current_period_start ?? null),
    current_period_end: unixToIso(item?.current_period_end ?? null),
    cancel_at: unixToIso(sub.cancel_at),
  };
}

/** Distinguish a one-time setup-fee invoice from a subscription invoice. Basil
 *  moved the subscription pointer onto invoice.parent.subscription_details. */
export function classifyInvoice(invoice: Stripe.Invoice): "setup" | "subscription" {
  const sub = invoice.parent?.subscription_details?.subscription ?? null;
  return sub ? "subscription" : "setup";
}
