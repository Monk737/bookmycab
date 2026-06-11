# B2 — New-Model Provisioning Design Spec

**Date:** 2026-06-10
**Program:** Billing migration (B0–B4). Depends on B1 (schema + billing pricing helpers, applied).
**Status:** Design — pending review.

## Purpose

Replace the legacy `plan_band` tenant-provisioning flow with a new-model flow: an admin selects a commercial model (Chat / Voice / Double Decker) + tier(s), and provisioning auto-computes GBP prices, writes the `chat_subscriptions` / `voice_subscriptions` rows and `tenants.commercial_model`, and leaves the tenant in `onboarding` (Stripe charging is B3). Existing legacy tenants are untouched.

## Resolved decisions

- **Pricing entry:** auto-compute `monthly_price_gbp` + setup fee from the selected tier via the B1 helpers. Full Throttle (chat quoted) exposes an editable price field; all other tiers are read-only computed.
- **Charge timing:** provisioning does NOT call Stripe. It writes DB rows + `status='onboarding'`. A separate "Start billing" action (B3) creates the Stripe charges.
- **Currency:** new-model charges are GBP; the form forces GBP for new-model tenants.
- **Coexistence:** this is the provisioning path for ALL new tenants. The legacy `plan_band` form is retired for new provisioning; legacy tenants keep their data and billing.

## Affected code

- `src/app/admin/tenants/new/tenant-form.tsx` — the client form (rebuild fields).
- `src/app/admin/tenants/actions.ts` — `createTenant` server action (rewrite for the new model).
- `src/lib/billing/pricing.ts` — add a small voice-plan spec helper (allowance + agents per tier).
- `src/lib/admin/coupons.ts` — reused as-is for the admin provisioning coupon.

## Billing helper addition

The B1 billing pricing module resolves monthly prices and setup fees. Provisioning also needs the voice plan's operational shape (allowance + included agents) to write `voice_subscriptions`. Add to `src/lib/billing/pricing.ts`:

```ts
/** Operational shape of a voice plan tier (drives voice_subscriptions). */
export interface VoicePlanSpec { callAllowance: number; includedAgents: number; }
export const VOICE_PLAN_SPEC: Record<NewTierKey, VoicePlanSpec> = {
  ignition:      { callAllowance: 1500, includedAgents: 1 },
  in_motion:     { callAllowance: 2250, includedAgents: 2 },
  full_throttle: { callAllowance: 3000, includedAgents: 2 },
};

/** Setup fee (GBP) for a tenant's commercial model + voice agent count. */
export function setupFeeGbp(model: CommercialModel, voiceAgents: 0 | 1 | 2): number {
  if (model === "chat") return NEW_CHAT_SETUP_GBP;                       // 1000
  if (model === "voice")
    return voiceAgents >= 2 ? NEW_VOICE_SETUP_GBP.twoAgents : NEW_VOICE_SETUP_GBP.oneAgent; // 1500/1000
  // double_decker
  return voiceAgents >= 2 ? NEW_BUNDLE_SETUP_GBP.twoVoiceAgents : NEW_BUNDLE_SETUP_GBP.oneVoiceAgent; // 2000/1500
}
```

## Form model

Fields (client form → FormData → zod in `createTenant`):

| Field | Notes |
|---|---|
| name, slug, country, contact_email, dispatch_adapter, dispatch_company_id | unchanged from today |
| `commercial_model` | select: `chat` \| `voice` \| `double_decker` |
| `chat_tier` | shown when model includes chat; `ignition`\|`in_motion`\|`full_throttle` |
| `chat_channel_mode` | shown when model includes chat; `single`\|`bundle` |
| `voice_tier` | shown when model includes voice; `ignition`\|`in_motion`\|`full_throttle` |
| `chat_price_gbp` (computed, read-only) | from `chatMonthlyPriceGbp(...)`; EDITABLE only when chat tier = full_throttle (quoted → null) |
| `voice_price_gbp` (computed, read-only) | from `voiceMonthlyPriceGbp(...)` |
| `setup_fee_gbp` (computed, read-only) | from `setupFeeGbp(model, includedAgents)` |
| `coupon_code` | optional; admin provisioning coupon (existing `validateCoupon`) |

Currency is fixed to `GBP` (no selector for new-model tenants). The client form recomputes the displayed prices as selections change (mirroring the marketing page's GBP figures via the billing helpers — billing is the source for charge amounts).

## Server action (`createTenant`) data flow

1. `requireStaff()` (defense-in-depth).
2. Zod-validate the new-model schema. `commercial_model` drives which tier/mode fields are required. Full Throttle chat requires a manual `chat_price_gbp`.
3. Compute, per product present:
   - `chatMonthlyPriceGbp(model, chat_tier, chat_channel_mode)` (or the manual override for full_throttle).
   - `voiceMonthlyPriceGbp(model, voice_tier, chat_channel_mode)` (mode only matters for double_decker; voice-only ignores it).
   - `setupFeeGbp(model, VOICE_PLAN_SPEC[voice_tier].includedAgents)` (0 agents for chat-only).
4. Validate coupon (existing `validateCoupon`); apply `percent_off` to the monthly prices + setup fee. 100%-off → `billing_bypass=true` comp path (mirrors existing logic, but GBP + new rows).
5. Insert `tenants` row: `commercial_model`, `currency='GBP'`, `plan_band=null`, `status='onboarding'` (or `active` when bypassed), `coupon_code`/`discount_percent`/`billing_bypass` as today. Do NOT set legacy `monthly_price` (leave null for new-model tenants).
6. Insert `chat_subscriptions` (when model includes chat): `plan_tier`, `channel_mode`, `monthly_price_gbp` (discounted), `status='active'`, period null (set by B3/webhook), `stripe_subscription_id` null.
7. Insert `voice_subscriptions` (when model includes voice): `plan_tier`, `monthly_call_allowance` + `included_agents` from `VOICE_PLAN_SPEC`, `monthly_price_gbp` (discounted), `status='active'`, period null.
8. Insert a `setup_fees` row (GBP amount, discounted; `paid_at` set only when bypassed) — reuse existing table.
9. Coupon redemption + audit (`tenant.create` with new metadata: commercial_model, tiers) — reuse existing.
10. Redirect to the tenant detail page.

> **Bypass (100%-off):** comp the subscriptions locally (status active, synthetic `stripe_subscription_id = comp_<tenantId>`, period = +1 month for rolling-monthly) so the tenant is fully active without Stripe — same shape B3's webhook would write.

## Out of scope (other cycles)

- Stripe setup invoice + subscription creation (B3).
- Credit top-up (B4).
- A UI to switch an existing legacy tenant onto the new model (deferred).

## Acceptance criteria

1. The provisioning form lets an admin pick commercial_model + tiers and shows auto-computed GBP prices; Full Throttle chat price is editable.
2. Submitting creates a `tenants` row with `commercial_model` set, `currency='GBP'`, `plan_band=null`, `status='onboarding'`, plus the correct `chat_subscriptions` and/or `voice_subscriptions` rows with the computed `monthly_price_gbp` and (for voice) correct allowance/agents.
3. A coupon discounts the recorded monthly prices + setup fee; a 100%-off coupon comps the tenant active with synthetic subscriptions, no Stripe.
4. `setupFeeGbp` / `VOICE_PLAN_SPEC` return the spec values (chat 1000; voice 1000/1500; bundle 1500/2000; allowances 1500/2250/3000, agents 1/2/2).
5. Unit tests cover `setupFeeGbp`, `VOICE_PLAN_SPEC`, and the price-computation branch per commercial_model; an integration-style test covers the zod schema validation (required fields per model).
6. No change to the legacy provisioning behaviour for existing tenants; `tsc`/lint clean.
