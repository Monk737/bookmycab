# Epic 8 — Stripe Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Epic-3 local-data billing stubs with live Stripe: a one-time setup-fee invoice, a monthly subscription started at go-live, Stripe Tax (UK VAT), a Customer Portal session API, and webhook handlers that sync Stripe back into our `subscriptions` / `setup_fees` mirrors and email on payment failure.

**Architecture:** All Stripe I/O is confined to `src/lib/billing/**` (a lazy SDK singleton) and a small set of admin server actions. Every decision that can be a pure function — price → minor units, Stripe param objects, Stripe event → mirror row, renewal date math, email body — is extracted into pure, unit-tested modules; the SDK/DB calls are thin wrappers around them. Billing milestones are **admin-mediated** (FlowMo staff trigger setup-fee invoice and subscription start from the tenant detail page); customers only get a read-only dashboard view + a Customer Portal link. Stripe is the source of truth; webhooks reconcile our local mirror tables.

**Tech Stack:** Stripe Node SDK (`stripe`), Next.js 15 route handlers (Node runtime), Supabase service-role client (cross-tenant writes bypass RLS), Redis `claimOnce` for webhook idempotency (reuses Epic-5 primitive), Resend REST API for transactional email, Vitest.

---

## Product decisions locked for this plan

| Q | Decision (confirmed 2026-06-02) | Consequence in code |
|---|---|---|
| Q4 | Setup fee is **non-refundable, manual-only** | No refund webhook/logic. `invoice.paid` marks `setup_fees.paid_at`; any refund is done by staff in the Stripe dashboard. |
| Q5 | Mid-contract upgrades **deferred — admin-driven, no proration code** | No self-serve upgrade endpoint. Staff change the subscription in Stripe; we only sync the resulting `customer.subscription.updated` webhook into the mirror. |
| Q8 (already locked) | Renewal **rolls to monthly** after the 12-month term | Subscription is a standard monthly Stripe subscription; `contract_renewal` is set to `contract_start + 12 months` for the renewal-alert view. Stripe keeps billing monthly thereafter. No `cancel_at` is set. |
| §17 | Multi-currency per tenant (GBP/EUR/USD) | Amounts come from `tenants.currency`; never summed across currencies. |
| §17 | Customer brings own AI key | No usage metering — subscription is flat monthly per plan band. |

**Brand rule (enforced by a guard test):** never expose `n8n` / `CabLab` / `workflow` / `execution` on customer-facing billing surfaces.

---

## Files created / modified

**Created — pure logic (heavily tested):**
- `src/lib/billing/plan-price.ts` — minor-unit conversion, setup-fee amount, and pure builders for Stripe subscription + setup-invoice param objects.
- `src/lib/billing/dates.ts` — `unixToIso`, `addMonthsUTC` (deterministic, no clock reads).
- `src/lib/billing/event-map.ts` — `subscriptionToMirror`, `classifyInvoice`, mirror-row type.
- `src/lib/billing/handle-event.ts` — `handleStripeEvent(event, deps)` orchestrator with injected DB/email deps.
- `src/lib/email/templates.ts` — pure `paymentFailedEmail(...)` → `{ subject, html, text }`.

**Created — thin I/O wrappers:**
- `src/lib/billing/stripe.ts` — lazy Stripe SDK singleton (`getStripe`).
- `src/lib/email/resend.ts` — `sendEmail(...)` via Resend REST; no-op-safe when unconfigured.
- `src/app/webhooks/stripe/route.ts` — POST handler: raw body → `constructEvent` → idempotency → `handleStripeEvent`.
- `src/app/admin/tenants/[tenantId]/billing-actions.ts` — `createSetupFeeInvoice`, `startSubscription`, `syncSubscription`, plus `getOrCreateStripeCustomer` / `getOrCreateProduct` helpers.
- `src/app/admin/tenants/[tenantId]/billing-panel.tsx` — staff billing controls (client component) for the tenant detail page.

**Modified:**
- `src/app/api/orgs/[orgId]/billing/portal/route.ts` — replace the 503 stub with a real Customer Portal session.
- `src/app/admin/tenants/[tenantId]/page.tsx` — render `<BillingPanel />`.
- `src/app/admin/billing/page.tsx` — wire the disabled "Manual sync" button to the new reconcile action (remove the `TODO(epic-8)` stub).
- `package.json` — add `stripe` dependency.

**Tests created:**
- `tests/billing-plan-price.test.ts`, `tests/billing-dates.test.ts`, `tests/billing-event-map.test.ts`, `tests/billing-handle-event.test.ts`, `tests/billing-email-template.test.ts`, `tests/billing-webhook-route.test.ts`, `tests/billing-structure.test.ts`.

**No new migration is required.** The `subscriptions` and `setup_fees` tables (migration 0004) and `tenants.stripe_customer_id` (0001) already hold every column this plan writes. (`setup_fees.stripe_invoice_id` already exists and is how `invoice.paid` finds the row to mark paid.)

---

## Conventions every task follows

- **`server-only` under Vitest throws** — every test that imports a module with `import "server-only"` MUST start with `vi.mock("server-only", () => ({}))` (see `tests/webhook-signatures.test.ts`). Pure modules in this plan deliberately do **not** import `server-only` so they need no mock; the I/O wrappers do.
- **Service-role writes**: admin/webhook code uses `createClient as createSupabaseJS` from `@supabase/supabase-js` with `env.SUPABASE_SERVICE_ROLE_KEY` — billing writes are cross-tenant and `audit_log`/mirror writes must bypass RLS, identical to `src/lib/admin/audit.ts`.
- **Running vitest from the main shell hangs under the sandbox** — pass `dangerouslyDisableSandbox: true` on the Bash call (or run inside a subagent, which is unsandboxed).
- **Package manager is `pnpm`.**
- **Commit after every task** with a `feat(billing):` / `test(billing):` message.

---

### Task 1: Stripe SDK dependency + lazy client singleton

**Files:**
- Modify: `package.json` (add `stripe`)
- Create: `src/lib/billing/stripe.ts`
- Test: `tests/billing-structure.test.ts` (seed it here; later tasks append)

- [ ] **Step 1: Add the Stripe SDK**

Run:
```bash
pnpm add stripe
```
Expected: `package.json` gains `"stripe": "^17.x"` (or newer) under `dependencies`; `pnpm-lock.yaml` updates.

- [ ] **Step 2: Write the lazy Stripe singleton**

Create `src/lib/billing/stripe.ts`:
```ts
import "server-only";
import Stripe from "stripe";
import { env } from "@/env";

/**
 * Lazy Stripe SDK singleton.
 *
 * `STRIPE_SECRET_KEY` is optional in `env.ts` (so the app boots in envs without
 * billing configured). Any code path that actually needs Stripe calls
 * `getStripe()`, which throws a clear error when the key is absent rather than
 * letting the SDK fail obscurely. The instance is cached across calls.
 *
 * We deliberately do NOT pin `apiVersion` — the account default is used, which
 * keeps us off a hard-coded version string that the installed SDK types might
 * not match.
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");
  }
  cached = new Stripe(key);
  return cached;
}

/** Test seam: clear the cached instance. */
export function __resetStripeForTests(): void {
  cached = null;
}
```

- [ ] **Step 3: Seed the structure guard test**

Create `tests/billing-structure.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const p = (rel: string) => join(process.cwd(), rel);

describe("epic-8 billing files exist", () => {
  for (const f of [
    "src/lib/billing/stripe.ts",
    "src/lib/billing/plan-price.ts",
    "src/lib/billing/dates.ts",
    "src/lib/billing/event-map.ts",
    "src/lib/billing/handle-event.ts",
    "src/lib/email/resend.ts",
    "src/lib/email/templates.ts",
    "src/app/webhooks/stripe/route.ts",
    "src/app/admin/tenants/[tenantId]/billing-actions.ts",
  ]) {
    it(`exists: ${f}`, () => expect(existsSync(p(f)), f).toBe(true));
  }
});
```

- [ ] **Step 4: Run the structure test (expect partial failure)**

Run: `pnpm test billing-structure` (Bash with `dangerouslyDisableSandbox: true`)
Expected: FAIL — only `stripe.ts` exists; the other paths are created in later tasks. This is the intended red state; do not create stubs to silence it. (If you prefer green-per-task, comment out the not-yet-created paths and uncomment them in their task. Either is acceptable; note it in the commit.)

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (the new file compiles against the installed `stripe` types).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/billing/stripe.ts tests/billing-structure.test.ts
git commit -m "feat(billing): add stripe SDK + lazy client singleton"
```

---

### Task 2: Pure pricing → Stripe param builders

**Files:**
- Create: `src/lib/billing/plan-price.ts`
- Test: `tests/billing-plan-price.test.ts`

This module turns our PRD pricing (major-unit pounds/euros/dollars) into Stripe minor units and into the exact param objects the admin actions will pass to Stripe. Keeping the param shape here makes the I/O actions trivial and lets us test the money math without touching Stripe.

- [ ] **Step 1: Write the failing test**

Create `tests/billing-plan-price.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  minorUnits,
  fromMinor,
  setupFeeMinor,
  buildSubscriptionCreateParams,
  buildSetupInvoiceItemParams,
} from "@/lib/billing/plan-price";

describe("minorUnits / fromMinor", () => {
  it("converts major→minor with rounding", () => {
    expect(minorUnits(500)).toBe(50000);
    expect(minorUnits(1000)).toBe(100000);
    expect(minorUnits(12.34)).toBe(1234);
  });
  it("round-trips", () => {
    expect(fromMinor(50000)).toBe(500);
    expect(fromMinor(1234)).toBe(12.34);
  });
});

describe("setupFeeMinor", () => {
  it("uses the PRD setup fee per currency, in minor units", () => {
    expect(setupFeeMinor("GBP")).toBe(100000); // £1,000
    expect(setupFeeMinor("USD")).toBe(120000); // $1,200
  });
});

describe("buildSetupInvoiceItemParams", () => {
  it("builds a one-time invoice item in lowercase currency", () => {
    const params = buildSetupInvoiceItemParams({
      customerId: "cus_123",
      currency: "GBP",
    });
    expect(params).toMatchObject({
      customer: "cus_123",
      amount: 100000,
      currency: "gbp",
    });
    expect(params.description).toMatch(/setup/i);
  });
});

describe("buildSubscriptionCreateParams", () => {
  it("builds a monthly subscription with inline price_data + tax + metadata", () => {
    const params = buildSubscriptionCreateParams({
      customerId: "cus_123",
      productId: "prod_abc",
      band: "A-Single",
      currency: "GBP",
      tenantId: "11111111-1111-1111-1111-111111111111",
    });
    const item = (params.items ?? [])[0];
    expect(item?.price_data).toMatchObject({
      currency: "gbp",
      product: "prod_abc",
      unit_amount: 50000,
      recurring: { interval: "month" },
    });
    expect(params.automatic_tax).toEqual({ enabled: true });
    expect(params.metadata).toMatchObject({
      tenant_id: "11111111-1111-1111-1111-111111111111",
      plan_band: "A-Single",
    });
  });

  it("refuses Custom (no fixed price — quoted manually)", () => {
    expect(() =>
      buildSubscriptionCreateParams({
        customerId: "cus_123",
        productId: "prod_abc",
        band: "Custom",
        currency: "GBP",
        tenantId: "11111111-1111-1111-1111-111111111111",
      }),
    ).toThrow(/custom/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test billing-plan-price` (`dangerouslyDisableSandbox: true`)
Expected: FAIL with "Cannot find module '@/lib/billing/plan-price'".

- [ ] **Step 3: Write the implementation**

Create `src/lib/billing/plan-price.ts`:
```ts
import type Stripe from "stripe";
import { SETUP_FEE, type Currency } from "@/lib/marketing/pricing";
import { planBandMonthlyPrice, type PlanBand } from "@/lib/admin/plan-bands";

/**
 * Pure pricing helpers + Stripe param builders.
 *
 * No I/O, no `server-only` — safe to import anywhere and unit-test directly.
 * Money: PRD prices are MAJOR units (whole pounds/euros/dollars, 2-dp max);
 * Stripe wants MINOR units (pence/cents). GBP/EUR/USD are all 2-decimal
 * currencies, so the factor is always 100.
 */

/** Major → minor units (×100, rounded to avoid float dust). */
export function minorUnits(major: number): number {
  return Math.round(major * 100);
}

/** Minor → major units. */
export function fromMinor(minor: number): number {
  return Math.round(minor) / 100;
}

/** The one-time setup fee for a currency, in minor units (PRD §6.1). */
export function setupFeeMinor(currency: Currency): number {
  return minorUnits(SETUP_FEE[currency]);
}

/** Params for the one-time setup-fee invoice item (legacy amount form — no
 *  product catalog entry needed for a one-off charge). */
export function buildSetupInvoiceItemParams(args: {
  customerId: string;
  currency: Currency;
}): Stripe.InvoiceItemCreateParams {
  return {
    customer: args.customerId,
    amount: setupFeeMinor(args.currency),
    currency: args.currency.toLowerCase(),
    description: "BookMyCab automation — one-time setup fee",
  };
}

/** Params for the monthly subscription. Uses inline `price_data` against a
 *  shared product so we don't maintain a per-band Stripe price catalog.
 *  Throws for Custom (null price — those are quoted and started manually). */
export function buildSubscriptionCreateParams(args: {
  customerId: string;
  productId: string;
  band: PlanBand;
  currency: Currency;
  tenantId: string;
}): Stripe.SubscriptionCreateParams {
  const major = planBandMonthlyPrice(args.band, args.currency);
  if (major == null) {
    throw new Error(
      `Cannot build a subscription for Custom band (no fixed price). Configure it manually in Stripe.`,
    );
  }
  return {
    customer: args.customerId,
    automatic_tax: { enabled: true },
    items: [
      {
        price_data: {
          currency: args.currency.toLowerCase(),
          product: args.productId,
          unit_amount: minorUnits(major),
          recurring: { interval: "month" },
        },
      },
    ],
    metadata: {
      tenant_id: args.tenantId,
      plan_band: args.band,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test billing-plan-price` (`dangerouslyDisableSandbox: true`)
Expected: PASS (all cases green).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/billing/plan-price.ts tests/billing-plan-price.test.ts
git commit -m "feat(billing): pure pricing + Stripe param builders"
```

---

### Task 3: Pure date math + Stripe event → mirror mapping

**Files:**
- Create: `src/lib/billing/dates.ts`
- Create: `src/lib/billing/event-map.ts`
- Test: `tests/billing-dates.test.ts`
- Test: `tests/billing-event-map.test.ts`

- [ ] **Step 1: Write the failing date test**

Create `tests/billing-dates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { unixToIso, addMonthsUTC } from "@/lib/billing/dates";

describe("unixToIso", () => {
  it("converts unix seconds to an ISO string", () => {
    expect(unixToIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(unixToIso(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
  });
  it("returns null for null/undefined", () => {
    expect(unixToIso(null)).toBeNull();
    expect(unixToIso(undefined)).toBeNull();
  });
});

describe("addMonthsUTC", () => {
  it("adds whole months and returns a date-only string", () => {
    expect(addMonthsUTC("2026-06-02", 12)).toBe("2027-06-02");
    expect(addMonthsUTC("2026-01-15", 1)).toBe("2026-02-15");
  });
  it("clamps to the last day when the target month is shorter", () => {
    // 31 Jan + 1 month → 28 Feb (2026 is not a leap year)
    expect(addMonthsUTC("2026-01-31", 1)).toBe("2026-02-28");
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `pnpm test billing-dates` (`dangerouslyDisableSandbox: true`)
Expected: FAIL — "Cannot find module '@/lib/billing/dates'".

- [ ] **Step 3: Implement the date helpers**

Create `src/lib/billing/dates.ts`:
```ts
/**
 * Pure date helpers for billing. No clock reads — callers pass the date in — so
 * renewal math is deterministic and testable. All UTC.
 */

/** Stripe period timestamps are unix SECONDS. Convert to an ISO string, or null. */
export function unixToIso(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  return new Date(seconds * 1000).toISOString();
}

/**
 * Add `months` to a date-only string (`YYYY-MM-DD`) in UTC, clamping to the last
 * day of the target month when needed (31 Jan + 1mo → 28/29 Feb). Returns a
 * date-only string.
 */
export function addMonthsUTC(dateOnly: string, months: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  // Last day of the target month (day 0 of the next month).
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  const out = new Date(Date.UTC(targetYear, targetMonth, day));
  return out.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run the date test (expect pass)**

Run: `pnpm test billing-dates` (`dangerouslyDisableSandbox: true`)
Expected: PASS.

- [ ] **Step 5: Write the failing event-map test**

Create `tests/billing-event-map.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { subscriptionToMirror, classifyInvoice } from "@/lib/billing/event-map";
import type Stripe from "stripe";

function fakeSubscription(over: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: "sub_123",
    status: "active",
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_592_000,
    cancel_at: null,
    metadata: { tenant_id: "tnt-1", plan_band: "A-Single" },
    items: {
      data: [
        {
          price: { unit_amount: 50000, currency: "gbp" },
        } as unknown as Stripe.SubscriptionItem,
      ],
    },
    ...over,
  } as unknown as Stripe.Subscription;
}

describe("subscriptionToMirror", () => {
  it("maps a Stripe subscription to a subscriptions-row", () => {
    const row = subscriptionToMirror(fakeSubscription());
    expect(row).toMatchObject({
      tenant_id: "tnt-1",
      stripe_sub_id: "sub_123",
      plan_band: "A-Single",
      monthly_price: 500, // 50000 minor → 500 major
      currency: "GBP",
      status: "active",
      current_period_start: "2023-11-14T22:13:20.000Z",
      current_period_end: "2023-12-14T21:33:20.000Z",
      cancel_at: null,
    });
  });

  it("returns null tenant_id when metadata is missing (caller skips)", () => {
    const row = subscriptionToMirror(fakeSubscription({ metadata: {} }));
    expect(row.tenant_id).toBeNull();
  });

  it("maps cancel_at when set", () => {
    const row = subscriptionToMirror(fakeSubscription({ cancel_at: 1_702_592_000 }));
    expect(row.cancel_at).toBe("2023-12-14T21:33:20.000Z");
  });
});

describe("classifyInvoice", () => {
  it("flags a one-time setup invoice (no subscription, has billing_reason)", () => {
    const inv = { id: "in_1", subscription: null, billing_reason: "manual" } as unknown as Stripe.Invoice;
    expect(classifyInvoice(inv)).toBe("setup");
  });
  it("flags a subscription invoice", () => {
    const inv = { id: "in_2", subscription: "sub_123", billing_reason: "subscription_cycle" } as unknown as Stripe.Invoice;
    expect(classifyInvoice(inv)).toBe("subscription");
  });
});
```

- [ ] **Step 6: Run it (expect fail)**

Run: `pnpm test billing-event-map` (`dangerouslyDisableSandbox: true`)
Expected: FAIL — "Cannot find module '@/lib/billing/event-map'".

- [ ] **Step 7: Implement the event mapping**

Create `src/lib/billing/event-map.ts`:
```ts
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
    current_period_start: unixToIso(sub.current_period_start),
    current_period_end: unixToIso(sub.current_period_end),
    cancel_at: unixToIso(sub.cancel_at),
  };
}

/** Distinguish a one-time setup-fee invoice from a subscription invoice. A
 *  setup invoice has no `subscription` reference. */
export function classifyInvoice(invoice: Stripe.Invoice): "setup" | "subscription" {
  return invoice.subscription ? "subscription" : "setup";
}
```

- [ ] **Step 8: Run both tests (expect pass)**

Run: `pnpm test billing-dates billing-event-map` (`dangerouslyDisableSandbox: true`)
Expected: PASS.

- [ ] **Step 9: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/billing/dates.ts src/lib/billing/event-map.ts tests/billing-dates.test.ts tests/billing-event-map.test.ts
git commit -m "feat(billing): pure date math + Stripe event→mirror mapping"
```

---

### Task 4: Resend email helper + payment-failed template

**Files:**
- Create: `src/lib/email/templates.ts` (pure)
- Create: `src/lib/email/resend.ts` (thin I/O)
- Test: `tests/billing-email-template.test.ts`

The `invoice.payment_failed` webhook emails ops + the customer. No Resend integration exists yet (Epic 3 left it as a `TODO(resend)` no-op), so we build a minimal sender here. Keep the body pure and tested; the sender is a thin fetch wrapper that is a safe no-op when `RESEND_API_KEY` is absent.

- [ ] **Step 1: Write the failing template test**

Create `tests/billing-email-template.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { paymentFailedEmail } from "@/lib/email/templates";

describe("paymentFailedEmail", () => {
  const out = paymentFailedEmail({
    tenantName: "Speedy Cabs",
    amountMajor: 500,
    currency: "GBP",
    invoiceUrl: "https://invoice.stripe.com/i/abc",
  });

  it("has a clear subject naming the tenant", () => {
    expect(out.subject).toMatch(/Speedy Cabs/);
    expect(out.subject).toMatch(/payment/i);
  });
  it("includes the formatted amount and a pay link", () => {
    expect(out.html).toMatch(/£500/);
    expect(out.html).toMatch(/https:\/\/invoice\.stripe\.com\/i\/abc/);
    expect(out.text).toMatch(/£500/);
  });
  it("never leaks internal vocabulary (brand rule)", () => {
    const banned = /\bn8n\b|\bCabLab\b|\bworkflow\b|\bexecution\b/i;
    expect(out.subject).not.toMatch(banned);
    expect(out.html).not.toMatch(banned);
    expect(out.text).not.toMatch(banned);
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `pnpm test billing-email-template` (`dangerouslyDisableSandbox: true`)
Expected: FAIL — "Cannot find module '@/lib/email/templates'".

- [ ] **Step 3: Implement the template**

Create `src/lib/email/templates.ts`:
```ts
import { formatPrice, type Currency } from "@/lib/marketing/pricing";

/** Pure email bodies. No I/O. Used by the billing webhook. */
export interface EmailBody {
  subject: string;
  html: string;
  text: string;
}

export function paymentFailedEmail(args: {
  tenantName: string;
  amountMajor: number;
  currency: Currency;
  invoiceUrl: string | null;
}): EmailBody {
  const amount = formatPrice(args.currency, args.amountMajor);
  const subject = `Action needed: payment failed for ${args.tenantName}`;
  const payLine = args.invoiceUrl
    ? `Please update your payment method: ${args.invoiceUrl}`
    : `Please contact your BookMyCab account manager to resolve this.`;
  const payHtml = args.invoiceUrl
    ? `<p><a href="${args.invoiceUrl}">Update your payment method</a></p>`
    : `<p>Please contact your BookMyCab account manager to resolve this.</p>`;

  const text = [
    `Hi ${args.tenantName},`,
    ``,
    `We were unable to collect your latest BookMyCab payment of ${amount}.`,
    `Your automation keeps running — there is no interruption — but please`,
    `resolve the payment to avoid any future disruption.`,
    ``,
    payLine,
    ``,
    `— The BookMyCab team`,
  ].join("\n");

  const html = [
    `<p>Hi ${args.tenantName},</p>`,
    `<p>We were unable to collect your latest BookMyCab payment of <strong>${amount}</strong>.`,
    ` Your automation keeps running — there is no interruption — but please resolve`,
    ` the payment to avoid any future disruption.</p>`,
    payHtml,
    `<p>— The BookMyCab team</p>`,
  ].join("");

  return { subject, html, text };
}
```

- [ ] **Step 4: Run the template test (expect pass)**

Run: `pnpm test billing-email-template` (`dangerouslyDisableSandbox: true`)
Expected: PASS.

- [ ] **Step 5: Implement the Resend sender (thin I/O, no-op-safe)**

Create `src/lib/email/resend.ts`:
```ts
import "server-only";
import { env } from "@/env";

/**
 * Minimal Resend transactional-email sender.
 *
 * No-op-safe: when `RESEND_API_KEY` is absent (local/dev/test) it logs and
 * returns false instead of throwing, so a billing webhook never 500s purely
 * because email is unconfigured. Returns true only on a 2xx from Resend.
 *
 * `fetchImpl` is injectable for tests.
 */
export async function sendEmail(
  args: { to: string | string[]; subject: string; html: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn("sendEmail: RESEND_API_KEY missing — skipping", { subject: args.subject });
    return false;
  }
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: Array.isArray(args.to) ? args.to : [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      console.error("sendEmail: Resend returned non-2xx", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendEmail threw", err);
    return false;
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/email/templates.ts src/lib/email/resend.ts tests/billing-email-template.test.ts
git commit -m "feat(billing): Resend sender + payment-failed email template"
```

---

### Task 5: Pure Stripe-event orchestrator (`handleStripeEvent`)

**Files:**
- Create: `src/lib/billing/handle-event.ts`
- Test: `tests/billing-handle-event.test.ts`

This is the heart of the webhook: given a parsed Stripe event and an injected set of DB/email operations, decide what to do. It is pure-of-Stripe-SDK and DB (deps are injected), so we can test every branch with fakes.

- [ ] **Step 1: Write the failing test**

Create `tests/billing-handle-event.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { handleStripeEvent, type BillingDeps } from "@/lib/billing/handle-event";
import type Stripe from "stripe";

function deps(over: Partial<BillingDeps> = {}): BillingDeps {
  return {
    upsertSubscription: vi.fn(async () => {}),
    markSetupFeePaid: vi.fn(async () => ({ tenantName: "Speedy Cabs", currency: "GBP" as const })),
    sendPaymentFailedEmail: vi.fn(async () => {}),
    ...over,
  };
}

function subEvent(type: string): Stripe.Event {
  return {
    id: "evt_1",
    type,
    data: {
      object: {
        id: "sub_123",
        status: "active",
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
        cancel_at: null,
        metadata: { tenant_id: "tnt-1", plan_band: "A-Single" },
        items: { data: [{ price: { unit_amount: 50000, currency: "gbp" } }] },
      },
    },
  } as unknown as Stripe.Event;
}

describe("handleStripeEvent", () => {
  it("upserts the mirror on customer.subscription.updated", async () => {
    const d = deps();
    const res = await handleStripeEvent(subEvent("customer.subscription.updated"), d);
    expect(d.upsertSubscription).toHaveBeenCalledOnce();
    expect(res.action).toBe("subscription.upserted");
  });

  it("skips a subscription with no tenant_id metadata", async () => {
    const ev = subEvent("customer.subscription.created");
    (ev.data.object as { metadata: Record<string, string> }).metadata = {};
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.upsertSubscription).not.toHaveBeenCalled();
    expect(res.action).toBe("skipped");
  });

  it("marks the setup fee paid on invoice.paid for a setup invoice", async () => {
    const ev = {
      id: "evt_2",
      type: "invoice.paid",
      data: { object: { id: "in_1", subscription: null, billing_reason: "manual", amount_paid: 100000, currency: "gbp" } },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.markSetupFeePaid).toHaveBeenCalledWith("in_1");
    expect(res.action).toBe("setup_fee.paid");
  });

  it("does not mark a setup fee for a subscription invoice.paid", async () => {
    const ev = {
      id: "evt_3",
      type: "invoice.paid",
      data: { object: { id: "in_2", subscription: "sub_123", billing_reason: "subscription_cycle" } },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.markSetupFeePaid).not.toHaveBeenCalled();
    expect(res.action).toBe("logged");
  });

  it("emails on invoice.payment_failed but never suspends", async () => {
    const ev = {
      id: "evt_4",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_3",
          subscription: "sub_123",
          amount_due: 50000,
          currency: "gbp",
          hosted_invoice_url: "https://invoice.stripe.com/i/abc",
          customer_email: "owner@speedycabs.test",
        },
      },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.sendPaymentFailedEmail).toHaveBeenCalledOnce();
    expect(res.action).toBe("payment_failed.notified");
  });

  it("ignores unhandled event types", async () => {
    const ev = { id: "evt_5", type: "customer.created", data: { object: {} } } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(res.action).toBe("ignored");
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `pnpm test billing-handle-event` (`dangerouslyDisableSandbox: true`)
Expected: FAIL — "Cannot find module '@/lib/billing/handle-event'".

- [ ] **Step 3: Implement the orchestrator**

Create `src/lib/billing/handle-event.ts`:
```ts
import type Stripe from "stripe";
import type { Currency } from "@/lib/marketing/pricing";
import { subscriptionToMirror, classifyInvoice, type SubscriptionMirrorRow } from "@/lib/billing/event-map";
import { fromMinor } from "@/lib/billing/plan-price";

/**
 * Injected side-effect operations. The webhook route supplies real (service-role
 * DB + Resend) implementations; tests supply fakes. This keeps the decision
 * logic pure and fully branch-testable.
 */
export interface BillingDeps {
  /** Upsert a subscriptions mirror row (onConflict stripe_sub_id). */
  upsertSubscription(row: SubscriptionMirrorRow): Promise<void>;
  /** Mark the setup_fees row for this Stripe invoice id as paid; return tenant
   *  display info for any follow-up (or null when no matching row). */
  markSetupFeePaid(stripeInvoiceId: string): Promise<{ tenantName: string; currency: Currency } | null>;
  /** Email ops + the customer that a subscription payment failed. */
  sendPaymentFailedEmail(info: {
    customerEmail: string | null;
    amountMajor: number;
    currency: Currency;
    invoiceUrl: string | null;
  }): Promise<void>;
}

export interface StripeEventResult {
  action:
    | "subscription.upserted"
    | "setup_fee.paid"
    | "payment_failed.notified"
    | "logged"
    | "skipped"
    | "ignored";
}

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: BillingDeps,
): Promise<StripeEventResult> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const row = subscriptionToMirror(sub);
      if (!row.tenant_id) return { action: "skipped" };
      await deps.upsertSubscription(row);
      return { action: "subscription.upserted" };
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (classifyInvoice(invoice) === "setup") {
        await deps.markSetupFeePaid(invoice.id);
        return { action: "setup_fee.paid" };
      }
      // Subscription cycle payment — Stripe is the ledger; nothing to mirror
      // beyond the subscription row we already keep. Just acknowledge.
      return { action: "logged" };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const amountMinor = invoice.amount_due ?? 0;
      await deps.sendPaymentFailedEmail({
        customerEmail: invoice.customer_email ?? null,
        amountMajor: fromMinor(amountMinor),
        currency: (invoice.currency ?? "gbp").toUpperCase() as Currency,
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      });
      // DECISION (Q-payment-failed): NO auto-suspend. The automation keeps
      // running; we only notify. Recovery is dunning (Stripe) + manual follow-up.
      return { action: "payment_failed.notified" };
    }

    default:
      return { action: "ignored" };
  }
}
```

- [ ] **Step 4: Run the test (expect pass)**

Run: `pnpm test billing-handle-event` (`dangerouslyDisableSandbox: true`)
Expected: PASS (all six cases).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/billing/handle-event.ts tests/billing-handle-event.test.ts
git commit -m "feat(billing): pure Stripe-event orchestrator with injected deps"
```

---

### Task 6: Stripe webhook route `/webhooks/stripe`

**Files:**
- Create: `src/app/webhooks/stripe/route.ts`
- Test: `tests/billing-webhook-route.test.ts`

The route verifies the Stripe signature over the **raw** body, dedupes on `event.id` via Redis `claimOnce`, builds the real `BillingDeps` (service-role DB + Resend), and delegates to `handleStripeEvent`. It always returns 200 on a handled event and 400 only on a signature/parse failure.

- [ ] **Step 1: Write the failing route test**

Create `tests/billing-webhook-route.test.ts`. We mock the Stripe singleton (so `constructEvent` is controllable), Redis idempotency, and the deps-builder so the test stays pure:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Controllable Stripe.constructEvent.
const constructEvent = vi.fn();
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

// Controllable idempotency.
const claimOnce = vi.fn(async () => true);
vi.mock("@/lib/redis/idempotency", () => ({ claimOnce: (k: string, t: number) => claimOnce(k, t) }));

// Spy on the orchestrator + deps builder so the route logic is isolated.
const handleStripeEvent = vi.fn(async () => ({ action: "ignored" as const }));
vi.mock("@/lib/billing/handle-event", () => ({ handleStripeEvent }));
vi.mock("@/lib/billing/webhook-deps", () => ({ buildBillingDeps: () => ({}) }));

// env needs the webhook secret present.
vi.mock("@/env", () => ({ env: { STRIPE_WEBHOOK_SECRET: "whsec_test" } }));

import { POST } from "@/app/webhooks/stripe/route";

function req(body: string, sig: string | null): Request {
  const headers = new Headers();
  if (sig !== null) headers.set("stripe-signature", sig);
  return new Request("https://x/webhooks/stripe", { method: "POST", body, headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  claimOnce.mockResolvedValue(true);
  handleStripeEvent.mockResolvedValue({ action: "ignored" });
});

describe("POST /webhooks/stripe", () => {
  it("400s when the signature header is missing", async () => {
    const res = await POST(req("{}", null));
    expect(res.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("400s when constructEvent throws (bad signature)", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(req("{}", "t=1,v1=deadbeef"));
    expect(res.status).toBe(400);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });

  it("dispatches a verified event and 200s", async () => {
    constructEvent.mockReturnValue({ id: "evt_9", type: "invoice.paid", data: { object: {} } });
    const res = await POST(req("{}", "t=1,v1=good"));
    expect(res.status).toBe(200);
    expect(handleStripeEvent).toHaveBeenCalledOnce();
  });

  it("skips a duplicate event id (idempotency) and still 200s", async () => {
    constructEvent.mockReturnValue({ id: "evt_9", type: "invoice.paid", data: { object: {} } });
    claimOnce.mockResolvedValue(false);
    const res = await POST(req("{}", "t=1,v1=good"));
    expect(res.status).toBe(200);
    expect(handleStripeEvent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it (expect fail)**

Run: `pnpm test billing-webhook-route` (`dangerouslyDisableSandbox: true`)
Expected: FAIL — route module + `webhook-deps` module not found.

- [ ] **Step 3: Implement the deps builder (real service-role + Resend wiring)**

Create `src/lib/billing/webhook-deps.ts`:
```ts
import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import type { BillingDeps } from "@/lib/billing/handle-event";
import { sendEmail } from "@/lib/email/resend";
import { paymentFailedEmail } from "@/lib/email/templates";
import type { Currency } from "@/lib/marketing/pricing";

/**
 * Real `BillingDeps` for the webhook: service-role DB writes (billing mirrors
 * are cross-tenant + RLS-protected, so the service-role key is required) and
 * Resend email. Built per-request so there's no shared mutable client.
 */
export function buildBillingDeps(): BillingDeps {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    async upsertSubscription(row) {
      const { error } = await db
        .from("subscriptions")
        .upsert(row, { onConflict: "stripe_sub_id" });
      if (error) console.error("upsertSubscription failed", error);
    },

    async markSetupFeePaid(stripeInvoiceId) {
      // Mark the fee paid; resolve the tenant for the return value.
      const { data: fee, error } = await db
        .from("setup_fees")
        .update({ paid_at: new Date().toISOString() })
        .eq("stripe_invoice_id", stripeInvoiceId)
        .select("tenant_id, currency")
        .maybeSingle();
      if (error) {
        console.error("markSetupFeePaid failed", error);
        return null;
      }
      if (!fee) return null;
      const tenantId = (fee as { tenant_id: string }).tenant_id;
      await db.from("tenants").update({ setup_fee_paid: true }).eq("id", tenantId);
      const { data: tenant } = await db
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .maybeSingle();
      return {
        tenantName: (tenant as { name?: string } | null)?.name ?? "your organisation",
        currency: ((fee as { currency?: string }).currency ?? "GBP") as Currency,
      };
    },

    async sendPaymentFailedEmail(info) {
      const body = paymentFailedEmail({
        tenantName: "your organisation",
        amountMajor: info.amountMajor,
        currency: info.currency,
        invoiceUrl: info.invoiceUrl,
      });
      // Ops always; customer when we have an email. No-op-safe if Resend unset.
      const recipients = [env.RESEND_FROM_EMAIL];
      if (info.customerEmail) recipients.push(info.customerEmail);
      await sendEmail({ to: recipients, subject: body.subject, html: body.html, text: body.text });
    },
  };
}
```

- [ ] **Step 4: Implement the route**

Create `src/app/webhooks/stripe/route.ts`:
```ts
import "server-only";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/env";
import { getStripe } from "@/lib/billing/stripe";
import { claimOnce } from "@/lib/redis/idempotency";
import { handleStripeEvent } from "@/lib/billing/handle-event";
import { buildBillingDeps } from "@/lib/billing/webhook-deps";

export const runtime = "nodejs";
// Stripe signature verification needs the EXACT raw bytes; never let Next parse
// or cache this body.
export const dynamic = "force-dynamic";

const EVENT_DEDUPE_TTL_SEC = 24 * 60 * 60;

export async function POST(req: Request): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration, not a client error — but never reveal detail to callers.
    console.error("/webhooks/stripe: STRIPE_WEBHOOK_SECRET missing");
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("/webhooks/stripe: signature verification failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // Idempotency: Stripe may redeliver. Claim the event id once for 24h.
  const fresh = await claimOnce(`stripe:evt:${event.id}`, EVENT_DEDUPE_TTL_SEC);
  if (!fresh) return NextResponse.json({ received: true, deduped: true });

  try {
    const result = await handleStripeEvent(event, buildBillingDeps());
    return NextResponse.json({ received: true, action: result.action });
  } catch (err) {
    // Returning 500 makes Stripe retry — appropriate for a transient DB/email
    // failure. The event id stays claimed, so a retry within 24h is deduped;
    // for true transient failures Stripe's >24h retry window still recovers.
    console.error("/webhooks/stripe: handler failed", err);
    return new NextResponse("Handler error", { status: 500 });
  }
}
```

> **Note on the dedupe-vs-retry tradeoff:** the simple `claimOnce`-before-handle order means a handler that 500s won't be retried within 24h (the id is already claimed). That is acceptable for this epic — Stripe's webhook retries span days, and the mutations here are themselves idempotent (subscription upsert, `setup_fee` mark-paid). If stronger retry semantics are needed later, move the `claimOnce` to *after* a successful handle. Left as a deliberate, documented choice.

- [ ] **Step 5: Run the route test (expect pass)**

Run: `pnpm test billing-webhook-route` (`dangerouslyDisableSandbox: true`)
Expected: PASS (all four cases).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/billing/webhook-deps.ts src/app/webhooks/stripe/route.ts tests/billing-webhook-route.test.ts
git commit -m "feat(billing): /webhooks/stripe route + service-role deps builder"
```

---

### Task 7: Admin billing actions + tenant-detail controls + manual sync

**Files:**
- Create: `src/app/admin/tenants/[tenantId]/billing-actions.ts`
- Create: `src/app/admin/tenants/[tenantId]/billing-panel.tsx`
- Modify: `src/app/admin/tenants/[tenantId]/page.tsx` (render the panel)
- Modify: `src/app/admin/billing/page.tsx` (wire "Manual sync")
- Test: append to `tests/billing-structure.test.ts`

Staff trigger the two billing milestones from the tenant detail page: **Create setup-fee invoice** (one-time, when the contract is signed) and **Start subscription** (at go-live; sets `contract_start = today`, `contract_renewal = +12 months`, `status = active`). A **Sync from Stripe** action reconciles the local mirror for a tenant on demand and backs the admin billing "Manual sync" button. All three are audited.

- [ ] **Step 1: Write the actions**

Create `src/app/admin/tenants/[tenantId]/billing-actions.ts`:
```ts
"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { getStripe } from "@/lib/billing/stripe";
import {
  buildSetupInvoiceItemParams,
  buildSubscriptionCreateParams,
} from "@/lib/billing/plan-price";
import { subscriptionToMirror } from "@/lib/billing/event-map";
import { addMonthsUTC } from "@/lib/billing/dates";
import { CONTRACT_MONTHS, type Currency } from "@/lib/marketing/pricing";
import type { PlanBand } from "@/lib/admin/plan-bands";

const idSchema = z.string().uuid();

function db() {
  return createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

type TenantBillingRow = {
  id: string;
  name: string;
  currency: Currency;
  plan_band: PlanBand;
  country: string;
  contact_email: string | null;
  stripe_customer_id: string | null;
};

async function loadTenant(tenantId: string): Promise<TenantBillingRow> {
  const { data, error } = await db()
    .from("tenants")
    .select("id, name, currency, plan_band, country, contact_email, stripe_customer_id")
    .eq("id", tenantId)
    .single();
  if (error || !data) throw new Error("Tenant not found.");
  return data as TenantBillingRow;
}

/** Ensure the tenant has a Stripe customer; create + persist one if not. The
 *  address country drives Stripe Tax (UK VAT). */
export async function getOrCreateStripeCustomer(tenant: TenantBillingRow): Promise<string> {
  if (tenant.stripe_customer_id) return tenant.stripe_customer_id;
  const customer = await getStripe().customers.create({
    name: tenant.name,
    email: tenant.contact_email ?? undefined,
    address: { country: tenant.country },
    metadata: { tenant_id: tenant.id },
  });
  await db().from("tenants").update({ stripe_customer_id: customer.id }).eq("id", tenant.id);
  return customer.id;
}

/** A single shared Stripe Product backs every subscription's inline price_data.
 *  Stored in env when known; created on first use otherwise. */
async function getOrCreateProduct(): Promise<string> {
  const products = await getStripe().products.search({
    query: 'metadata["bookmycab"]:"automation"',
    limit: 1,
  });
  if (products.data[0]) return products.data[0].id;
  const product = await getStripe().products.create({
    name: "BookMyCab Automation",
    metadata: { bookmycab: "automation" },
  });
  return product.id;
}

/** Create the one-time, non-refundable setup-fee invoice and finalize it.
 *  Stores the Stripe invoice id on the existing unpaid setup_fees row so the
 *  `invoice.paid` webhook can mark it paid. */
export async function createSetupFeeInvoice(tenantId: string): Promise<void> {
  const claims = await requireStaff();
  const id = idSchema.parse(tenantId);
  const tenant = await loadTenant(id);

  const customerId = await getOrCreateStripeCustomer(tenant);
  const stripe = getStripe();

  // Pending invoice item, then a draft invoice that sweeps it up, then finalize.
  await stripe.invoiceItems.create(
    buildSetupInvoiceItemParams({ customerId, currency: tenant.currency }),
  );
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 14,
    automatic_tax: { enabled: true },
    metadata: { tenant_id: id, kind: "setup_fee" },
  });
  await stripe.invoices.finalizeInvoice(invoice.id);

  // Link the Stripe invoice to the local setup_fees row (one unpaid row exists
  // from provisioning). Upsert-by-tenant: update the unpaid row, or insert one.
  const { data: existing } = await db()
    .from("setup_fees")
    .select("id")
    .eq("tenant_id", id)
    .is("paid_at", null)
    .maybeSingle();
  if (existing) {
    await db()
      .from("setup_fees")
      .update({ stripe_invoice_id: invoice.id })
      .eq("id", (existing as { id: string }).id);
  } else {
    await db().from("setup_fees").insert({
      tenant_id: id,
      stripe_invoice_id: invoice.id,
      currency: tenant.currency,
      paid_at: null,
    });
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: id,
    action: "billing.setup_fee_invoiced",
    targetType: "tenant",
    targetId: id,
    metadata: { stripe_invoice_id: invoice.id },
  });

  revalidatePath(`/admin/tenants/${id}`);
}

/** Start the monthly subscription at go-live. Billing begins now; sets the
 *  12-month contract window for the renewal-alert view. Refuses Custom band. */
export async function startSubscription(tenantId: string): Promise<void> {
  const claims = await requireStaff();
  const id = idSchema.parse(tenantId);
  const tenant = await loadTenant(id);

  const customerId = await getOrCreateStripeCustomer(tenant);
  const productId = await getOrCreateProduct();

  const sub = await getStripe().subscriptions.create(
    buildSubscriptionCreateParams({
      customerId,
      productId,
      band: tenant.plan_band,
      currency: tenant.currency,
      tenantId: id,
    }),
  );

  // Mirror immediately (don't wait for the webhook) + set the contract window.
  const today = new Date().toISOString().slice(0, 10);
  const renewal = addMonthsUTC(today, CONTRACT_MONTHS);
  await db().from("subscriptions").upsert(subscriptionToMirror(sub), { onConflict: "stripe_sub_id" });
  await db()
    .from("tenants")
    .update({
      status: "active",
      contract_start: today,
      contract_renewal: renewal,
      monthly_price: subscriptionToMirror(sub).monthly_price,
    })
    .eq("id", id);

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: id,
    action: "billing.subscription_started",
    targetType: "tenant",
    targetId: id,
    metadata: { stripe_sub_id: sub.id, contract_renewal: renewal },
  });

  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin/billing");
}

/** Reconcile the local mirror with Stripe for one tenant (Manual sync). Pulls
 *  the tenant's live subscriptions and upserts each into the mirror. */
export async function syncSubscription(tenantId: string): Promise<void> {
  const claims = await requireStaff();
  const id = idSchema.parse(tenantId);
  const tenant = await loadTenant(id);
  if (!tenant.stripe_customer_id) return;

  const subs = await getStripe().subscriptions.list({
    customer: tenant.stripe_customer_id,
    status: "all",
    limit: 10,
  });
  for (const sub of subs.data) {
    const row = subscriptionToMirror(sub);
    // The list call may return subs created before metadata existed — backfill
    // the tenant_id so the mirror row is never orphaned.
    row.tenant_id = row.tenant_id ?? id;
    await db().from("subscriptions").upsert(row, { onConflict: "stripe_sub_id" });
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: id,
    action: "billing.sync",
    targetType: "tenant",
    targetId: id,
    metadata: { count: subs.data.length },
  });

  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin/billing");
}
```

- [ ] **Step 2: Write the billing panel (client component)**

Create `src/app/admin/tenants/[tenantId]/billing-panel.tsx`:
```tsx
"use client";

import { useTransition } from "react";
import {
  createSetupFeeInvoice,
  startSubscription,
  syncSubscription,
} from "./billing-actions";

interface BillingPanelProps {
  tenantId: string;
  planBand: string;
  setupFeePaid: boolean;
  hasSubscription: boolean;
}

/**
 * Staff-only billing controls on the tenant detail page. Each action is a
 * server action; the guard + audit live server-side. Custom band cannot start a
 * subscription here (no fixed price) — the button is disabled with a hint.
 */
export function BillingPanel({ tenantId, planBand, setupFeePaid, hasSubscription }: BillingPanelProps) {
  const [pending, start] = useTransition();
  const isCustom = planBand === "Custom";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Stripe billing
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || setupFeePaid}
          onClick={() => start(() => void createSetupFeeInvoice(tenantId))}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {setupFeePaid ? "Setup fee paid" : "Create setup-fee invoice"}
        </button>

        <button
          type="button"
          disabled={pending || hasSubscription || isCustom}
          title={isCustom ? "Custom band has no fixed price — configure in Stripe" : undefined}
          onClick={() => start(() => void startSubscription(tenantId))}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {hasSubscription ? "Subscription active" : "Start subscription (go-live)"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => void syncSubscription(tenantId))}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sync from Stripe
        </button>
      </div>
      {isCustom && (
        <p className="mt-2 text-xs text-zinc-500">
          Custom-band subscriptions are quoted and configured directly in Stripe.
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Render the panel on the tenant detail page**

Read the current page first to find where to insert and how it already loads the tenant:

Run: `sed -n '1,80p' src/app/admin/tenants/[tenantId]/page.tsx` (use the Read tool — the path has brackets)

Then add, near the other imports:
```tsx
import { BillingPanel } from "./billing-panel";
```
And render it inside the page's main content (after the existing billing/summary section). It needs `setupFeePaid` and whether a subscription mirror row exists. Pass them from data the page already loads (it reads the tenant row; add a `subscriptions` count if not already present):
```tsx
{/* Stripe billing controls (Epic 8) */}
<BillingPanel
  tenantId={tenant.id}
  planBand={tenant.plan_band}
  setupFeePaid={Boolean(tenant.setup_fee_paid)}
  hasSubscription={subscriptionCount > 0}
/>
```
If the page does not already select `setup_fee_paid` or count subscriptions, extend its existing service-role query:
```tsx
const { count: subscriptionCount } = await serviceClient
  .from("subscriptions")
  .select("id", { count: "exact", head: true })
  .eq("tenant_id", tenantId);
```
(Match the page's existing client variable name — it uses a service-role client like `src/app/admin/billing/page.tsx`. Add `setup_fee_paid` to the tenant `.select(...)` if missing.)

- [ ] **Step 4: Wire the admin billing "Manual sync" button**

In `src/app/admin/billing/page.tsx`, the disabled `Manual sync` button + its `TODO(epic-8)` comments (lines ~247–260) are replaced. Since the panel-level sync is per-tenant, the global page button links to the tenants list with a hint rather than calling a no-tenant action. Replace the disabled button block with an enabled link:
```tsx
{/* Live Stripe sync is per-tenant (tenant detail → Sync from Stripe). */}
<a
  href="/admin/tenants"
  className="shrink-0 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
>
  Sync a tenant
</a>
<p className="text-xs text-zinc-500">Open a tenant to sync from Stripe</p>
```
Also update the closing paragraph (lines ~351–358) to drop "will be reconciled against Stripe in Epic 8" — change to: "is reconciled from Stripe via webhooks and per-tenant Manual sync."

- [ ] **Step 5: Append a structure/guard test**

Append to `tests/billing-structure.test.ts`:
```ts
import { readFileSync } from "node:fs";

describe("epic-8 admin billing wiring", () => {
  it("tenant detail renders the BillingPanel", () => {
    const src = readFileSync(p("src/app/admin/tenants/[tenantId]/page.tsx"), "utf8");
    expect(src).toMatch(/BillingPanel/);
  });

  it("admin billing page no longer carries the epic-8 stub TODO", () => {
    const src = readFileSync(p("src/app/admin/billing/page.tsx"), "utf8");
    expect(src).not.toMatch(/TODO\(epic-8\)/);
  });

  it("service-role billing usage stays confined to admin actions + webhook deps", () => {
    // These are the ONLY files allowed to read the service-role key for billing.
    const allow = new Set([
      "src/app/admin/tenants/[tenantId]/billing-actions.ts",
      "src/lib/billing/webhook-deps.ts",
    ]);
    // Customer-facing billing must never touch the service-role key.
    const forbidden = [
      "src/lib/dashboard/billing-queries.ts",
      "src/app/dashboard/billing/page.tsx",
      "src/app/api/orgs/[orgId]/billing/portal/route.ts",
    ];
    for (const f of forbidden) {
      expect(readFileSync(p(f), "utf8"), f).not.toMatch(/SERVICE_ROLE/);
    }
    // Sanity: the allowlisted files DO use it.
    for (const f of allow) {
      expect(readFileSync(p(f), "utf8"), f).toMatch(/SERVICE_ROLE/);
    }
  });
});
```

- [ ] **Step 6: Run the structure test (expect pass)**

Run: `pnpm test billing-structure` (`dangerouslyDisableSandbox: true`)
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. (Fix any mismatch between the tenant `.select(...)` columns and the props you pass `BillingPanel`.)

- [ ] **Step 8: Commit**

```bash
git add "src/app/admin/tenants/[tenantId]/billing-actions.ts" "src/app/admin/tenants/[tenantId]/billing-panel.tsx" "src/app/admin/tenants/[tenantId]/page.tsx" src/app/admin/billing/page.tsx tests/billing-structure.test.ts
git commit -m "feat(billing): admin setup-fee/subscription/sync actions + tenant controls"
```

---

### Task 8: Customer Portal session API + final gate

**Files:**
- Modify: `src/app/api/orgs/[orgId]/billing/portal/route.ts` (replace 503 with a real session)
- Test: append to `tests/billing-structure.test.ts`

The dashboard "Update Payment Method" button already POSTs to this route and follows `json.url`. Replace the 503 stub with a real Stripe Billing Portal session for the tenant's customer.

- [ ] **Step 1: Implement the portal session**

Replace the body of `src/app/api/orgs/[orgId]/billing/portal/route.ts`:
```ts
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { env } from "@/env";
import { getStripe } from "@/lib/billing/stripe";
import { getBillingOverview } from "@/lib/dashboard/billing-queries";

export async function POST(_req: Request, ctx: { params: Promise<Record<string, string>> }) {
  const { orgId } = await ctx.params;

  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;

  // Reuse the RLS-scoped overview to get the customer id — no service-role key
  // on this customer-facing route.
  const billing = await getBillingOverview(orgId);
  if (!billing.stripeCustomerId) {
    return new NextResponse(
      JSON.stringify({ error: "Billing portal is not available yet." }),
      { status: 503, headers: { "content-type": "application/json" } },
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${env.NEXT_PUBLIC_SITE_URL}/dashboard/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("billing portal session failed", err);
    return new NextResponse(
      JSON.stringify({ error: "Could not open the billing portal." }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
}
```

- [ ] **Step 2: Append portal + brand guard tests**

Append to `tests/billing-structure.test.ts`:
```ts
describe("epic-8 portal + brand", () => {
  it("portal route creates a real Stripe billing portal session", () => {
    const src = readFileSync(p("src/app/api/orgs/[orgId]/billing/portal/route.ts"), "utf8");
    expect(src).toMatch(/billingPortal\.sessions\.create/);
    expect(src).not.toMatch(/Billing portal is being set up/); // old stub copy gone
  });

  it("no banned internal vocabulary on customer-facing billing surfaces", () => {
    const banned = /\bn8n\b|\bCabLab\b|\bworkflow\b|\bexecution\b/i;
    for (const f of [
      "src/app/dashboard/billing/page.tsx",
      "src/app/dashboard/billing/portal-button.tsx",
      "src/lib/email/templates.ts",
      "src/app/api/orgs/[orgId]/billing/portal/route.ts",
    ]) {
      expect(readFileSync(p(f), "utf8"), f).not.toMatch(banned);
    }
  });
});
```

- [ ] **Step 3: Run the structure test (expect pass)**

Run: `pnpm test billing-structure` (`dangerouslyDisableSandbox: true`)
Expected: PASS.

- [ ] **Step 4: Full gate — typecheck, lint, full test run, build**

Run (each with `dangerouslyDisableSandbox: true` where it invokes vitest):
```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```
Expected: all PASS. The full suite includes every prior epic's tests plus the seven new billing test files; the `next build` confirms the new route handlers + server actions compile in a production build.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/orgs/[orgId]/billing/portal/route.ts" tests/billing-structure.test.ts
git commit -m "feat(billing): live Customer Portal session + epic-8 final gate"
```

---

## Deferred follow-ups (greppable, out of scope for Epic 8)

- **`TODO(billing-suspend)`** — no auto-suspend on payment failure was a deliberate decision; if dunning policy later wants suspension, add it in `handleStripeEvent`'s `invoice.payment_failed` branch.
- **`TODO(billing-proration)`** — self-serve mid-contract upgrades (Q5) deferred; staff change subs in Stripe and the `customer.subscription.updated` webhook syncs the mirror.
- **`TODO(billing-product-env)`** — `getOrCreateProduct` searches/creates a shared product each subscription start; once a product id is stable, pin it in env to skip the lookup.
- **`TODO(billing-event-table)`** — webhook idempotency uses Redis `claimOnce`; if a durable audit of every Stripe event is required (Epic 11 observability), persist events to a table instead.
- **Resend domain verification** — `RESEND_FROM_EMAIL` (`hello@bookmycab.com`) must be a verified Resend sending domain before payment-failed emails actually deliver in production.

---

## Self-review against the roadmap "Produces" list

| Roadmap requirement (§74) | Task |
|---|---|
| Setup-fee one-time invoice on contract-signed | Task 7 `createSetupFeeInvoice` |
| Monthly subscription on go-live (billing start = go-live date) | Task 7 `startSubscription` (billing begins now; `contract_start = today`) |
| Stripe Tax (UK VAT) | Task 2 (`automatic_tax` on subscription) + Task 7 (`automatic_tax` on invoice, customer `address.country`) |
| Customer Portal session API | Task 8 |
| Webhook `customer.subscription.*` | Task 5 + Task 6 (created/updated/deleted → mirror upsert) |
| Webhook `invoice.payment_failed` → Resend to ops + customer, no auto-suspend | Task 4 + Task 5 (`payment_failed.notified`) + Task 6 deps |
| Webhook `invoice.paid` → log | Task 5 (`logged`; setup invoices additionally mark `setup_fees.paid_at`) |
| Honour `renewal_mode = rolling_monthly` | Task 7 (standard monthly sub, no `cancel_at`; `contract_renewal` = +12mo for the alert view only) |
| Q4 setup-fee refundability | Resolved: non-refundable, manual-only (no refund code) |
| Q5 mid-contract upgrade pro-rata | Resolved: deferred, admin-driven (no proration endpoint) |
