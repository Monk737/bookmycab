import type Stripe from "stripe";
import { unixToIso } from "@/lib/billing/dates";
import { fromMinor } from "@/lib/billing/plan-price";

/**
 * Pure Stripe-event → local-row mapping. No I/O. The webhook handler builds
 * these rows and hands them to injected DB writers.
 */

/** A row for `public.subscriptions` (migration 0004). `tenant_id` is null when
 *  the subscription has no `tenant_id` metadata, the caller skips those. */
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

type NewModelSubUpdate = {
  table: "chat_subscriptions" | "voice_subscriptions";
  stripe_subscription_id: string;
  update: {
    status: "active" | "paused" | "cancelled";
    current_period_start: string | null;
    current_period_end: string | null;
  };
};

const STRIPE_STATUS_MAP: Record<string, "active" | "paused" | "cancelled"> = {
  active: "active", trialing: "active", past_due: "active",
  paused: "paused", unpaid: "paused",
  canceled: "cancelled", incomplete_expired: "cancelled",
};

const tsToDate = (ts: number | null | undefined): string | null =>
  typeof ts === "number" ? new Date(ts * 1000).toISOString().slice(0, 10) : null;

/**
 * Map a Stripe subscription to a new-model row update, or null when it is not a
 * new-model subscription (no `metadata.product`). Routes by product tag.
 */
export function mapNewModelSubscription(sub: Stripe.Subscription): NewModelSubUpdate | null {
  const product = sub.metadata?.product;
  if (product !== "chat" && product !== "voice") return null;
  // Stripe Basil (API 2025-03+) moved current_period_* off the subscription root
  // onto each item (see subscriptionToMirror). Read from the item first, falling
  // back to the root for older payloads / test fixtures. These fields are not in
  // the SDK type, so narrow defensively rather than blind-casting.
  const item = sub.items?.data?.[0] as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
  const s = sub as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    table: product === "chat" ? "chat_subscriptions" : "voice_subscriptions",
    stripe_subscription_id: sub.id,
    update: {
      status: STRIPE_STATUS_MAP[sub.status] ?? "active",
      current_period_start: tsToDate(item?.current_period_start ?? s.current_period_start),
      current_period_end: tsToDate(item?.current_period_end ?? s.current_period_end),
    },
  };
}
