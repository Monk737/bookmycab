# B4 — Voice Credit Top-Up Purchase Design Spec

**Date:** 2026-06-10
**Program:** Billing migration (B0–B4). Depends on B1 (`credit_ledger`, `credit_balance()`, `validate_coupon()`).
**Status:** Design — pending review.

## Purpose

Let a tenant buy extra AI Voice credit (£0.90 per call, minimum £9) from the dashboard billing page, via Stripe Checkout, with the purchased credits landing in `credit_ledger`. Show the current credit balance and remaining plan calls. Tenants may apply a tenant-redeemable coupon to the purchase.

## Resolved decisions

- **Packs:** preset packs (£9 → 10 credits, £45 → 50, £90 → 100) **plus** a custom amount field (min £9). 1 credit = 1 call = £0.90.
- **Billing:** app-managed prepaid balance (B1). Purchase via Stripe Checkout (one-off `mode: payment`); webhook grants credits to `credit_ledger`. Stripe only handles the purchase.
- **Coupon:** tenant may apply a `tenant_redeemable` coupon with `applies_to in ('credit','both')` via the `validate_coupon()` RPC; the discount reduces the Checkout amount. Credits granted reflect the **paid** amount ÷ £0.90... see "Credits granted" below.

## Affected code

- `src/app/dashboard/billing/page.tsx` — add a "Voice credit" panel (balance + remaining plan calls + buy packs).
- `src/app/api/orgs/[orgId]/billing/credit/checkout/route.ts` (new) — creates a Stripe Checkout session for a pack/custom amount.
- `src/app/webhooks/stripe/route.ts` + `event-map.ts` — handle `checkout.session.completed` for credit purchases → write `credit_ledger`.
- `src/lib/billing/credit.ts` (new) — pure helpers: pack catalog, amount→credits, min-spend validation.

## Credit helpers (`src/lib/billing/credit.ts`)

```ts
export const CREDIT_UNIT_GBP = 0.9;          // £0.90 per call
export const MIN_TOPUP_GBP = 9;              // minimum spend

export interface CreditPack { id: string; gbp: number; credits: number; }
export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_10",  gbp: 9,  credits: 10 },
  { id: "pack_50",  gbp: 45, credits: 50 },
  { id: "pack_100", gbp: 90, credits: 100 },
];

/** Credits granted for a paid GBP amount (whole credits, floor). */
export function creditsForGbp(gbp: number): number { return Math.floor(gbp / CREDIT_UNIT_GBP); }

/** Validate a custom top-up amount (>= MIN_TOPUP_GBP, finite). Returns credits or an error. */
export function validateCustomTopup(gbp: number): { ok: true; credits: number } | { ok: false; error: string };
```

## Purchase flow

1. **Dashboard panel** (`dashboard/billing`): shows `credit_balance(tenant)` (top-up balance) and remaining plan calls (`monthly_call_allowance − usage_counters.used` for the current `voice_calls` period). Renders the three packs + a custom-amount input + optional coupon-code field.
2. **Checkout route** `POST /api/orgs/:orgId/billing/credit/checkout`:
   - Auth: `requireOrgAccess` (tenant member); `blockIfDemo`.
   - Body: `{ packId }` or `{ customGbp }`, optional `couponCode`.
   - Resolve the base GBP amount (pack or validated custom). Reject < £9.
   - If `couponCode`: call the `validate_coupon` RPC; if it returns a percent, reduce the GBP amount (never below a floor; if the discount would drop below £9-equivalent, still allow since it's a discount on a valid base — clamp credits to the pre-discount intended credits? See "Credits granted").
   - Create a Stripe Checkout session: `mode: 'payment'`, one line item (GBP, `unit_amount = minorUnits(finalGbp)`, qty 1, name "AI Voice credit — N calls"), `metadata: { tenant_id, credits, reason: 'topup_purchase', coupon_code? }`, success/cancel URLs back to the billing page.
   - Return the session URL; the client redirects to Stripe.
3. **Webhook** `checkout.session.completed` (mode payment, our metadata present):
   - Idempotency: skip if a `credit_ledger` row already exists with this `stripe_payment_intent_id`.
   - Insert `credit_ledger`: `delta = +credits` (from session metadata), `reason='topup_purchase'`, `unit_price_micros = 900000`, `currency='GBP'`, `stripe_payment_intent_id`.
   - If a coupon was applied, insert a `coupon_redemptions` row (`applied_to='credit_topup'`, amount_discounted_micros, currency) and increment the coupon's `times_redeemed` (service-role).

### Credits granted (coupon interaction)

The **credits** are fixed by the pack/custom selection (what the customer is buying); the **coupon discounts the price they pay**, not the credits received. So a £45/50-credit pack with a 20%-off coupon charges £36 but still grants 50 credits. `metadata.credits` carries the intended credits; the webhook grants exactly that. (This matches "coupon for billing and purchase" — a price discount, not a credit bonus.)

## Out of scope

- Consuming credits on calls (the call-processing pipeline; later voice epic).
- Plan-allowance reset (B3 webhook handles it).
- Admin coupon creation/printing UI (separate; the `validate_coupon` RPC + existing admin coupons already exist).

## Acceptance criteria

1. `CREDIT_PACKS`, `creditsForGbp`, `validateCustomTopup` behave per spec (min £9; floor division; pack credit counts 10/50/100). Unit-tested.
2. The checkout route rejects amounts < £9, builds a Stripe Checkout session with correct GBP `unit_amount` and `metadata.credits`, and applies a valid coupon as a price discount (credits unchanged). Tested with a mocked Stripe client + mocked `validate_coupon`.
3. The webhook grants exactly `metadata.credits` to `credit_ledger` on `checkout.session.completed`, is idempotent on `stripe_payment_intent_id`, and records a `coupon_redemptions` row when a coupon was used. Tested with mocked events.
4. The billing page shows the live credit balance (`credit_balance` RPC) and remaining plan calls.
5. `tsc`/lint clean.
