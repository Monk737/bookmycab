# B4 — Voice Credit Top-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tenant buy extra AI Voice credit (£0.90/call, min £9) from the dashboard via Stripe Checkout (preset packs + custom amount, optional coupon), granting credits to `credit_ledger` on the webhook, and show the live credit balance + remaining plan calls.

**Architecture:** Pure credit helpers in a new `src/lib/billing/credit.ts` (pack catalog, amount→credits, validation). A checkout API route builds a Stripe Checkout session with `metadata.credits`. The Stripe webhook grants exactly `metadata.credits` to `credit_ledger` on `checkout.session.completed` (idempotent on payment intent). The dashboard billing page renders balance + remaining plan calls + the buy UI.

**Tech Stack:** Stripe Checkout, Next.js route handlers + server components, Supabase, Vitest with mocked Stripe.

**Spec:** `docs/superpowers/specs/2026-06-10-b4-credit-topup-design.md`
**Depends on:** B1 (`credit_ledger`, `credit_balance()`, `validate_coupon()`).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/billing/credit.ts` | Pack catalog, `creditsForGbp`, `validateCustomTopup`, `resolveTopupAmount` | Create |
| `src/app/api/orgs/[orgId]/billing/credit/checkout/route.ts` | Create Stripe Checkout session | Create |
| `src/app/webhooks/stripe/route.ts` | Handle `checkout.session.completed` → `credit_ledger` | Modify |
| `src/app/dashboard/billing/page.tsx` | Credit panel (balance, remaining calls, buy UI) | Modify |
| `src/components/dashboard/credit-topup.tsx` | Client buy UI (packs + custom + coupon) | Create |
| `tests/billing-credit.test.ts` | Helper unit tests | Create |
| `tests/billing-credit-checkout.test.ts` | Checkout route + webhook grant tests (mocked Stripe) | Create |

---

### Task 1: Credit helpers

**Files:**
- Create: `src/lib/billing/credit.ts`
- Create: `tests/billing-credit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/billing-credit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CREDIT_UNIT_GBP,
  MIN_TOPUP_GBP,
  CREDIT_PACKS,
  creditsForGbp,
  validateCustomTopup,
  resolveTopupAmount,
} from "@/lib/billing/credit";

describe("constants + packs", () => {
  it("unit £0.90, min £9, three packs", () => {
    expect(CREDIT_UNIT_GBP).toBe(0.9);
    expect(MIN_TOPUP_GBP).toBe(9);
    expect(CREDIT_PACKS.map((p) => [p.gbp, p.credits])).toEqual([[9, 10], [45, 50], [90, 100]]);
  });
});

describe("creditsForGbp", () => {
  it("floors to whole credits", () => {
    expect(creditsForGbp(9)).toBe(10);   // 9 / 0.9 = 10
    expect(creditsForGbp(45)).toBe(50);
    expect(creditsForGbp(10)).toBe(11);  // 11.11 → 11
  });
});

describe("validateCustomTopup", () => {
  it("accepts >= £9", () => {
    expect(validateCustomTopup(9)).toEqual({ ok: true, credits: 10 });
    expect(validateCustomTopup(20)).toEqual({ ok: true, credits: 22 });
  });
  it("rejects < £9 and non-finite", () => {
    expect(validateCustomTopup(5).ok).toBe(false);
    expect(validateCustomTopup(NaN).ok).toBe(false);
  });
});

describe("resolveTopupAmount", () => {
  it("resolves a pack id to gbp + credits", () => {
    expect(resolveTopupAmount({ packId: "pack_50" })).toEqual({ ok: true, gbp: 45, credits: 50 });
  });
  it("resolves a custom amount", () => {
    expect(resolveTopupAmount({ customGbp: 18 })).toEqual({ ok: true, gbp: 18, credits: 20 });
  });
  it("rejects an unknown pack or a too-small custom amount", () => {
    expect(resolveTopupAmount({ packId: "nope" }).ok).toBe(false);
    expect(resolveTopupAmount({ customGbp: 1 }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/billing-credit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/billing/credit.ts`**

```ts
/**
 * AI Voice credit top-up pricing. App-managed prepaid model (see B1):
 * 1 credit = 1 call = £0.90. Stripe handles the purchase only; the webhook
 * grants the credits in metadata to credit_ledger.
 */
export const CREDIT_UNIT_GBP = 0.9;
export const MIN_TOPUP_GBP = 9;

export interface CreditPack {
  id: string;
  gbp: number;
  credits: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_10", gbp: 9, credits: 10 },
  { id: "pack_50", gbp: 45, credits: 50 },
  { id: "pack_100", gbp: 90, credits: 100 },
];

/** Whole credits a paid GBP amount buys (floor). */
export function creditsForGbp(gbp: number): number {
  return Math.floor(gbp / CREDIT_UNIT_GBP);
}

export type TopupResult =
  | { ok: true; credits: number }
  | { ok: false; error: string };

/** Validate a custom top-up amount (finite, >= MIN_TOPUP_GBP). */
export function validateCustomTopup(gbp: number): TopupResult {
  if (!Number.isFinite(gbp) || gbp < MIN_TOPUP_GBP) {
    return { ok: false, error: `Minimum top-up is £${MIN_TOPUP_GBP}.` };
  }
  return { ok: true, credits: creditsForGbp(gbp) };
}

export type ResolvedTopup =
  | { ok: true; gbp: number; credits: number }
  | { ok: false; error: string };

/** Resolve a pack id OR a custom amount into a chargeable { gbp, credits }. */
export function resolveTopupAmount(input: { packId?: string; customGbp?: number }): ResolvedTopup {
  if (input.packId) {
    const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
    if (!pack) return { ok: false, error: "Unknown credit pack." };
    return { ok: true, gbp: pack.gbp, credits: pack.credits };
  }
  if (typeof input.customGbp === "number") {
    const v = validateCustomTopup(input.customGbp);
    if (!v.ok) return v;
    return { ok: true, gbp: input.customGbp, credits: v.credits };
  }
  return { ok: false, error: "Pick a pack or enter an amount." };
}
```

- [ ] **Step 4: Run the test + commit**

Run: `npm test -- tests/billing-credit.test.ts` → PASS.

```bash
git add src/lib/billing/credit.ts tests/billing-credit.test.ts
git commit -m "feat(billing): voice credit pack catalog + top-up helpers"
```

---

### Task 2: Checkout route

**Files:**
- Create: `src/app/api/orgs/[orgId]/billing/credit/checkout/route.ts`
- Create: `tests/billing-credit-checkout.test.ts`

> Read an existing billing route (e.g. `src/app/api/orgs/[orgId]/billing/portal/route.ts`) to match `requireOrgAccess`, `blockIfDemo`, `getStripe`, and the response shape. Extract the session-params builder so it is testable without Stripe.

- [ ] **Step 1: Write the failing test**

Create `tests/billing-credit-checkout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildCreditCheckoutParams } from "@/app/api/orgs/[orgId]/billing/credit/checkout/route";

describe("buildCreditCheckoutParams", () => {
  const base = { customerId: "cus_1", tenantId: "t1", orgId: "t1", origin: "https://app.example" };

  it("pack: GBP line item with credits in metadata", () => {
    const p = buildCreditCheckoutParams({ ...base, gbp: 45, credits: 50, finalGbp: 45 });
    expect(p.mode).toBe("payment");
    expect(p.customer).toBe("cus_1");
    const li = p.line_items![0] as { price_data?: { currency?: string; unit_amount?: number }; quantity?: number };
    expect(li.price_data?.currency).toBe("gbp");
    expect(li.price_data?.unit_amount).toBe(4500); // £45
    expect(p.metadata).toMatchObject({ tenant_id: "t1", credits: "50", reason: "topup_purchase" });
  });

  it("applies a coupon discount to the charged amount but NOT the credits", () => {
    const p = buildCreditCheckoutParams({ ...base, gbp: 45, credits: 50, finalGbp: 36, couponCode: "SAVE20" });
    const li = p.line_items![0] as { price_data?: { unit_amount?: number } };
    expect(li.price_data?.unit_amount).toBe(3600); // £36 charged
    expect(p.metadata).toMatchObject({ credits: "50", coupon_code: "SAVE20" }); // still 50 credits
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/billing-credit-checkout.test.ts`
Expected: FAIL — module/export not found.

- [ ] **Step 3: Implement the route + builder**

In `src/app/api/orgs/[orgId]/billing/credit/checkout/route.ts`:

```ts
import "server-only";
import type Stripe from "stripe";
import { minorUnits } from "@/lib/billing/plan-price";

/** Pure Stripe Checkout params builder for a credit purchase. */
export function buildCreditCheckoutParams(args: {
  customerId: string;
  tenantId: string;
  orgId: string;
  origin: string;
  gbp: number;
  credits: number;
  finalGbp: number; // after coupon discount
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
```

Then the `POST` handler: `requireOrgAccess(orgId)` + `blockIfDemo`; parse `{ packId?, customGbp?, couponCode? }`; `resolveTopupAmount(...)` (400 on error); if `couponCode`, call the `validate_coupon` RPC (via the tenant's authed client) → if a percent is returned, `finalGbp = applyDiscount(gbp, percent)` else 400 "invalid coupon"; ensure the tenant has a Stripe customer (reuse existing helper / `stripe_customer_id`); `stripe.checkout.sessions.create(buildCreditCheckoutParams({...}))`; return `{ url: session.url }`. Show the full handler.

- [ ] **Step 4: Run the test + commit**

Run: `npm test -- tests/billing-credit-checkout.test.ts` → PASS. `npx tsc --noEmit` → clean.

```bash
git add "src/app/api/orgs/[orgId]/billing/credit/checkout/route.ts" tests/billing-credit-checkout.test.ts
git commit -m "feat(billing): credit top-up Stripe Checkout route"
```

---

### Task 3: Webhook grants credits

**Files:**
- Modify: `src/app/webhooks/stripe/route.ts`
- Extend: `tests/billing-credit-checkout.test.ts` (or the webhook test file)

- [ ] **Step 1: Add the failing test**

Add a webhook case (mirror the repo's mocked-event + mocked-Supabase webhook test pattern):
- `checkout.session.completed` with `metadata.reason='topup_purchase'`, `metadata.credits='50'`, `metadata.tenant_id='t1'`, a `payment_intent='pi_1'` → inserts `credit_ledger { tenant_id:'t1', delta:50, reason:'topup_purchase', unit_price_micros:900000, currency:'GBP', stripe_payment_intent_id:'pi_1' }`.
- the same event delivered twice → only ONE ledger row (idempotent on `stripe_payment_intent_id`: the handler first checks for an existing row).
- when `metadata.coupon_code` present → also inserts a `coupon_redemptions { tenant_id, applied_to:'credit_topup' }` row.

Assert against the mocked service-role client calls.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/billing-credit-checkout.test.ts`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement the handler branch**

In the Stripe webhook, add a `checkout.session.completed` case (or extend it): when `session.metadata?.reason === 'topup_purchase'`:
- `paymentIntentId = session.payment_intent` (string). If falsy, log + return 200.
- Idempotency: `select id from credit_ledger where stripe_payment_intent_id = paymentIntentId limit 1`; if found, return 200 (already granted).
- Insert `credit_ledger`: `{ tenant_id: metadata.tenant_id, delta: Number(metadata.credits), reason: 'topup_purchase', unit_price_micros: 900000, currency: 'GBP', stripe_payment_intent_id: paymentIntentId }`.
- If `metadata.coupon_code`: insert `coupon_redemptions { coupon_id: (look up by code), tenant_id, applied_to: 'credit_topup', currency: 'GBP', stripe_ref: session.id }` and increment the coupon's `times_redeemed` (service-role). Best-effort (log on failure).

Show the full handler branch.

- [ ] **Step 4: Run the test + commit**

Run the test → PASS. `npx tsc --noEmit` → clean.

```bash
git add "src/app/webhooks/stripe/route.ts" tests/billing-credit-checkout.test.ts
git commit -m "feat(billing): grant voice credits to credit_ledger on checkout completion"
```

---

### Task 4: Dashboard credit panel

**Files:**
- Modify: `src/app/dashboard/billing/page.tsx`
- Create: `src/components/dashboard/credit-topup.tsx`

> Read the current billing page to match its data-loading (server component, tenant client) and styling.

- [ ] **Step 1: Server data**

In `dashboard/billing/page.tsx` (server), load:
- credit balance: call the `credit_balance` RPC for the tenant (authed client), default 0.
- remaining plan calls: read `voice_subscriptions.monthly_call_allowance` and the current `voice_calls` `usage_counters.used`; `remaining = max(0, allowance - used)`. If the tenant has no voice subscription, omit the voice panel.
Pass these to the client component.

- [ ] **Step 2: Client buy UI**

Create `src/components/dashboard/credit-topup.tsx` (`"use client"`): renders the balance, remaining plan calls, the three `CREDIT_PACKS` as buttons, a custom-amount input (min £9) with live `creditsForGbp` preview, and an optional coupon-code field. On submit, `POST` to `/api/orgs/{orgId}/billing/credit/checkout` with the selection and `window.location = url` on success. Show validation for < £9 using `validateCustomTopup`. Show the full component; match dashboard styling.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` + `npm run lint` (clean). `npm run dev`, open `/dashboard/billing` for a voice tenant; confirm the balance, remaining calls, packs, custom-amount preview (£18 → "20 credits"), and that clicking a pack hits the checkout route.

```bash
git add "src/app/dashboard/billing/page.tsx" src/components/dashboard/credit-topup.tsx
git commit -m "feat(dashboard): voice credit balance + top-up purchase panel"
```

---

## Self-Review

**Spec coverage:** packs + custom (min £9) (Task 1); Stripe Checkout with `metadata.credits`, coupon discounts price not credits (Task 2 `buildCreditCheckoutParams`); webhook grants exactly metadata.credits, idempotent, records redemption (Task 3); dashboard shows balance + remaining plan calls + buy UI (Task 4). ✓

**Placeholder scan:** Route handler (Task 2 Step 3), webhook branch (Task 3 Step 3), and client UI (Task 4 Step 2) are "show the full implementation" around fully-tested pure functions (`resolveTopupAmount`, `buildCreditCheckoutParams`, `creditsForGbp`), with exact request/response, exact ledger insert fields, and exact UI elements enumerated. ✓

**Type consistency:** `CREDIT_PACKS`/`CreditPack`, `creditsForGbp`, `validateCustomTopup`/`TopupResult`, `resolveTopupAmount`/`ResolvedTopup`, `buildCreditCheckoutParams`, and the `metadata` shape (`reason='topup_purchase'`, `credits`, `coupon_code`) are consistent across helper, route, webhook, UI, and tests. `unit_price_micros=900000` matches £0.90. ✓
