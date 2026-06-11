# B3 — New-Model Stripe Charge Logic Design Spec

**Date:** 2026-06-10
**Program:** Billing migration (B0–B4). Depends on B1 (schema + figures) and B2 (provisioning writes the subscription rows).
**Status:** Design — pending review.

## Purpose

Create the Stripe charges for a new-model tenant: a one-time setup invoice (GBP) and two recurring subscriptions (chat + voice, GBP, rolling-monthly), triggered by a separate admin "Start billing" action. Sync Stripe subscription state back onto `chat_subscriptions` / `voice_subscriptions` via the webhook.

## Resolved decisions

- **Timing:** a distinct "Start billing" action on the tenant detail page (not at provisioning). Mirrors the existing legacy flow.
- **Currency:** all charges in GBP.
- **Bundle:** two separate Stripe subscriptions (chat + voice), each at its stored `monthly_price_gbp` (the authored split + any provisioning discount already baked in by B2).
- **Renewal:** rolling-monthly — Stripe `recurring.interval='month'`, no fixed term / no `cancel_at`. The legacy 12-month `contract_end` is not set for new-model tenants.
- **Discounts:** already applied to the stored `monthly_price_gbp` / setup amount at provisioning (B2). B3 charges the stored amounts directly — no Stripe coupon objects.

## Affected code

- `src/lib/billing/plan-price.ts` — add new-model Stripe param builders (alongside the legacy ones).
- `src/app/admin/tenants/[tenantId]/billing-actions.ts` — add `startNewModelBilling` action.
- `src/lib/billing/event-map.ts` + the Stripe webhook handler (`/webhooks/stripe`) — map new-model subscription events onto `chat_subscriptions` / `voice_subscriptions`.
- Tenant detail page UI — a "Start billing" button shown for new-model (`commercial_model` set) tenants in `onboarding`.

## New Stripe param builders (`plan-price.ts`)

```ts
/** One-time setup-fee invoice item, GBP minor units. */
export function buildNewSetupInvoiceItemParams(args: {
  customerId: string; setupGbp: number; tenantId: string;
}): Stripe.InvoiceItemCreateParams;   // amount = minorUnits(setupGbp), currency 'gbp'

/** A rolling-monthly subscription for one product, GBP. */
export function buildProductSubscriptionParams(args: {
  customerId: string; productId: string;
  product: "chat" | "voice"; monthlyGbp: number; tenantId: string;
}): Stripe.SubscriptionCreateParams;
// price_data: { currency: 'gbp', product, unit_amount: minorUnits(monthlyGbp),
//               recurring: { interval: 'month' } }
// metadata: { tenant_id, product }  ← product tag lets the webhook route to the right table
// automatic_tax: { enabled: true }
```

## `startNewModelBilling` action flow

Guarded by `requireStaff` + `blockIfDemo`. For a tenant with `commercial_model` set and `status='onboarding'`:

1. Ensure a Stripe customer exists (reuse existing customer-creation helper; store `stripe_customer_id`).
2. Read the tenant's `chat_subscriptions` / `voice_subscriptions` rows (whichever exist) for their `monthly_price_gbp`, and the tenant's `setup_fees` row for the setup amount.
3. Create the setup invoice item (`buildNewSetupInvoiceItemParams`) + finalise a one-off invoice (reuse existing invoice helper).
4. For each product present, create a subscription (`buildProductSubscriptionParams`) and store the returned `stripe_subscription_id` + `current_period_start/end` onto the matching `chat_subscriptions` / `voice_subscriptions` row.
5. Set `tenants.status='active'`.
6. Audit (`tenant.billing_start`) + `revalidatePath`.

Idempotency: if a product row already has a `stripe_subscription_id`, skip creating a duplicate (the action can be safely re-run).

## Webhook sync (`event-map.ts` + handler)

On `customer.subscription.updated|deleted` (and `invoice.paid`):
- Look up which table owns the subscription by `stripe_subscription_id` (check `chat_subscriptions` then `voice_subscriptions`); the subscription's `metadata.product` disambiguates.
- Update that row's `status` (`active`/`paused`/`cancelled` mapped from Stripe status) and `current_period_start/end`.
- **Rolling-monthly reset hook (D4):** on the voice subscription's `invoice.paid` (new period), the handler also opens a fresh `usage_counters` period for `feature_key='voice_calls'` (allowance = `voice_subscriptions.monthly_call_allowance`, used=0). This is where the monthly call pool resets. (The credit_ledger top-up balance is untouched.)

The legacy `subscriptions`-table mirroring stays for legacy tenants; new-model events route to the new tables by subscription id.

## Out of scope

- Provisioning + DB rows (B2).
- Credit top-up purchases (B4).
- Dashboard analytics views (later R5).

## Acceptance criteria

1. `buildNewSetupInvoiceItemParams` and `buildProductSubscriptionParams` produce GBP params with `minorUnits` conversion, monthly recurring, and `metadata.product`. Unit-tested.
2. `startNewModelBilling` creates a setup invoice + one subscription per product, stores `stripe_subscription_id` on the right row, and flips the tenant to `active`; re-running is idempotent (no duplicate subs). Tested with a mocked Stripe client.
3. The webhook updates `chat_subscriptions` / `voice_subscriptions` status + period by `stripe_subscription_id`, and on voice `invoice.paid` opens a fresh `voice_calls` `usage_counters` period at the plan allowance. Tested with mocked events.
4. Legacy-tenant billing/webhook behaviour is unchanged.
5. `tsc`/lint clean.
