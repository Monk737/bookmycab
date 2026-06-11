# B3 — New-Model Stripe Charge Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Stripe charges for a new-model tenant — a one-time GBP setup invoice + two rolling-monthly GBP subscriptions (chat + voice) via a separate "Start billing" admin action — and sync Stripe state back onto `chat_subscriptions` / `voice_subscriptions`, resetting the voice call pool on each `invoice.paid`.

**Architecture:** Add GBP param builders to `src/lib/billing/plan-price.ts` (alongside the legacy ones). Add a `startNewModelBilling` server action that builds a setup invoice + one subscription per product and stores the Stripe ids on the subscription rows. Extend the Stripe webhook to route new-model subscription events (tagged by `metadata.product`) to the right table and open a fresh `usage_counters` voice-calls period on voice `invoice.paid`.

**Tech Stack:** Stripe Node SDK, Next.js server actions, Supabase service-role client, Vitest with a mocked Stripe client.

**Spec:** `docs/superpowers/specs/2026-06-10-b3-new-model-stripe-charges-design.md`
**Depends on:** B1 (schema), B2 (provisioning writes the subscription rows with `monthly_price_gbp`).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/billing/plan-price.ts` | Add `buildNewSetupInvoiceItemParams`, `buildProductSubscriptionParams` | Modify (append) |
| `src/app/admin/tenants/[tenantId]/billing-actions.ts` | Add `startNewModelBilling` | Modify |
| `src/lib/billing/event-map.ts` | Add new-model subscription→row mapper | Modify |
| `src/app/webhooks/stripe/route.ts` | Route new-model events + voice pool reset | Modify |
| `src/app/admin/tenants/[tenantId]/*` (detail UI) | "Start billing" button for new-model onboarding tenants | Modify |
| `tests/billing-new-model-stripe.test.ts` | Builders + event mapper unit tests | Create |
| `tests/admin-start-billing.test.ts` | `startNewModelBilling` with mocked Stripe | Create |

---

### Task 1: GBP Stripe param builders

**Files:**
- Modify: `src/lib/billing/plan-price.ts` (append; do not change legacy builders)
- Create: `tests/billing-new-model-stripe.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/billing-new-model-stripe.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildNewSetupInvoiceItemParams,
  buildProductSubscriptionParams,
} from "@/lib/billing/plan-price";

describe("buildNewSetupInvoiceItemParams", () => {
  it("GBP minor units, correct customer + description", () => {
    const p = buildNewSetupInvoiceItemParams({ customerId: "cus_1", setupGbp: 1500, tenantId: "t1" });
    expect(p.customer).toBe("cus_1");
    expect(p.amount).toBe(150000); // 1500 * 100
    expect(p.currency).toBe("gbp");
    expect(p.metadata).toMatchObject({ tenant_id: "t1" });
  });
});

describe("buildProductSubscriptionParams", () => {
  it("rolling-monthly GBP sub tagged with product metadata", () => {
    const p = buildProductSubscriptionParams({
      customerId: "cus_1", productId: "prod_x", product: "voice", monthlyGbp: 1599, tenantId: "t1",
    });
    expect(p.customer).toBe("cus_1");
    const item = (p.items as Array<{ price_data?: { currency?: string; unit_amount?: number; recurring?: { interval?: string }; product?: string } }>)[0];
    expect(item.price_data?.currency).toBe("gbp");
    expect(item.price_data?.unit_amount).toBe(159900); // 1599 * 100
    expect(item.price_data?.recurring?.interval).toBe("month");
    expect(item.price_data?.product).toBe("prod_x");
    expect(p.metadata).toMatchObject({ tenant_id: "t1", product: "voice" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/billing-new-model-stripe.test.ts`
Expected: FAIL — builders not exported.

- [ ] **Step 3: Append the builders to `src/lib/billing/plan-price.ts`**

(`minorUnits` already exists in this file — reuse it.) Add:

```ts
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
```

- [ ] **Step 4: Run the test + commit**

Run: `npm test -- tests/billing-new-model-stripe.test.ts` → PASS.

```bash
git add src/lib/billing/plan-price.ts tests/billing-new-model-stripe.test.ts
git commit -m "feat(billing): GBP setup-invoice + rolling-monthly subscription params"
```

---

### Task 2: Event-map helper for new-model subscriptions

**Files:**
- Modify: `src/lib/billing/event-map.ts`
- Modify (extend test): `tests/billing-new-model-stripe.test.ts`

> Read `src/lib/billing/event-map.ts` first to match its style. Add a pure mapper that turns a Stripe subscription object into the row update for `chat_subscriptions` or `voice_subscriptions`, choosing the table from `metadata.product`.

- [ ] **Step 1: Add the failing test**

Append to `tests/billing-new-model-stripe.test.ts`:

```ts
import { mapNewModelSubscription } from "@/lib/billing/event-map";

describe("mapNewModelSubscription", () => {
  const sub = {
    id: "sub_123",
    status: "active",
    metadata: { tenant_id: "t1", product: "voice" },
    current_period_start: 1750000000,
    current_period_end: 1752592000,
  };
  it("routes to voice_subscriptions with mapped status + ISO periods", () => {
    const out = mapNewModelSubscription(sub as never);
    expect(out).not.toBeNull();
    expect(out!.table).toBe("voice_subscriptions");
    expect(out!.stripe_subscription_id).toBe("sub_123");
    expect(out!.update.status).toBe("active");
    expect(out!.update.current_period_start).toBe("2025-06-15"); // date portion of the unix ts
  });
  it("maps canceled → cancelled and chat product → chat_subscriptions", () => {
    const out = mapNewModelSubscription({ ...sub, status: "canceled", metadata: { tenant_id: "t1", product: "chat" } } as never);
    expect(out!.table).toBe("chat_subscriptions");
    expect(out!.update.status).toBe("cancelled");
  });
  it("returns null for a subscription without our product metadata (legacy)", () => {
    expect(mapNewModelSubscription({ id: "x", status: "active", metadata: {} } as never)).toBeNull();
  });
});
```

> Adjust the expected `"2025-06-15"` to the actual UTC date of unix `1750000000` if it differs — compute `new Date(1750000000*1000).toISOString().slice(0,10)` and use that literal.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/billing-new-model-stripe.test.ts`
Expected: FAIL — `mapNewModelSubscription` not exported.

- [ ] **Step 3: Implement the mapper**

Add to `src/lib/billing/event-map.ts`:

```ts
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
  return {
    table: product === "chat" ? "chat_subscriptions" : "voice_subscriptions",
    stripe_subscription_id: sub.id,
    update: {
      status: STRIPE_STATUS_MAP[sub.status] ?? "active",
      current_period_start: tsToDate(sub.current_period_start),
      current_period_end: tsToDate(sub.current_period_end),
    },
  };
}
```

(Ensure `import type Stripe from "stripe"` is present in the file.)

- [ ] **Step 4: Run the test + commit**

Run: `npm test -- tests/billing-new-model-stripe.test.ts` → PASS.

```bash
git add src/lib/billing/event-map.ts tests/billing-new-model-stripe.test.ts
git commit -m "feat(billing): map new-model Stripe subscriptions to chat/voice rows"
```

---

### Task 3: `startNewModelBilling` action

**Files:**
- Modify: `src/app/admin/tenants/[tenantId]/billing-actions.ts`
- Create: `tests/admin-start-billing.test.ts`

> Read the existing legacy billing action in this file first — reuse its Stripe-customer-creation helper, `getStripe`, `requireStaff`, `blockIfDemo`, audit, and `revalidatePath`. Extract the new logic so the Stripe-free decision logic is testable with an injected Stripe-like client.

- [ ] **Step 1: Write the failing test (mocked Stripe)**

Create `tests/admin-start-billing.test.ts`. Test a pure orchestrator `planNewModelCharges` that, given the tenant + its chat/voice rows, returns the list of Stripe operations to perform (so we test the decision logic without real Stripe/Supabase):

```ts
import { describe, it, expect } from "vitest";
import { planNewModelCharges } from "@/app/admin/tenants/[tenantId]/billing-actions";

const tenant = { id: "t1", commercial_model: "double_decker", stripe_customer_id: "cus_1" };

describe("planNewModelCharges", () => {
  it("plans a setup invoice + chat sub + voice sub for double_decker", () => {
    const ops = planNewModelCharges({
      tenant,
      chat: { monthly_price_gbp: 1600, stripe_subscription_id: null },
      voice: { monthly_price_gbp: 1599, stripe_subscription_id: null },
      setupGbp: 2000,
    });
    expect(ops.setup).toEqual({ setupGbp: 2000 });
    expect(ops.subscriptions).toEqual([
      { product: "chat", monthlyGbp: 1600 },
      { product: "voice", monthlyGbp: 1599 },
    ]);
  });
  it("skips a product that already has a stripe_subscription_id (idempotent)", () => {
    const ops = planNewModelCharges({
      tenant,
      chat: { monthly_price_gbp: 1600, stripe_subscription_id: "sub_existing" },
      voice: { monthly_price_gbp: 1599, stripe_subscription_id: null },
      setupGbp: 2000,
    });
    expect(ops.subscriptions).toEqual([{ product: "voice", monthlyGbp: 1599 }]);
  });
  it("voice-only tenant: no chat sub", () => {
    const ops = planNewModelCharges({
      tenant: { ...tenant, commercial_model: "voice" },
      chat: null,
      voice: { monthly_price_gbp: 1199, stripe_subscription_id: null },
      setupGbp: 1000,
    });
    expect(ops.subscriptions).toEqual([{ product: "voice", monthlyGbp: 1199 }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/admin-start-billing.test.ts`
Expected: FAIL — `planNewModelCharges` not exported.

- [ ] **Step 3: Implement `planNewModelCharges` + `startNewModelBilling`**

Add the pure planner:

```ts
export interface NewModelChargePlan {
  setup: { setupGbp: number };
  subscriptions: Array<{ product: "chat" | "voice"; monthlyGbp: number }>;
}

export function planNewModelCharges(args: {
  tenant: { id: string; commercial_model: string; stripe_customer_id: string | null };
  chat: { monthly_price_gbp: number; stripe_subscription_id: string | null } | null;
  voice: { monthly_price_gbp: number; stripe_subscription_id: string | null } | null;
  setupGbp: number;
}): NewModelChargePlan {
  const subs: NewModelChargePlan["subscriptions"] = [];
  if (args.chat && !args.chat.stripe_subscription_id)
    subs.push({ product: "chat", monthlyGbp: args.chat.monthly_price_gbp });
  if (args.voice && !args.voice.stripe_subscription_id)
    subs.push({ product: "voice", monthlyGbp: args.voice.monthly_price_gbp });
  return { setup: { setupGbp: args.setupGbp }, subscriptions: subs };
}
```

Then the `startNewModelBilling` server action (`"use server"`): `requireStaff` + `blockIfDemo`; load the tenant + its `chat_subscriptions`/`voice_subscriptions` rows + the `setup_fees` row via service-role; ensure a Stripe customer (reuse existing helper); compute `planNewModelCharges`; create the setup invoice item (`buildNewSetupInvoiceItemParams`) and finalise the invoice (reuse the legacy invoice helper); for each planned subscription, ensure a shared Stripe product id (reuse the legacy shared-product helper) then `stripe.subscriptions.create(buildProductSubscriptionParams(...))` and update the matching `chat_subscriptions`/`voice_subscriptions` row with `stripe_subscription_id` + `current_period_start/end`; set `tenants.status='active'`; audit `tenant.billing_start`; `revalidatePath`. Show the full action in your implementation.

- [ ] **Step 4: Run the test + typecheck + commit**

Run: `npm test -- tests/admin-start-billing.test.ts` → PASS. `npx tsc --noEmit` → clean.

```bash
git add "src/app/admin/tenants/[tenantId]/billing-actions.ts" tests/admin-start-billing.test.ts
git commit -m "feat(admin): start-billing action for new-model tenants"
```

---

### Task 4: Webhook routing + voice pool reset

**Files:**
- Modify: `src/app/webhooks/stripe/route.ts`
- Create/extend: a webhook handler test (mirror the repo's existing stripe webhook test, e.g. `tests/billing-webhook-route.test.ts` or `tests/billing-handle-event.test.ts` — read it first)

> Read the existing webhook handler + its test to match conventions (signature verification is already handled; you extend the event switch).

- [ ] **Step 1: Add the failing handler test**

In the webhook handler test file, add cases (using the repo's existing mocked-Supabase + constructed-event pattern):
- `customer.subscription.updated` with `metadata.product='voice'` → updates `voice_subscriptions` (matched by `stripe_subscription_id`) status + periods via `mapNewModelSubscription`.
- `invoice.paid` for a voice subscription → upserts a fresh `usage_counters` row for `feature_key='voice_calls'` with `used=0`, `limit_amount = voice_subscriptions.monthly_call_allowance`, period = the invoice's period.
- a legacy subscription event (no `metadata.product`) → still handled by the existing legacy path (unchanged).

Write the assertions against the mocked service-role client calls (`.from('voice_subscriptions').update(...)`, `.from('usage_counters').upsert(...)`), matching how the existing test asserts.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/billing-webhook-route.test.ts` (or the file you extended)
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement the routing**

In `src/app/webhooks/stripe/route.ts` event handling:
- On `customer.subscription.created|updated|deleted`: call `mapNewModelSubscription(sub)`. If non-null, `serviceClient.from(out.table).update(out.update).eq('stripe_subscription_id', out.stripe_subscription_id)` and RETURN (do not also run the legacy mirror). If null, fall through to the existing legacy `subscriptions` mirror.
- On `invoice.paid`: if the invoice's subscription is a voice new-model sub (look up `voice_subscriptions` by `stripe_subscription_id`), upsert a `usage_counters` row: `{ tenant_id, feature_key: 'voice_calls', period_start, period_end, used: 0, limit_amount: monthly_call_allowance }` (period from the invoice lines / subscription period; reuse `tsToDate`). Keep existing `invoice.paid` legacy behaviour for legacy tenants.

Show the full edited handler section in your implementation.

- [ ] **Step 4: Run the test + commit**

Run the webhook test → PASS. `npx tsc --noEmit` → clean.

```bash
git add "src/app/webhooks/stripe/route.ts" tests/billing-webhook-route.test.ts
git commit -m "feat(billing): webhook syncs new-model subs + resets voice call pool"
```

---

### Task 5: "Start billing" button on the tenant detail page

**Files:**
- Modify: the tenant detail page/component under `src/app/admin/tenants/[tenantId]/`

- [ ] **Step 1: Read the detail page** to find where legacy billing controls render and the form-action pattern.

- [ ] **Step 2: Add the control** — for a tenant with `commercial_model` set and `status='onboarding'`, render a "Start billing" button bound to `startNewModelBilling` (a `<form action={...}>` with the tenant id). Hide it once `status='active'`. Keep legacy controls for legacy tenants (`commercial_model` null).

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` + `npm run lint` (clean).

```bash
git add "src/app/admin/tenants/[tenantId]"
git commit -m "feat(admin): Start billing control for new-model tenants"
```

---

## Self-Review

**Spec coverage:** GBP setup + rolling-monthly sub builders (Task 1); two subs per bundle, idempotent skip (Task 3 `planNewModelCharges`); webhook routes by `metadata.product` + voice pool reset on `invoice.paid` (Tasks 2+4); separate Start-billing action (Tasks 3+5); legacy untouched (Tasks 4/5 fall-through). ✓

**Placeholder scan:** The action body (Task 3 Step 3) and webhook section (Task 4 Step 3) are described as "show the full implementation" around fully-specified, tested pure helpers (`planNewModelCharges`, `mapNewModelSubscription`, the builders) with exact Stripe params and exact table/field updates enumerated. No vague error-handling. ✓

**Type consistency:** `buildNewSetupInvoiceItemParams`, `buildProductSubscriptionParams`, `mapNewModelSubscription`/`NewModelSubUpdate`, `planNewModelCharges`/`NewModelChargePlan`, and `metadata.product: "chat"|"voice"` are consistent across builders, mapper, action, webhook, and tests. ✓
