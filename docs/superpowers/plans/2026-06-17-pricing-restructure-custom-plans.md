# Pricing Restructure + Admin Granular Custom Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Frontend tasks additionally run through the `impeccable` skill (keep the existing Neo-Brutalism design; change content, not the visual system).

**Goal:** Replace the entire tiered pricing model with three offerings — WhatsApp Booking Suite (£499/mo + £999 setup), AI Voice Booking "Ignition" (1000 calls, £1999/mo + £999 setup), and a fully admin-configurable Custom "Full Throttle" plan — and wire an activation-invoice flow (Stripe invoice emailed to the tenant, soft "unpaid" warning on Go-Live, custom per-call overage).

**Architecture:** Collapse the marketing + billing pricing modules from 3 tiers × 2 products + Double Decker down to two fixed plan constants plus a `custom` plan path. Add a `custom_plans` Supabase table holding the granular fields, write a `voice_subscriptions` (+ optional `chat_subscriptions`) row per tenant so existing metering/pool/dashboard machinery is reused, and issue a single first invoice (setup fee + first period) per tenant that is emailed via Resend with the Stripe hosted-invoice pay link. The Build Queue surfaces a soft "invoice unpaid" warning but still allows Go-Live.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript, Supabase (PostgreSQL + RLS) via MCP, Stripe (test/sandbox keys already in `.env.local`) via SDK + MCP, Resend email, Tailwind v4 (Neo-Brutalism), Vitest + Playwright.

---

## Decisions locked (from product Q&A)

1. **Custom billing mode:** admin picks **per tenant** — `recurring` (renews every "validity" days, default 30) OR `one_time` prepaid pack (N calls valid X days, then per-call overage).
2. **Bundling:** **Drop Double Decker.** Three offerings only. A Custom plan MAY also include the WhatsApp Suite.
3. **Activation invoice scope:** **Setup fee + first period** (first month for recurring/base, full pack price for one-time) on a single emailed invoice.
4. **Go-Live gate:** **Soft warning only** — show "invoice unpaid" on the card, still allow Go-Live. 100%-off (bypass) tenants count as paid.

## Naming & type constants (use these EXACT identifiers in every task)

- `PlanType = "whatsapp_suite" | "voice_ignition" | "custom"`
- `CommercialModel = "chat" | "voice" | "custom"` (DB CHECK keeps legacy `double_decker` for grandfathered rows; the UI never offers it).
- Marketing constants (`src/lib/marketing/pricing.ts`): `CHAT_SUITE`, `VOICE_IGNITION`, `EXTRA_CALL_PRICE_GBP`.
- Billing constants (`src/lib/billing/pricing.ts`): `CHAT_SUITE_PRICE_GBP=499`, `CHAT_SUITE_SETUP_GBP=999`, `VOICE_IGNITION_SPEC`, `DEFAULT_EXTRA_CALL_PRICE_GBP=0.9`.
- Custom DB plan_tier value: `"custom"` (added to `voice_subscriptions` + `chat_subscriptions` CHECKs). Base voice + base chat both use plan_tier `"ignition"`.

## File Structure

**Create:**
- `supabase/migrations/0068_pricing_restructure_custom_plans.sql` — custom_plans table, CHECK widening, `tenants.plan_type`, `setup_fees.hosted_invoice_url`.
- `src/lib/billing/custom-plan.ts` — pure custom-plan types + resolver + validation (DB/Stripe-free).
- `src/lib/billing/activation-charges.ts` — pure planner for the activation invoice (recurring vs one_time; setup + first period).
- `tests/billing-custom-plan.test.ts`, `tests/billing-activation-charges.test.ts`, `tests/billing-activation-email.test.ts`.

**Modify:**
- `src/lib/marketing/pricing.ts` — replace tiers with two fixed plans.
- `src/lib/billing/pricing.ts` — replace tier maps with fixed constants + plan_type resolver.
- `src/components/marketing/pricing-sections.tsx` — three offering panels (design kept).
- `src/app/(marketing)/pricing/page.tsx` — hero/blurb copy.
- `src/app/admin/plans/page.tsx` — three-offering catalogue.
- `src/app/admin/tenants/provisioning.ts` — schema + row builder for plan_type + custom fields.
- `src/app/admin/tenants/new/tenant-form.tsx` — plan_type selector + custom fields panel.
- `src/app/admin/tenants/actions.ts` — persist custom_plans + subs, then issue activation invoice/email.
- `src/app/admin/tenants/[tenantId]/billing-actions.ts` — `issueActivationInvoice` (recurring/one_time, single invoice, capture URL, email).
- `src/app/admin/tenants/[tenantId]/billing-panel.tsx` — "Issue / re-send invoice" + invoice link/status.
- `src/lib/email/templates.ts` — `activationInvoiceEmail`.
- `src/lib/billing/handle-event.ts` + `src/lib/billing/webhook-deps.ts` — activation invoice paid → mark paid + grant one-time pack pool.
- `src/app/admin/build-queue/page.tsx` + `build-queue-board.tsx` — soft "invoice unpaid" badge.
- `src/lib/dashboard/billing-queries.ts` + `src/app/dashboard/billing/page.tsx` — custom plan + pay-invoice link.
- `src/app/api/orgs/[orgId]/billing/credit/checkout/route.ts` + `src/lib/billing/credit.ts` — per-tenant custom overage price.
- Tests: `tests/billing-pricing-drift.test.ts`, `tests/pricing.test.ts`, `tests/pricing-sections.test.tsx`, `tests/billing-new-model-provisioning.test.ts`, `tests/billing-new-model.test.ts`, `tests/admin-provisioning-action.test.ts`, `tests/billing-handle-event.test.ts` (rewrite affected assertions).

---

## Phase A — Pricing constants & marketing page

### Task A1: Marketing pricing constants → two fixed plans

**Files:**
- Modify: `src/lib/marketing/pricing.ts`
- Test: `tests/pricing.test.ts`

- [ ] **Step 1: Write the failing test** — replace the tier-based assertions in `tests/pricing.test.ts` with the new constants. Read the existing file first, then replace its body with:

```ts
import { describe, it, expect } from "vitest";
import {
  CHAT_SUITE,
  VOICE_IGNITION,
  EXTRA_CALL_PRICE_GBP,
  convert,
  formatPrice,
  priceFor,
  CURRENCIES,
  BASE_CURRENCY,
} from "@/lib/marketing/pricing";

const RATES = { GBP: 1, EUR: 1.18, USD: 1.27 };

describe("fixed plan constants", () => {
  it("WhatsApp Booking Suite is £499/mo + £999 setup", () => {
    expect(CHAT_SUITE.priceGbp).toBe(499);
    expect(CHAT_SUITE.setupGbp).toBe(999);
    expect(CHAT_SUITE.name).toBe("WhatsApp Booking Suite");
  });
  it("AI Voice Ignition is 1000 calls, £1999/mo + £999 setup", () => {
    expect(VOICE_IGNITION.callsPerMonth).toBe(1000);
    expect(VOICE_IGNITION.priceGbp).toBe(1999);
    expect(VOICE_IGNITION.setupGbp).toBe(999);
    expect(VOICE_IGNITION.name).toBe("Ignition");
  });
  it("base extra-call credit is £0.90", () => {
    expect(EXTRA_CALL_PRICE_GBP).toBe(0.9);
  });
});

describe("format / convert helpers (unchanged)", () => {
  it("BASE_CURRENCY is GBP and CURRENCIES has 3", () => {
    expect(BASE_CURRENCY).toBe("GBP");
    expect(CURRENCIES).toHaveLength(3);
  });
  it("formats GBP whole pounds", () => {
    expect(formatPrice("GBP", 1999)).toBe("£1,999");
  });
  it("converts + formats EUR", () => {
    expect(priceFor(499, "EUR", RATES)).toBe("€589");
  });
  it("never renders NaN", () => {
    expect(formatPrice("GBP", Number.NaN)).toBe("£0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pricing.test.ts`
Expected: FAIL — `CHAT_SUITE`/`VOICE_IGNITION` are not exported.

- [ ] **Step 3: Rewrite `src/lib/marketing/pricing.ts`** — keep the `Currency` type, `CURRENCIES`, `BASE_CURRENCY`, `convert`, `formatPrice`, `priceFor` exactly as they are; replace the product section (lines 9–151, i.e. everything from the `TierKey` type through `EXTRA_CALL_PRICE_GBP`) with:

```ts
export type Currency = "GBP" | "EUR" | "USD";

export const CURRENCIES = ["GBP", "EUR", "USD"] as const satisfies readonly Currency[];

/** Prices are authored in this currency; everything else is derived. */
export const BASE_CURRENCY: Currency = "GBP";

/* ----------------------------------------------------------------------------
   THE TWO FIXED PLANS (GBP, monthly excl. VAT). The Custom "Full Throttle"
   plan has no fixed numbers — it is quoted on a discovery call and configured
   per tenant in the admin console.
   -------------------------------------------------------------------------- */

/** 1. WhatsApp Booking Suite — WhatsApp Chatbot + Voice Note. */
export const CHAT_SUITE = {
  name: "WhatsApp Booking Suite",
  blurb: "WhatsApp Chatbot + Voice Note. One bot that books by text or voice note and writes the job straight to dispatch.",
  priceGbp: 499,
  setupGbp: 999,
} as const;

/** 2a. AI Voice Booking — Ignition (the only fixed voice plan). */
export const VOICE_IGNITION = {
  name: "Ignition",
  callsPerMonth: 1000,
  priceGbp: 1999,
  setupGbp: 999,
} as const;

/** Pay-as-you-go base voice credit, GBP per call (custom plans override this). */
export const EXTRA_CALL_PRICE_GBP = 0.9;
```

Then delete any now-unused imports/exports (`TierKey`, `ChatTier`, `CHAT_TIERS`, `CHAT_SETUP_FEE_GBP`, `VoiceTier`, `VOICE_TIERS`, `VOICE_SETUP_GBP`, `BUNDLE_*`, `bundleChatPriceGbp`, `bundleTotalGbp`, `BUNDLE_SETUP_GBP`). Keep `convert`/`formatPrice`/`priceFor`/`CURRENCY_SYMBOL` from line 153 onward verbatim.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/pricing.ts tests/pricing.test.ts
git commit -m "refactor(pricing): collapse marketing tiers to two fixed plans"
```

---

### Task A2: Billing pricing constants + plan_type resolver

**Files:**
- Modify: `src/lib/billing/pricing.ts`
- Test: `tests/billing-new-model-provisioning.test.ts`

- [ ] **Step 1: Write the failing test** — replace `tests/billing-new-model-provisioning.test.ts` body with:

```ts
import { describe, it, expect } from "vitest";
import {
  CHAT_SUITE_PRICE_GBP,
  CHAT_SUITE_SETUP_GBP,
  VOICE_IGNITION_SPEC,
  DEFAULT_EXTRA_CALL_PRICE_GBP,
  resolveBasePlanPricing,
  commercialModelLabel,
  type PlanType,
} from "@/lib/billing/pricing";

describe("fixed base-plan constants", () => {
  it("chat suite £499 + £999 setup", () => {
    expect(CHAT_SUITE_PRICE_GBP).toBe(499);
    expect(CHAT_SUITE_SETUP_GBP).toBe(999);
  });
  it("voice ignition: 1000 calls, £1999, £999 setup, 1 agent", () => {
    expect(VOICE_IGNITION_SPEC).toEqual({
      callAllowance: 1000,
      priceGbp: 1999,
      setupGbp: 999,
      includedAgents: 1,
    });
  });
  it("default overage is £0.90", () => {
    expect(DEFAULT_EXTRA_CALL_PRICE_GBP).toBe(0.9);
  });
});

describe("resolveBasePlanPricing", () => {
  it("whatsapp_suite → chat only", () => {
    expect(resolveBasePlanPricing("whatsapp_suite")).toEqual({
      chatGbp: 499, voiceGbp: null, voiceAllowance: null, voiceAgents: null, setupGbp: 999,
    });
  });
  it("voice_ignition → voice only", () => {
    expect(resolveBasePlanPricing("voice_ignition")).toEqual({
      chatGbp: null, voiceGbp: 1999, voiceAllowance: 1000, voiceAgents: 1, setupGbp: 999,
    });
  });
  it("custom → null (resolved by custom-plan module)", () => {
    expect(resolveBasePlanPricing("custom" as PlanType)).toBeNull();
  });
});

describe("commercialModelLabel", () => {
  it("labels chat / voice / custom and legacy double_decker", () => {
    expect(commercialModelLabel("chat")).toBe("WhatsApp Booking Suite");
    expect(commercialModelLabel("voice")).toBe("AI Voice Booking");
    expect(commercialModelLabel("custom")).toBe("Custom plan");
    expect(commercialModelLabel("double_decker")).toBe("Double Decker (Chat + Voice)");
    expect(commercialModelLabel(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-new-model-provisioning.test.ts`
Expected: FAIL — new exports missing.

- [ ] **Step 3: Rewrite `src/lib/billing/pricing.ts`** with:

```ts
/**
 * Billing / provisioning pricing — the figures Stripe actually charges.
 *
 * Three offerings: WhatsApp Booking Suite (chat, £499), AI Voice Booking
 * Ignition (voice, 1000 calls £1999), and Custom (configured per tenant; see
 * ./custom-plan.ts). GBP only. The fixed GBP numbers MUST equal the marketing
 * canonical numbers (src/lib/marketing/pricing.ts); tests/billing-pricing-drift
 * enforces it. `Currency` lives in the marketing module as a shared type.
 */

export type PlanType = "whatsapp_suite" | "voice_ignition" | "custom";
export type CommercialModel = "chat" | "voice" | "custom";

/** Display label for a tenant's commercial model (admin + dashboard). Tolerates
 *  the legacy `double_decker` value still present on grandfathered rows. */
export function commercialModelLabel(model: CommercialModel | string | null): string {
  switch (model) {
    case "chat":
      return "WhatsApp Booking Suite";
    case "voice":
      return "AI Voice Booking";
    case "custom":
      return "Custom plan";
    case "double_decker":
      return "Double Decker (Chat + Voice)";
    default:
      return "—";
  }
}

/** Map a plan_type to its commercial_model. Custom callers override the model
 *  from the custom-plan product flags. */
export function planTypeCommercialModel(plan: PlanType): CommercialModel {
  if (plan === "whatsapp_suite") return "chat";
  if (plan === "voice_ignition") return "voice";
  return "custom";
}

/* --- Fixed base plans (GBP) --- */
export const CHAT_SUITE_PRICE_GBP = 499;
export const CHAT_SUITE_SETUP_GBP = 999;

export const VOICE_IGNITION_SPEC = {
  callAllowance: 1000,
  priceGbp: 1999,
  setupGbp: 999,
  includedAgents: 1,
} as const;

/** Default pay-as-you-go overage when a custom plan does not set its own. */
export const DEFAULT_EXTRA_CALL_PRICE_GBP = 0.9;

export interface ResolvedBasePlanPricing {
  chatGbp: number | null;
  voiceGbp: number | null;
  voiceAllowance: number | null;
  voiceAgents: number | null;
  setupGbp: number;
}

/**
 * Resolve GBP figures for a FIXED base plan. Returns null for `custom`
 * (custom pricing is resolved by ./custom-plan.ts from admin input).
 */
export function resolveBasePlanPricing(plan: PlanType): ResolvedBasePlanPricing | null {
  if (plan === "whatsapp_suite") {
    return { chatGbp: CHAT_SUITE_PRICE_GBP, voiceGbp: null, voiceAllowance: null, voiceAgents: null, setupGbp: CHAT_SUITE_SETUP_GBP };
  }
  if (plan === "voice_ignition") {
    return {
      chatGbp: null,
      voiceGbp: VOICE_IGNITION_SPEC.priceGbp,
      voiceAllowance: VOICE_IGNITION_SPEC.callAllowance,
      voiceAgents: VOICE_IGNITION_SPEC.includedAgents,
      setupGbp: VOICE_IGNITION_SPEC.setupGbp,
    };
  }
  return null;
}
```

> Note: this DELETES `tierLabel`, `CHAT_PRICE_GBP`, `VOICE_PRICE_GBP`, `BUNDLE_*`, `bundleChatPriceGbp`, `chatMonthlyPriceGbp`, `voiceMonthlyPriceGbp`, `VOICE_PLAN_SPEC`, `setupFeeGbp`, `NewModelSelection`, `resolveNewModelPricing`, `ResolvedNewModelPricing`, `NewTierKey`. Later tasks update every caller.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-new-model-provisioning.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/pricing.ts tests/billing-new-model-provisioning.test.ts
git commit -m "refactor(billing): plan_type pricing resolver, drop tier maps"
```

---

### Task A3: Custom-plan pure module

**Files:**
- Create: `src/lib/billing/custom-plan.ts`
- Test: `tests/billing-custom-plan.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/billing-custom-plan.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  customPlanSchema,
  resolveCustomPlan,
  packExpiry,
  type CustomPlanInput,
} from "@/lib/billing/custom-plan";

const base: CustomPlanInput = {
  planName: "Airport Pack",
  billingMode: "recurring",
  includesChat: false,
  includesVoice: true,
  callAllowance: 5000,
  includedAgents: 3,
  planPriceGbp: 4500,
  setupFeeGbp: 1500,
  validityDays: 30,
  extraCreditPriceGbp: 0.75,
  pricePerCallGbp: 0.9,
  chatMonthlyGbp: null,
};

describe("customPlanSchema", () => {
  it("accepts a valid recurring voice plan", () => {
    expect(customPlanSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a plan that includes neither product", () => {
    const r = customPlanSchema.safeParse({ ...base, includesVoice: false, includesChat: false });
    expect(r.success).toBe(false);
  });
  it("requires chatMonthlyGbp when includesChat", () => {
    const r = customPlanSchema.safeParse({ ...base, includesChat: true, chatMonthlyGbp: null });
    expect(r.success).toBe(false);
  });
  it("rejects negative numbers and zero validity", () => {
    expect(customPlanSchema.safeParse({ ...base, planPriceGbp: -1 }).success).toBe(false);
    expect(customPlanSchema.safeParse({ ...base, validityDays: 0 }).success).toBe(false);
  });
});

describe("resolveCustomPlan", () => {
  it("voice-only recurring: voice = plan price, chat null", () => {
    expect(resolveCustomPlan(base)).toEqual({
      commercialModel: "custom",
      chatGbp: null,
      voiceGbp: 4500,
      voiceAllowance: 5000,
      voiceAgents: 3,
      setupGbp: 1500,
      firstPeriodGbp: 4500,
      extraCreditPriceGbp: 0.75,
    });
  });
  it("with chat: chatGbp set, firstPeriod = chat + voice", () => {
    const r = resolveCustomPlan({ ...base, includesChat: true, chatMonthlyGbp: 400 });
    expect(r.chatGbp).toBe(400);
    expect(r.firstPeriodGbp).toBe(4900);
  });
  it("one_time pack: firstPeriodGbp = pack price (no recurring)", () => {
    const r = resolveCustomPlan({ ...base, billingMode: "one_time" });
    expect(r.firstPeriodGbp).toBe(4500);
  });
});

describe("packExpiry", () => {
  it("adds validity days to the start date (UTC date-only)", () => {
    expect(packExpiry("2026-06-17", 30)).toBe("2026-07-17");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-custom-plan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/billing/custom-plan.ts`:**

```ts
/**
 * Pure custom-plan model (Full Throttle). No I/O — zod schema + resolver +
 * date math, imported by the provisioning form, the server action, and tests.
 */
import { z } from "zod";
import type { CommercialModel } from "@/lib/billing/pricing";

export const customPlanSchema = z
  .object({
    planName: z.string().trim().min(1, "Plan name is required."),
    billingMode: z.enum(["recurring", "one_time"]),
    includesChat: z.boolean(),
    includesVoice: z.boolean(),
    callAllowance: z.coerce.number().int().min(0),
    includedAgents: z.coerce.number().int().min(0),
    planPriceGbp: z.coerce.number().min(0),
    setupFeeGbp: z.coerce.number().min(0),
    validityDays: z.coerce.number().int().positive("Validity must be at least 1 day."),
    extraCreditPriceGbp: z.coerce.number().min(0),
    pricePerCallGbp: z.coerce.number().min(0).nullable().optional(),
    chatMonthlyGbp: z.coerce.number().min(0).nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.includesChat && !d.includesVoice)
      ctx.addIssue({ code: "custom", path: ["includesVoice"], message: "A custom plan must include the WhatsApp Suite, AI Voice, or both." });
    if (d.includesChat && (d.chatMonthlyGbp == null || Number.isNaN(d.chatMonthlyGbp)))
      ctx.addIssue({ code: "custom", path: ["chatMonthlyGbp"], message: "Set the WhatsApp Suite monthly price." });
  });

export type CustomPlanInput = z.infer<typeof customPlanSchema>;

export interface ResolvedCustomPlan {
  commercialModel: CommercialModel; // always "custom"
  chatGbp: number | null;
  voiceGbp: number | null;
  voiceAllowance: number | null;
  voiceAgents: number | null;
  setupGbp: number;
  /** Setup + first period total (what the activation invoice charges). */
  firstPeriodGbp: number;
  extraCreditPriceGbp: number;
}

export function resolveCustomPlan(input: CustomPlanInput): ResolvedCustomPlan {
  const chatGbp = input.includesChat ? Number(input.chatMonthlyGbp ?? 0) : null;
  const voiceGbp = input.includesVoice ? input.planPriceGbp : null;
  const voiceAllowance = input.includesVoice ? input.callAllowance : null;
  const voiceAgents = input.includesVoice ? input.includedAgents : null;
  const firstPeriodGbp = (chatGbp ?? 0) + (voiceGbp ?? 0);
  return {
    commercialModel: "custom",
    chatGbp,
    voiceGbp,
    voiceAllowance,
    voiceAgents,
    setupGbp: input.setupFeeGbp,
    firstPeriodGbp,
    extraCreditPriceGbp: input.extraCreditPriceGbp,
  };
}

/** start date (YYYY-MM-DD) + validity days → expiry date (YYYY-MM-DD, UTC). */
export function packExpiry(startIso: string, validityDays: number): string {
  const d = new Date(`${startIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + validityDays);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-custom-plan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/custom-plan.ts tests/billing-custom-plan.test.ts
git commit -m "feat(billing): pure custom-plan schema + resolver"
```

---

### Task A4: Pricing drift test → fixed plans

**Files:**
- Modify: `tests/billing-pricing-drift.test.ts`

- [ ] **Step 1: Rewrite the drift test** — replace the whole file with:

```ts
// tests/billing-pricing-drift.test.ts
// Guards that the GBP figures billing charges never drift from the GBP figures
// marketing advertises for the two FIXED plans.
import { describe, it, expect } from "vitest";
import { CHAT_SUITE, VOICE_IGNITION } from "@/lib/marketing/pricing";
import {
  CHAT_SUITE_PRICE_GBP,
  CHAT_SUITE_SETUP_GBP,
  VOICE_IGNITION_SPEC,
} from "@/lib/billing/pricing";

describe("billing GBP matches marketing canonical GBP", () => {
  it("WhatsApp Suite price + setup", () => {
    expect(CHAT_SUITE_PRICE_GBP).toBe(CHAT_SUITE.priceGbp);
    expect(CHAT_SUITE_SETUP_GBP).toBe(CHAT_SUITE.setupGbp);
  });
  it("Voice Ignition price + calls + setup", () => {
    expect(VOICE_IGNITION_SPEC.priceGbp).toBe(VOICE_IGNITION.priceGbp);
    expect(VOICE_IGNITION_SPEC.callAllowance).toBe(VOICE_IGNITION.callsPerMonth);
    expect(VOICE_IGNITION_SPEC.setupGbp).toBe(VOICE_IGNITION.setupGbp);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/billing-pricing-drift.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/billing-pricing-drift.test.ts
git commit -m "test(billing): drift guard for the two fixed plans"
```

---

### Task A5: Marketing pricing-sections component (design kept)

**Files:**
- Modify: `src/components/marketing/pricing-sections.tsx`
- Test: `tests/pricing-sections.test.tsx`

- [ ] **Step 1: Write the failing test** — replace `tests/pricing-sections.test.tsx` body with:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingSections } from "@/components/marketing/pricing-sections";

const RATES = { GBP: 1, EUR: 1.18, USD: 1.27 };

describe("PricingSections (three offerings)", () => {
  it("renders the WhatsApp Booking Suite at £499 + £999 setup", () => {
    render(<PricingSections rates={RATES} />);
    expect(screen.getByText("WhatsApp Booking Suite")).toBeInTheDocument();
    expect(screen.getByText("£499")).toBeInTheDocument();
    expect(screen.getAllByText(/£999/).length).toBeGreaterThan(0);
  });
  it("renders AI Voice Ignition at 1,000 calls / £1,999", () => {
    render(<PricingSections rates={RATES} />);
    expect(screen.getByText("Ignition")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("£1,999")).toBeInTheDocument();
  });
  it("renders Full Throttle as a customised / discovery-call card", () => {
    render(<PricingSections rates={RATES} />);
    expect(screen.getByText("Full Throttle")).toBeInTheDocument();
    expect(screen.getByText(/Customised pack/i)).toBeInTheDocument();
  });
  it("does NOT mention Double Decker or Mix & Match", () => {
    render(<PricingSections rates={RATES} />);
    expect(screen.queryByText(/Double Decker/i)).toBeNull();
    expect(screen.queryByText(/Mix & Match/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pricing-sections.test.tsx`
Expected: FAIL — component still renders tiers/Mix & Match.

- [ ] **Step 3: Replace `src/components/marketing/pricing-sections.tsx`** with the full new file (keeps the existing Neo-Brutalism panel design — ink hairlines, `border-[3px]`, `shadow-brut-xl`, badges, currency toggle, setup tiles, extra-credit band; only the content changes):

```tsx
"use client";

import { useState } from "react";
import {
  CHAT_SUITE,
  VOICE_IGNITION,
  EXTRA_CALL_PRICE_GBP,
  priceFor,
  type Currency,
} from "@/lib/marketing/pricing";
import Image from "next/image";
import { VoiceGlyph } from "@/components/marketing/product-marks";
import { CurrencyToggle } from "@/components/marketing/currency-toggle";
import { DiscoveryCta } from "@/components/marketing/discovery-cta";
import { Badge } from "@/components/marketing/ui/badge";

type Rates = Record<Currency, number>;

/**
 * Stateful pricing block. Owns the selected currency, renders the toggle once,
 * then two product sections: the WhatsApp Booking Suite (one fixed price) and
 * AI Voice Booking (Ignition fixed tier + Full Throttle customised card).
 * Visual system unchanged — Neo-Brutalism rate-card panels.
 */
export function PricingSections({ rates }: { rates: Rates }) {
  const [currency, setCurrency] = useState<Currency>("GBP");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-bold uppercase tracking-[0.08em] text-gray-600">
          All plans /month · excl. VAT &amp; taxes · prices in {currency}
        </p>
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>
      {currency !== "GBP" && (
        <p className="mt-2 text-xs font-medium text-gray-500">
          {currency} figures are indicative, converted from GBP at today&apos;s rate. Billing is in GBP (£).
        </p>
      )}

      {/* 1. WHATSAPP BOOKING SUITE — one fixed price. */}
      <div className="mt-10">
        <Badge>WhatsApp Booking Suite</Badge>
        <div className="mt-4 grid gap-[3px] border-[3px] border-ink bg-ink shadow-brut-xl">
          <div className="flex flex-wrap items-center gap-4 bg-paper px-6 py-5 sm:px-8">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-ink bg-paper">
              <Image src="/social/whatsapp.png" alt="" width={48} height={48} className="h-9 w-9 object-contain" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-3xl">
                {CHAT_SUITE.name}
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-700 sm:text-base">
                Includes WhatsApp Chatbot + Voice Note. One simple price — books by text or voice note and writes the job straight to dispatch.
              </p>
            </div>
          </div>

          <div className="grid gap-[3px] bg-ink sm:grid-cols-2">
            <div className="flex flex-col bg-brut-cyan p-6 sm:p-7">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">One simple pricing</h4>
                <Badge tone="yellow">All-in</Badge>
              </div>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-5xl font-extrabold tabular-nums text-ink">
                  {priceFor(CHAT_SUITE.priceGbp, currency, rates)}
                </span>
                <span className="text-sm font-medium text-gray-700">/mo</span>
              </p>
              <p className="mt-2 text-sm font-medium text-ink/80">WhatsApp Chatbot + Voice Note, one bot.</p>
            </div>
            <div className="flex flex-col bg-paper p-6 sm:p-7">
              <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">One-time setup</h4>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold tabular-nums text-ink">
                  {priceFor(CHAT_SUITE.setupGbp, currency, rates)}
                </span>
              </p>
              <p className="mt-2 text-sm text-gray-700">Bespoke build, wired to your dispatch.</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 bg-paper px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm font-medium text-gray-700">Live in days. Cancel any time, rolling monthly.</p>
            <DiscoveryCta size="md" />
          </div>
        </div>
      </div>

      {/* 2. AI VOICE BOOKING — Ignition (fixed) + Full Throttle (custom). */}
      <div className="mt-14">
        <Badge>AI Voice Booking</Badge>
        <div className="mt-4 grid gap-[3px] border-[3px] border-ink bg-ink shadow-brut-xl">
          <div className="flex flex-wrap items-center gap-4 bg-ink px-6 py-5 sm:px-8">
            <VoiceGlyph className="h-12 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-[-0.02em] text-paper sm:text-3xl">
                AI Voice Booking
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
                An always-on agent that answers the phone and books the job. Start on Ignition, or scope a Full Throttle pack around your call volume.
              </p>
            </div>
          </div>

          <div className="grid gap-[3px] bg-ink sm:grid-cols-2">
            {/* A. IGNITION */}
            <div className="flex flex-col bg-brut-yellow p-6 sm:p-7">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">{VOICE_IGNITION.name}</h4>
                <Badge tone="paper">Most popular</Badge>
              </div>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-extrabold tabular-nums text-ink">
                  {VOICE_IGNITION.callsPerMonth.toLocaleString("en-US")}
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink/70">calls / mo</span>
              </p>
              <p className="mt-5 flex items-baseline gap-1 border-t-2 border-ink/15 pt-4">
                <span className="font-display text-3xl font-extrabold tabular-nums text-ink">
                  {priceFor(VOICE_IGNITION.priceGbp, currency, rates)}
                </span>
                <span className="text-sm font-medium text-ink/70">/mo</span>
              </p>
              <p className="mt-2 text-sm font-medium text-ink/80">
                One-time setup {priceFor(VOICE_IGNITION.setupGbp, currency, rates)}
              </p>
            </div>

            {/* B. FULL THROTTLE — customised pack */}
            <div className="flex flex-col bg-paper p-6 sm:p-7">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">Full Throttle</h4>
                <Badge>Custom</Badge>
              </div>
              <p className="mt-4 font-display text-3xl font-extrabold uppercase tracking-tight text-ink">
                Customised pack
              </p>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">
                Your call volume, agents, validity and rates — scoped on a discovery call and built to fit.
              </p>
              <div className="mt-5 border-t-2 border-ink/15 pt-4">
                <DiscoveryCta size="md" className="w-full" label="Book a discovery call" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 bg-paper px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="text-sm font-medium text-gray-700">Calls reset each month and don&apos;t carry over.</p>
            <DiscoveryCta size="md" />
          </div>
        </div>
      </div>

      {/* EXTRA VOICE CREDIT (base) */}
      <div className="mt-12 border-[3px] border-ink bg-brut-yellow px-6 py-6 shadow-brut sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">Extra voice credit</p>
          <p className="mt-1 text-sm font-medium text-ink/80">
            Top up any time. Charged per call, not per minute. 1 credit = one call.
          </p>
        </div>
        <p className="mt-3 shrink-0 sm:mt-0">
          <span className="font-display text-3xl font-extrabold tabular-nums text-ink">
            {priceFor(EXTRA_CALL_PRICE_GBP, currency, rates, 2)}
          </span>
          <span className="ml-1 text-sm font-bold uppercase tracking-[0.06em] text-ink/70">/ call</span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pricing-sections.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/pricing-sections.tsx tests/pricing-sections.test.tsx
git commit -m "feat(marketing): three-offering pricing panels (design kept)"
```

---

### Task A6: Marketing pricing page copy

**Files:**
- Modify: `src/app/(marketing)/pricing/page.tsx`

- [ ] **Step 1: Update the hero + intro copy** — replace the hero `<p>` (lines 49–55) so it no longer mentions "Double Decker / mix and match". New paragraph:

```tsx
          <p className="mt-6 text-lg leading-relaxed text-gray-600 sm:text-xl">
            Two ways to book: a WhatsApp Booking Suite (chatbot + voice note) and
            an AI Voice Booking agent. One simple price each, one setup fee. Need
            more than Ignition? Full Throttle is a customised pack scoped on a
            discovery call. Your telco, WhatsApp and dispatch providers you pay
            directly, at their cost.
          </p>
```

- [ ] **Step 2: Update the page `metadata.description`** (lines 14–17) to remove "Double Decker / mix and match / fleet size / call volume tiers". New description:

```tsx
  description:
    "Transparent pricing for BookMyCab. A WhatsApp Booking Suite (chatbot + voice note) at £499/mo and an AI Voice Booking agent from £1,999/mo (Ignition, 1,000 calls). Full Throttle is a customised pack. One-time setup, pay-as-you-go voice credit.",
```

- [ ] **Step 3: Verify build of the marketing route**

Run: `npm run build 2>&1 | head -40`
Expected: compiles without type errors referencing the pricing page. (Other pages may still error until later tasks — note them, continue.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(marketing)/pricing/page.tsx"
git commit -m "copy(marketing): pricing hero reflects three offerings"
```

---

## Phase B — Supabase schema (apply via Supabase MCP)

### Task B1: Migration 0068 — custom_plans + CHECK widening + plan_type

**Files:**
- Create: `supabase/migrations/0068_pricing_restructure_custom_plans.sql`

- [ ] **Step 1: Write the migration file:**

```sql
-- 0068: Pricing restructure — three offerings (WhatsApp Suite, Voice Ignition,
-- Custom) + admin-configurable custom plans. Additive + backward-compatible:
-- legacy 'double_decker' and tier values stay valid for grandfathered rows.

-- 1. Widen tenants.commercial_model to allow 'custom' (keep legacy values).
alter table public.tenants drop constraint if exists tenants_commercial_model_check;
alter table public.tenants add constraint tenants_commercial_model_check
  check (commercial_model in ('chat','voice','double_decker','custom'));

-- 2. Plan-type marker (which of the three offerings). Null for legacy tenants.
alter table public.tenants
  add column if not exists plan_type text
  check (plan_type is null or plan_type in ('whatsapp_suite','voice_ignition','custom'));

-- 3. Allow 'custom' as a plan_tier on both subscription tables.
alter table public.voice_subscriptions drop constraint if exists voice_subscriptions_plan_tier_check;
alter table public.voice_subscriptions add constraint voice_subscriptions_plan_tier_check
  check (plan_tier in ('ignition','in_motion','full_throttle','custom'));
alter table public.chat_subscriptions drop constraint if exists chat_subscriptions_plan_tier_check;
alter table public.chat_subscriptions add constraint chat_subscriptions_plan_tier_check
  check (plan_tier in ('ignition','in_motion','full_throttle','custom'));

-- 4. Store the activation invoice's hosted pay link on the setup_fees row
--    (the activation invoice == setup + first period).
alter table public.setup_fees add column if not exists hosted_invoice_url text;

-- 5. Custom plan detail (one row per custom-plan tenant).
create table if not exists public.custom_plans (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  plan_name              text not null,
  billing_mode           text not null check (billing_mode in ('recurring','one_time')),
  includes_chat          boolean not null default false,
  includes_voice         boolean not null default true,
  monthly_call_allowance integer not null default 0 check (monthly_call_allowance >= 0),
  included_agents        integer not null default 1 check (included_agents >= 0),
  price_per_call_gbp     numeric(10,4),
  plan_price_gbp         numeric(10,2) not null check (plan_price_gbp >= 0),
  chat_monthly_gbp       numeric(10,2) check (chat_monthly_gbp is null or chat_monthly_gbp >= 0),
  setup_fee_gbp          numeric(10,2) not null default 0 check (setup_fee_gbp >= 0),
  validity_days          integer not null default 30 check (validity_days > 0),
  extra_credit_price_gbp numeric(10,4) not null default 0.90 check (extra_credit_price_gbp >= 0),
  starts_at              date,
  expires_at             date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.custom_plans enable row level security;
-- Tenant may read its own custom plan; all writes go via service_role.
create policy custom_plans_select on public.custom_plans
  for select using (tenant_id in (select public.current_user_tenants()));
```

- [ ] **Step 2: Apply via Supabase MCP** — call `mcp__supabase__apply_migration` with `name: "0068_pricing_restructure_custom_plans"` and the SQL above. Then `mcp__supabase__list_tables` (schema `public`) and confirm `custom_plans` exists with the columns above.

- [ ] **Step 3: Regenerate TypeScript types** — call `mcp__supabase__generate_typescript_types` and, if the repo keeps a generated types file (check `src/lib/supabase/` and `src/types/`), overwrite it. If no generated file is tracked, skip (the codebase uses `as` casts, not generated types).

- [ ] **Step 4: Run advisors** — call `mcp__supabase__get_advisors` with `type: "security"` and confirm no new RLS warnings for `custom_plans`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0068_pricing_restructure_custom_plans.sql
git commit -m "feat(db): custom_plans table + plan_type + activation invoice url"
```

---

## Phase C — Provisioning (admin new tenant form)

### Task C1: Provisioning schema + row builder

**Files:**
- Modify: `src/app/admin/tenants/provisioning.ts`
- Test: `tests/billing-new-model.test.ts`

- [ ] **Step 1: Write the failing test** — replace `tests/billing-new-model.test.ts` body with:

```ts
import { describe, it, expect } from "vitest";
import { buildProvisioningRows, createTenantSchema } from "@/app/admin/tenants/provisioning";

const baseForm = {
  name: "Speedy Cabs", slug: "speedy-cabs", country: "GB",
  contact_email: "owner@speedy.co.uk", dispatch_adapter: "autocab",
  plan_type: "voice_ignition",
};

describe("createTenantSchema", () => {
  it("accepts a base voice_ignition tenant", () => {
    expect(createTenantSchema.safeParse(baseForm).success).toBe(true);
  });
  it("requires custom fields when plan_type=custom", () => {
    const r = createTenantSchema.safeParse({ ...baseForm, plan_type: "custom" });
    expect(r.success).toBe(false);
  });
  it("accepts a full custom plan", () => {
    const r = createTenantSchema.safeParse({
      ...baseForm, plan_type: "custom",
      custom_plan_name: "Airport Pack", custom_billing_mode: "recurring",
      custom_includes_voice: "on", custom_call_allowance: "5000",
      custom_included_agents: "3", custom_plan_price_gbp: "4500",
      custom_setup_fee_gbp: "1500", custom_validity_days: "30",
      custom_extra_credit_price_gbp: "0.75",
    });
    expect(r.success).toBe(true);
  });
});

describe("buildProvisioningRows", () => {
  it("whatsapp_suite: chat row £499, no voice, setup £999, model=chat", () => {
    const rows = buildProvisioningRows({
      data: createTenantSchema.parse({ ...baseForm, plan_type: "whatsapp_suite" }),
      discountPercent: 0, bypass: false,
    });
    expect(rows.tenant.commercial_model).toBe("chat");
    expect(rows.tenant.plan_type).toBe("whatsapp_suite");
    expect(rows.tenant.monthly_price).toBe(499);
    expect(rows.chat).toEqual({ plan_tier: "ignition", monthly_price_gbp: 499 });
    expect(rows.voice).toBeNull();
    expect(rows.custom).toBeNull();
    expect(rows.setupGbp).toBe(999);
  });

  it("voice_ignition: voice row 1000 calls £1999, setup £999, model=voice", () => {
    const rows = buildProvisioningRows({
      data: createTenantSchema.parse(baseForm), discountPercent: 0, bypass: false,
    });
    expect(rows.tenant.commercial_model).toBe("voice");
    expect(rows.voice).toEqual({
      plan_tier: "ignition", monthly_price_gbp: 1999,
      monthly_call_allowance: 1000, included_agents: 1,
    });
    expect(rows.chat).toBeNull();
    expect(rows.setupGbp).toBe(999);
  });

  it("custom recurring voice: custom row + voice row (plan_tier custom) + model=custom", () => {
    const data = createTenantSchema.parse({
      ...baseForm, plan_type: "custom",
      custom_plan_name: "Airport Pack", custom_billing_mode: "recurring",
      custom_includes_voice: "on", custom_call_allowance: "5000",
      custom_included_agents: "3", custom_plan_price_gbp: "4500",
      custom_setup_fee_gbp: "1500", custom_validity_days: "30",
      custom_extra_credit_price_gbp: "0.75",
    });
    const rows = buildProvisioningRows({ data, discountPercent: 0, bypass: false });
    expect(rows.tenant.commercial_model).toBe("custom");
    expect(rows.tenant.plan_type).toBe("custom");
    expect(rows.tenant.monthly_price).toBe(4500);
    expect(rows.voice).toEqual({
      plan_tier: "custom", monthly_price_gbp: 4500,
      monthly_call_allowance: 5000, included_agents: 3,
    });
    expect(rows.custom).toMatchObject({
      plan_name: "Airport Pack", billing_mode: "recurring",
      monthly_call_allowance: 5000, included_agents: 3,
      plan_price_gbp: 4500, setup_fee_gbp: 1500, validity_days: 30,
      extra_credit_price_gbp: 0.75, includes_voice: true, includes_chat: false,
    });
    expect(rows.setupGbp).toBe(1500);
  });

  it("100%-off bypass zeroes every price", () => {
    const rows = buildProvisioningRows({
      data: createTenantSchema.parse(baseForm), discountPercent: 100, bypass: true,
    });
    expect(rows.tenant.monthly_price).toBe(0);
    expect(rows.voice?.monthly_price_gbp).toBe(0);
    expect(rows.setupGbp).toBe(0);
    expect(rows.tenant.status).toBe("active");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-new-model.test.ts`
Expected: FAIL — schema/builder don't know `plan_type`/custom fields.

- [ ] **Step 3: Rewrite `src/app/admin/tenants/provisioning.ts`:**

```ts
/**
 * Pure provisioning model — schema, types, and the DB-free row builder.
 * Exports are synchronous so they can be shared by the "use server" action and
 * the client form (a Server Actions module may only export async functions).
 */
import { z } from "zod";
import {
  resolveBasePlanPricing,
  planTypeCommercialModel,
  type CommercialModel,
  type PlanType,
} from "@/lib/billing/pricing";
import { resolveCustomPlan, packExpiry, type CustomPlanInput } from "@/lib/billing/custom-plan";
import { applyDiscount } from "@/lib/admin/coupons";
import { COUNTRY_CODES } from "@/lib/billing/country";

export type TenantFormState = {
  fieldErrors: Record<string, string[]>;
  formError: string | null;
};

const optionalText = z.string().trim().transform((v) => v || undefined).optional();
const PLAN_TYPES = ["whatsapp_suite", "voice_ignition", "custom"] as const;
const DISPATCH_ADAPTERS = ["autocab", "icabbi", "cordic"] as const;
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const createTenantSchema = z
  .object({
    name: z.string().trim().min(1, "Org name is required."),
    slug: z
      .string().trim().min(1, "Slug is required.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and single hyphens."),
    country: z.enum(COUNTRY_CODES, { message: "Select a valid country." }),
    contact_email: z.string().trim().email("Enter a valid contact email."),
    dispatch_adapter: z.enum(DISPATCH_ADAPTERS),
    dispatch_company_id: optionalText,
    plan_type: z.enum(PLAN_TYPES),
    coupon_code: optionalText,
    // Custom-plan fields (only required when plan_type === "custom").
    custom_plan_name: optionalText,
    custom_billing_mode: z.enum(["recurring", "one_time"]).optional(),
    custom_includes_chat: checkbox.optional(),
    custom_includes_voice: checkbox.optional(),
    custom_call_allowance: optionalText,
    custom_included_agents: optionalText,
    custom_price_per_call_gbp: optionalText,
    custom_plan_price_gbp: optionalText,
    custom_chat_monthly_gbp: optionalText,
    custom_setup_fee_gbp: optionalText,
    custom_validity_days: optionalText,
    custom_extra_credit_price_gbp: optionalText,
  })
  .superRefine((d, ctx) => {
    if (d.plan_type !== "custom") return;
    const ok = (v: unknown) => v !== undefined && v !== "";
    if (!ok(d.custom_plan_name)) ctx.addIssue({ code: "custom", path: ["custom_plan_name"], message: "Plan name is required." });
    if (!d.custom_billing_mode) ctx.addIssue({ code: "custom", path: ["custom_billing_mode"], message: "Pick a billing mode." });
    if (!ok(d.custom_plan_price_gbp)) ctx.addIssue({ code: "custom", path: ["custom_plan_price_gbp"], message: "Set the plan price." });
    if (!ok(d.custom_validity_days)) ctx.addIssue({ code: "custom", path: ["custom_validity_days"], message: "Set the pack validity." });
    if (!d.custom_includes_chat && !d.custom_includes_voice)
      ctx.addIssue({ code: "custom", path: ["custom_includes_voice"], message: "Include the WhatsApp Suite, AI Voice, or both." });
    if (d.custom_includes_chat && !ok(d.custom_chat_monthly_gbp))
      ctx.addIssue({ code: "custom", path: ["custom_chat_monthly_gbp"], message: "Set the WhatsApp Suite monthly price." });
  });

export type CreateTenantData = z.infer<typeof createTenantSchema>;

export interface CustomPlanRow {
  plan_name: string;
  billing_mode: "recurring" | "one_time";
  includes_chat: boolean;
  includes_voice: boolean;
  monthly_call_allowance: number;
  included_agents: number;
  price_per_call_gbp: number | null;
  plan_price_gbp: number;
  chat_monthly_gbp: number | null;
  setup_fee_gbp: number;
  validity_days: number;
  extra_credit_price_gbp: number;
  starts_at: string;
  expires_at: string;
}

export interface ProvisioningRows {
  tenant: {
    name: string;
    slug: string;
    country: string;
    currency: "GBP";
    commercial_model: CommercialModel;
    plan_type: PlanType;
    monthly_price: number;
    dispatch_adapter: string;
    dispatch_company_id: string | null;
    contact_email: string;
    coupon_code: string | null;
    discount_percent: number;
    billing_bypass: boolean;
    status: "onboarding" | "active";
  };
  chat: { plan_tier: "ignition" | "custom"; monthly_price_gbp: number } | null;
  voice: {
    plan_tier: "ignition" | "custom";
    monthly_price_gbp: number;
    monthly_call_allowance: number;
    included_agents: number;
  } | null;
  custom: CustomPlanRow | null;
  setupGbp: number;
}

/** Build the custom-plan input from the validated form fields. */
function toCustomInput(d: CreateTenantData): CustomPlanInput {
  return {
    planName: d.custom_plan_name ?? "",
    billingMode: d.custom_billing_mode ?? "recurring",
    includesChat: Boolean(d.custom_includes_chat),
    includesVoice: Boolean(d.custom_includes_voice),
    callAllowance: Number(d.custom_call_allowance ?? 0),
    includedAgents: Number(d.custom_included_agents ?? 0),
    pricePerCallGbp: d.custom_price_per_call_gbp != null ? Number(d.custom_price_per_call_gbp) : null,
    planPriceGbp: Number(d.custom_plan_price_gbp ?? 0),
    chatMonthlyGbp: d.custom_chat_monthly_gbp != null ? Number(d.custom_chat_monthly_gbp) : null,
    setupFeeGbp: Number(d.custom_setup_fee_gbp ?? 0),
    validityDays: Number(d.custom_validity_days ?? 30),
    extraCreditPriceGbp: Number(d.custom_extra_credit_price_gbp ?? 0.9),
  };
}

/**
 * Pure provisioning-row builder. Resolves base or custom pricing, applies the
 * coupon discount (or forces 0 on bypass), and shapes the tenant + chat/voice +
 * custom rows. DB-free so it is unit-testable.
 */
export function buildProvisioningRows(args: {
  data: CreateTenantData;
  discountPercent: number;
  bypass: boolean;
}): ProvisioningRows {
  const { data, discountPercent, bypass } = args;
  const priced = (base: number | null): number | null =>
    base === null ? null : bypass ? 0 : applyDiscount(base, discountPercent);

  if (data.plan_type === "custom") {
    const input = toCustomInput(data);
    const r = resolveCustomPlan(input);
    const chatGbp = r.chatGbp === null ? null : priced(r.chatGbp);
    const voiceGbp = r.voiceGbp === null ? null : priced(r.voiceGbp);
    const startsAt = new Date().toISOString().slice(0, 10);
    return {
      tenant: {
        name: data.name, slug: data.slug, country: data.country, currency: "GBP",
        commercial_model: "custom", plan_type: "custom",
        monthly_price: (chatGbp ?? 0) + (voiceGbp ?? 0),
        dispatch_adapter: data.dispatch_adapter,
        dispatch_company_id: data.dispatch_company_id ?? null,
        contact_email: data.contact_email,
        coupon_code: data.coupon_code ?? null,
        discount_percent: discountPercent, billing_bypass: bypass,
        status: bypass ? "active" : "onboarding",
      },
      chat: input.includesChat ? { plan_tier: "custom", monthly_price_gbp: chatGbp ?? 0 } : null,
      voice: input.includesVoice
        ? {
            plan_tier: "custom",
            monthly_price_gbp: voiceGbp ?? 0,
            monthly_call_allowance: r.voiceAllowance ?? 0,
            included_agents: r.voiceAgents ?? 0,
          }
        : null,
      custom: {
        plan_name: input.planName,
        billing_mode: input.billingMode,
        includes_chat: input.includesChat,
        includes_voice: input.includesVoice,
        monthly_call_allowance: input.callAllowance,
        included_agents: input.includedAgents,
        price_per_call_gbp: input.pricePerCallGbp ?? null,
        plan_price_gbp: voiceGbp ?? input.planPriceGbp,
        chat_monthly_gbp: chatGbp,
        setup_fee_gbp: bypass ? 0 : applyDiscount(input.setupFeeGbp, discountPercent),
        validity_days: input.validityDays,
        extra_credit_price_gbp: input.extraCreditPriceGbp,
        starts_at: startsAt,
        expires_at: packExpiry(startsAt, input.validityDays),
      },
      setupGbp: bypass ? 0 : applyDiscount(input.setupFeeGbp, discountPercent),
    };
  }

  // Fixed base plan.
  const resolved = resolveBasePlanPricing(data.plan_type)!;
  const chatGbp = resolved.chatGbp === null ? null : priced(resolved.chatGbp) ?? 0;
  const voiceGbp = resolved.voiceGbp === null ? null : priced(resolved.voiceGbp) ?? 0;
  return {
    tenant: {
      name: data.name, slug: data.slug, country: data.country, currency: "GBP",
      commercial_model: planTypeCommercialModel(data.plan_type),
      plan_type: data.plan_type,
      monthly_price: (chatGbp ?? 0) + (voiceGbp ?? 0),
      dispatch_adapter: data.dispatch_adapter,
      dispatch_company_id: data.dispatch_company_id ?? null,
      contact_email: data.contact_email,
      coupon_code: data.coupon_code ?? null,
      discount_percent: discountPercent, billing_bypass: bypass,
      status: bypass ? "active" : "onboarding",
    },
    chat: resolved.chatGbp !== null ? { plan_tier: "ignition", monthly_price_gbp: chatGbp ?? 0 } : null,
    voice:
      resolved.voiceGbp !== null
        ? {
            plan_tier: "ignition",
            monthly_price_gbp: voiceGbp ?? 0,
            monthly_call_allowance: resolved.voiceAllowance ?? 0,
            included_agents: resolved.voiceAgents ?? 0,
          }
        : null,
    custom: null,
    setupGbp: bypass ? 0 : applyDiscount(resolved.setupGbp, discountPercent),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-new-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/tenants/provisioning.ts tests/billing-new-model.test.ts
git commit -m "feat(admin): provisioning rows for plan_type + custom plans"
```

---

### Task C2: New-tenant form — plan_type selector + custom panel

**Files:**
- Modify: `src/app/admin/tenants/new/tenant-form.tsx`

- [ ] **Step 1: Replace the imports + the commercial-model section.** Update the top imports (lines 8–14) to:

```tsx
import {
  resolveBasePlanPricing,
  type PlanType,
} from "@/lib/billing/pricing";
import { resolveCustomPlan } from "@/lib/billing/custom-plan";
import { formatPrice } from "@/lib/marketing/pricing";
import { COUNTRIES } from "@/lib/billing/country";
```

Replace the `COMMERCIAL_MODELS`/`TIERS` constants (lines 22–32) with:

```tsx
const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: "whatsapp_suite", label: "WhatsApp Booking Suite — £499/mo" },
  { value: "voice_ignition", label: "AI Voice — Ignition (1,000 calls, £1,999/mo)" },
  { value: "custom", label: "Custom (Full Throttle)" },
];
```

- [ ] **Step 2: Replace the form state hooks** (lines 156–175). Remove `commercialModel`/`chatTier`/`voiceTier`/`hasChat`/`hasVoice`/`resolved` and add:

```tsx
  const [planType, setPlanType] = useState<PlanType>("voice_ignition");
  // Custom-plan fields (controlled so the live summary updates).
  const [billingMode, setBillingMode] = useState<"recurring" | "one_time">("recurring");
  const [includesChat, setIncludesChat] = useState(false);
  const [includesVoice, setIncludesVoice] = useState(true);
  const [callAllowance, setCallAllowance] = useState("5000");
  const [includedAgents, setIncludedAgents] = useState("2");
  const [planPrice, setPlanPrice] = useState("4500");
  const [chatMonthly, setChatMonthly] = useState("499");
  const [setupFee, setSetupFee] = useState("1500");
  const [validityDays, setValidityDays] = useState("30");
  const [pricePerCall, setPricePerCall] = useState("0.90");
  const [extraCredit, setExtraCredit] = useState("0.75");

  const base = planType === "custom" ? null : resolveBasePlanPricing(planType);
  const custom =
    planType === "custom"
      ? resolveCustomPlan({
          planName: "preview", billingMode,
          includesChat, includesVoice,
          callAllowance: Number(callAllowance || 0),
          includedAgents: Number(includedAgents || 0),
          planPriceGbp: Number(planPrice || 0),
          chatMonthlyGbp: includesChat ? Number(chatMonthly || 0) : null,
          setupFeeGbp: Number(setupFee || 0),
          validityDays: Number(validityDays || 30),
          extraCreditPriceGbp: Number(extraCredit || 0),
          pricePerCallGbp: Number(pricePerCall || 0),
        })
      : null;
  const summaryChat = base ? base.chatGbp : custom?.chatGbp ?? null;
  const summaryVoice = base ? base.voiceGbp : custom?.voiceGbp ?? null;
  const summarySetup = base ? base.setupGbp : custom?.setupGbp ?? 0;
  const summaryFirst = base
    ? (summaryChat ?? 0) + (summaryVoice ?? 0) + base.setupGbp
    : (custom?.firstPeriodGbp ?? 0) + (custom?.setupGbp ?? 0);
```

- [ ] **Step 3: Replace the `<fieldset>` "Commercial model" block** (lines 264–358) with the plan-type select + conditional custom fields + summary. Reuse the existing `Field` / `SelectField` helpers and `inputClass`:

```tsx
      <fieldset className="flex flex-col gap-5 border-[3px] border-ink bg-paper p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">Commercial model</legend>

        <SelectField
          id={modelId}
          name="plan_type"
          label="Plan"
          value={planType}
          onChange={(v) => setPlanType(v as PlanType)}
          error={fe.plan_type?.[0]}
        >
          {PLAN_TYPES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </SelectField>

        {planType === "custom" && (
          <div className="flex flex-col gap-5 border-[3px] border-ink bg-brut-yellow/10 p-4">
            <p className="font-display text-sm font-extrabold uppercase tracking-tight text-ink">
              Custom Full Throttle pack
            </p>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field id={`${modelId}-cpn`} name="custom_plan_name" label="Plan name"
                value={customPlanName} onChange={(e) => setCustomPlanName(e.target.value)}
                placeholder="Airport Pack" error={fe.custom_plan_name?.[0]} />
              <SelectField id={`${modelId}-cbm`} name="custom_billing_mode" label="Billing mode"
                value={billingMode} onChange={(v) => setBillingMode(v as "recurring" | "one_time")}
                error={fe.custom_billing_mode?.[0]}>
                <option value="recurring">Recurring (renews every validity period)</option>
                <option value="one_time">One-time prepaid pack</option>
              </SelectField>
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="custom_includes_voice" checked={includesVoice}
                  onChange={(e) => setIncludesVoice(e.target.checked)} className="h-4 w-4 border-2 border-ink" />
                Include AI Voice
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="custom_includes_chat" checked={includesChat}
                  onChange={(e) => setIncludesChat(e.target.checked)} className="h-4 w-4 border-2 border-ink" />
                Include WhatsApp Suite
              </label>
            </div>
            {fe.custom_includes_voice?.[0] && (
              <p role="alert" className="text-xs text-brut-red-deep">{fe.custom_includes_voice[0]}</p>
            )}

            {includesVoice && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id={`${modelId}-ca`} name="custom_call_allowance" label="Number of calls (per period)"
                  type="number" min="0" value={callAllowance} onChange={(e) => setCallAllowance(e.target.value)} />
                <Field id={`${modelId}-ag`} name="custom_included_agents" label="Number of agents"
                  type="number" min="0" value={includedAgents} onChange={(e) => setIncludedAgents(e.target.value)} />
                <Field id={`${modelId}-ppc`} name="custom_price_per_call_gbp" label="Price per call (£, in-pack)"
                  type="number" step="0.01" min="0" value={pricePerCall} onChange={(e) => setPricePerCall(e.target.value)} />
                <Field id={`${modelId}-pp`} name="custom_plan_price_gbp" label="Plan / pack price (£)"
                  type="number" step="0.01" min="0" value={planPrice} onChange={(e) => setPlanPrice(e.target.value)}
                  error={fe.custom_plan_price_gbp?.[0]} />
                <Field id={`${modelId}-xc`} name="custom_extra_credit_price_gbp" label="Per-call extra credit (£, overage)"
                  type="number" step="0.01" min="0" value={extraCredit} onChange={(e) => setExtraCredit(e.target.value)} />
                <Field id={`${modelId}-vd`} name="custom_validity_days" label="Pack validity (days from start)"
                  type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)}
                  error={fe.custom_validity_days?.[0]} />
              </div>
            )}
            {includesChat && (
              <Field id={`${modelId}-cm`} name="custom_chat_monthly_gbp" label="WhatsApp Suite monthly (£)"
                type="number" step="0.01" min="0" value={chatMonthly} onChange={(e) => setChatMonthly(e.target.value)}
                error={fe.custom_chat_monthly_gbp?.[0]} />
            )}
            <Field id={`${modelId}-sf`} name="custom_setup_fee_gbp" label="Setup fee (£, one-time)"
              type="number" step="0.01" min="0" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} />
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-[3px] border-ink bg-brut-lime/10 px-4 py-3 text-sm">
          <p className="font-medium text-gray-700">Price summary</p>
          {summaryChat !== null && <p className="text-ink">WhatsApp Suite: <span className="font-semibold">{formatPrice("GBP", summaryChat)}/mo</span></p>}
          {summaryVoice !== null && <p className="text-ink">AI Voice: <span className="font-semibold">{formatPrice("GBP", summaryVoice)}/mo</span></p>}
          <p className="text-ink">Setup (one-time): <span className="font-semibold">{formatPrice("GBP", summarySetup)}</span></p>
          <p className="text-ink">First invoice (setup + first period): <span className="font-semibold">{formatPrice("GBP", summaryFirst)}</span></p>
          <p className="text-xs text-gray-500">Prices in GBP. The tenant is emailed this invoice to pay.</p>
        </div>
      </fieldset>
```

> Add `const [customPlanName, setCustomPlanName] = useState("");` to the state block in Step 2 (used above).

- [ ] **Step 4: Remove the now-unused `chatTierId`/`voiceTierId` `useId()` calls** (lines 147–148) and the `slugify`-adjacent dead imports. Keep `modelId`.

- [ ] **Step 5: Verify it compiles**

Run: `npm run build 2>&1 | grep -iE "tenant-form|provisioning" | head`
Expected: no errors referencing these files.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/tenants/new/tenant-form.tsx
git commit -m "feat(admin): plan_type selector + granular custom-plan form"
```

---

### Task C3: createTenant action — persist custom + issue activation invoice

**Files:**
- Modify: `src/app/admin/tenants/actions.ts`
- Test: `tests/admin-provisioning-action.test.ts`

- [ ] **Step 1: Update `tests/admin-provisioning-action.test.ts`** — read it first; wherever it builds `raw` form data with `commercial_model`/`chat_tier`/`voice_tier`, replace those keys with `plan_type`. Add a test asserting that when a `custom` plan is provisioned, a `custom_plans` insert is attempted (assert the fake Supabase client received an insert into `"custom_plans"`). Keep the existing assertions for tenant/voice/chat/setup_fees inserts but switch tier expectations to `"ignition"`/`"custom"`. (Match the file's existing fake-client harness; do not invent a new one.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin-provisioning-action.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `createTenant`** in `src/app/admin/tenants/actions.ts`:
  - Change the `raw` object (lines 38–49) to read `plan_type` plus all `custom_*` fields instead of `commercial_model`/`chat_tier`/`voice_tier`:

```ts
  const raw = {
    name: field("name"),
    slug: field("slug"),
    country: field("country"),
    contact_email: field("contact_email"),
    dispatch_adapter: field("dispatch_adapter"),
    dispatch_company_id: field("dispatch_company_id"),
    plan_type: field("plan_type"),
    coupon_code: field("coupon_code"),
    custom_plan_name: field("custom_plan_name"),
    custom_billing_mode: field("custom_billing_mode"),
    custom_includes_chat: field("custom_includes_chat"),
    custom_includes_voice: field("custom_includes_voice"),
    custom_call_allowance: field("custom_call_allowance"),
    custom_included_agents: field("custom_included_agents"),
    custom_price_per_call_gbp: field("custom_price_per_call_gbp"),
    custom_plan_price_gbp: field("custom_plan_price_gbp"),
    custom_chat_monthly_gbp: field("custom_chat_monthly_gbp"),
    custom_setup_fee_gbp: field("custom_setup_fee_gbp"),
    custom_validity_days: field("custom_validity_days"),
    custom_extra_credit_price_gbp: field("custom_extra_credit_price_gbp"),
  };
```

  - After the `voice_subscriptions` insert block (after line 174) and before the `setup_fees` insert, add the custom-plan insert:

```ts
  // Persist the custom-plan detail row when this is a custom plan.
  if (rows.custom) {
    const { error: customError } = await serviceClient.from("custom_plans").insert({
      tenant_id: tenantId,
      ...rows.custom,
    });
    if (customError) {
      console.error("createTenant: failed to record custom plan", customError);
      return failProvision("Could not record the custom plan. Please try again.");
    }
  }
```

  - Update the audit metadata block (lines 211–221) to log `plan_type: data.plan_type` and drop `chat_tier`/`voice_tier`/`commercial_model` (replace with `commercial_model: rows.tenant.commercial_model`).
  - Just before `redirect(...)` (line 227), kick off the activation invoice + email for non-bypass tenants (best-effort — never block the redirect on Stripe):

```ts
  // Issue the activation invoice (setup + first period) and email the tenant a
  // pay link. Best-effort: a Stripe/email hiccup must not fail provisioning —
  // staff can re-send from the tenant billing panel.
  if (!bypass) {
    try {
      const { issueActivationInvoice } = await import("./[tenantId]/billing-actions");
      await issueActivationInvoice(tenantId);
    } catch (err) {
      console.error("createTenant: activation invoice failed (tenant still created)", { tenantId, err });
    }
  }

  redirect(`/admin/tenants/${tenantId}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin-provisioning-action.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/tenants/actions.ts tests/admin-provisioning-action.test.ts
git commit -m "feat(admin): persist custom plan + auto-issue activation invoice"
```

---

## Phase D — Stripe activation invoice + email

### Task D1: Activation-charges pure planner

**Files:**
- Create: `src/lib/billing/activation-charges.ts`
- Test: `tests/billing-activation-charges.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/billing-activation-charges.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { planActivationCharges } from "@/lib/billing/activation-charges";

describe("planActivationCharges", () => {
  it("recurring base voice: subscription + setup invoice item, first invoice = setup + month", () => {
    const p = planActivationCharges({
      billingMode: "recurring",
      setupGbp: 999,
      chat: null,
      voice: { monthly_price_gbp: 1999, stripe_subscription_id: null },
    });
    expect(p.mode).toBe("recurring");
    expect(p.setupGbp).toBe(999);
    expect(p.subscriptions).toEqual([{ product: "voice", monthlyGbp: 1999 }]);
    expect(p.oneTimeLines).toEqual([]);
  });

  it("recurring with chat + voice: two subscriptions", () => {
    const p = planActivationCharges({
      billingMode: "recurring", setupGbp: 1500,
      chat: { monthly_price_gbp: 499, stripe_subscription_id: null },
      voice: { monthly_price_gbp: 4500, stripe_subscription_id: null },
    });
    expect(p.subscriptions).toEqual([
      { product: "chat", monthlyGbp: 499 },
      { product: "voice", monthlyGbp: 4500 },
    ]);
  });

  it("one_time pack: no subscriptions; one-time line = pack price; setup separate item", () => {
    const p = planActivationCharges({
      billingMode: "one_time", setupGbp: 1500,
      chat: null,
      voice: { monthly_price_gbp: 6000, stripe_subscription_id: null },
    });
    expect(p.mode).toBe("one_time");
    expect(p.subscriptions).toEqual([]);
    expect(p.oneTimeLines).toEqual([
      { label: "BookMyCab — AI Voice pack", amountGbp: 6000 },
    ]);
    expect(p.setupGbp).toBe(1500);
  });

  it("skips a product that already has a stripe subscription (idempotent re-run)", () => {
    const p = planActivationCharges({
      billingMode: "recurring", setupGbp: 0,
      chat: null,
      voice: { monthly_price_gbp: 1999, stripe_subscription_id: "sub_live" },
    });
    expect(p.subscriptions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-activation-charges.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Create `src/lib/billing/activation-charges.ts`:**

```ts
/**
 * Pure planner for the activation invoice (setup + first period). DB/Stripe-free.
 * Recurring → one subscription per product (first invoice folds in the setup
 * fee via add_invoice_items at the call site). One-time → no subscription; the
 * pack price + setup become one-off invoice lines.
 */
type SubRow = { monthly_price_gbp: number; stripe_subscription_id: string | null } | null;

export interface ActivationPlan {
  mode: "recurring" | "one_time";
  setupGbp: number;
  subscriptions: Array<{ product: "chat" | "voice"; monthlyGbp: number }>;
  oneTimeLines: Array<{ label: string; amountGbp: number }>;
}

export function planActivationCharges(args: {
  billingMode: "recurring" | "one_time";
  setupGbp: number;
  chat: SubRow;
  voice: SubRow;
}): ActivationPlan {
  if (args.billingMode === "one_time") {
    const oneTimeLines: ActivationPlan["oneTimeLines"] = [];
    if (args.chat) oneTimeLines.push({ label: "BookMyCab — WhatsApp Suite", amountGbp: args.chat.monthly_price_gbp });
    if (args.voice) oneTimeLines.push({ label: "BookMyCab — AI Voice pack", amountGbp: args.voice.monthly_price_gbp });
    return { mode: "one_time", setupGbp: args.setupGbp, subscriptions: [], oneTimeLines };
  }
  const subscriptions: ActivationPlan["subscriptions"] = [];
  if (args.chat && !args.chat.stripe_subscription_id)
    subscriptions.push({ product: "chat", monthlyGbp: args.chat.monthly_price_gbp });
  if (args.voice && !args.voice.stripe_subscription_id)
    subscriptions.push({ product: "voice", monthlyGbp: args.voice.monthly_price_gbp });
  return { mode: "recurring", setupGbp: args.setupGbp, subscriptions, oneTimeLines: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-activation-charges.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/activation-charges.ts tests/billing-activation-charges.test.ts
git commit -m "feat(billing): pure activation-charge planner"
```

---

### Task D2: Activation invoice email template

**Files:**
- Modify: `src/lib/email/templates.ts`
- Test: `tests/billing-activation-email.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/billing-activation-email.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { activationInvoiceEmail } from "@/lib/email/templates";

describe("activationInvoiceEmail", () => {
  const body = activationInvoiceEmail({
    tenantName: "Speedy Cabs",
    planLabel: "AI Voice — Ignition",
    amountMajor: 2998,
    currency: "GBP",
    invoiceUrl: "https://invoice.stripe.com/i/test_123",
  });
  it("has a pay CTA to the hosted invoice", () => {
    expect(body.html).toContain("https://invoice.stripe.com/i/test_123");
    expect(body.text).toContain("https://invoice.stripe.com/i/test_123");
  });
  it("shows the amount and plan", () => {
    expect(body.subject).toContain("Speedy Cabs");
    expect(body.html).toContain("£2,998");
    expect(body.html).toContain("AI Voice — Ignition");
  });
  it("never leaks internal engine vocabulary", () => {
    expect(body.html.toLowerCase()).not.toContain("n8n");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-activation-email.test.ts`
Expected: FAIL — export missing.

- [ ] **Step 3: Append `activationInvoiceEmail` to `src/lib/email/templates.ts`** (after `paymentReceivedEmail`):

```ts
/**
 * Activation invoice: the first invoice (setup + first period) a tenant must
 * pay before their automation goes live. CTA → the Stripe hosted invoice.
 */
export function activationInvoiceEmail(args: {
  tenantName: string;
  planLabel: string;
  amountMajor: number;
  currency: Currency;
  invoiceUrl: string;
}): EmailBody {
  const amount = formatPrice(args.currency, args.amountMajor);
  return render(`Your BookMyCab invoice is ready, ${args.tenantName} (${amount})`, {
    heading: `Your BookMyCab invoice is ready`,
    paragraphs: [
      `Thanks for choosing BookMyCab, ${args.tenantName}. Your ${args.planLabel} plan is set up and ready.`,
      `To activate your automation, please settle the invoice below. As soon as it's paid, our team takes your automation live, you don't need to do anything else.`,
    ],
    facts: [
      ["Plan", args.planLabel],
      ["Amount due", amount],
    ],
    cta: { label: "Pay your invoice", url: args.invoiceUrl },
    note: "This is a one-time setup plus your first billing period. Future invoices follow your normal cycle.",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-activation-email.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/email/templates.ts tests/billing-activation-email.test.ts
git commit -m "feat(email): activation invoice template with pay link"
```

---

### Task D3: issueActivationInvoice action

**Files:**
- Modify: `src/app/admin/tenants/[tenantId]/billing-actions.ts`
- Test: `tests/admin-start-billing.test.ts`

- [ ] **Step 1: Read `tests/admin-start-billing.test.ts`** and update it: rename the action under test from `startNewModelBilling` to `issueActivationInvoice` and adjust expectations so that (a) recurring tenants get subscription(s) created with the setup folded into the first invoice, (b) the hosted invoice URL is written to `setup_fees.hosted_invoice_url`, and (c) `sendEmail` (mock) is called. Keep the existing Stripe/Supabase fake harness in that file; only change names + assertions.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/admin-start-billing.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite the billing-actions module.** Replace `startNewModelBilling` (lines 89–215) with `issueActivationInvoice`. Add imports at the top:

```ts
import { planActivationCharges } from "@/lib/billing/activation-charges";
import { sendEmail } from "@/lib/email/resend";
import { activationInvoiceEmail } from "@/lib/email/templates";
import { commercialModelLabel } from "@/lib/billing/pricing";
import { minorUnits } from "@/lib/billing/plan-price";
```

Then add the new action (keep `getOrCreateStripeCustomer`, `getOrCreateProduct`, `syncSubscription` as-is; remove the now-unused `buildNewSetupInvoiceItemParams`/`planNewModelCharges`/`buildProductSubscriptionParams` imports if no longer referenced, but `buildProductSubscriptionParams`/`minorUnits` are still used):

```ts
/**
 * Issue the activation invoice (setup fee + first period) for a NEW-model
 * tenant and email the tenant the Stripe hosted-invoice pay link.
 *
 * Recurring: create one subscription per product with the setup fee folded into
 * the FIRST invoice (add_invoice_items), collection_method=send_invoice so the
 * first invoice is payable by link. One-time pack: a single invoice with the
 * pack + setup as line items. Idempotent: products with a stripe_subscription_id
 * are skipped; a setup_fees row that already has a hosted_invoice_url is reused.
 * Bypassed / non-onboarding tenants no-op.
 */
export async function issueActivationInvoice(tenantId: string): Promise<void> {
  const claims = await requireStaff();
  const id = idSchema.parse(tenantId);

  const { data: tenant, error: tenantErr } = await db()
    .from("tenants")
    .select("id, name, currency, country, contact_email, stripe_customer_id, billing_bypass, commercial_model, status")
    .eq("id", id)
    .single();
  if (tenantErr || !tenant) throw new Error("Tenant not found.");
  const t = tenant as TenantBillingRow & { commercial_model: string | null; status: string };
  if (!t.commercial_model || t.status !== "onboarding" || t.billing_bypass) return;

  const [{ data: chatRow }, { data: voiceRow }, { data: setupFee }, { data: customRow }] = await Promise.all([
    db().from("chat_subscriptions").select("monthly_price_gbp, stripe_subscription_id").eq("tenant_id", id).maybeSingle(),
    db().from("voice_subscriptions").select("monthly_price_gbp, stripe_subscription_id").eq("tenant_id", id).maybeSingle(),
    db().from("setup_fees").select("id, amount, stripe_invoice_id, hosted_invoice_url").eq("tenant_id", id).maybeSingle(),
    db().from("custom_plans").select("billing_mode").eq("tenant_id", id).maybeSingle(),
  ]);

  const chat = (chatRow as NewModelSubRow | null) ?? null;
  const voice = (voiceRow as NewModelSubRow | null) ?? null;
  const fee = setupFee as { id: string; amount: number; stripe_invoice_id: string | null; hosted_invoice_url: string | null } | null;
  const billingMode = ((customRow as { billing_mode?: string } | null)?.billing_mode ?? "recurring") as "recurring" | "one_time";

  const customerId = await getOrCreateStripeCustomer(t);
  const stripe = getStripe();

  const plan = planActivationCharges({
    billingMode, setupGbp: fee?.amount ?? 0, chat, voice,
  });

  let hostedInvoiceUrl = fee?.hosted_invoice_url ?? null;

  if (plan.mode === "recurring") {
    // Fold the setup fee into the first subscription invoice as a one-off item.
    if (plan.setupGbp > 0 && fee && !fee.stripe_invoice_id) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: minorUnits(plan.setupGbp),
        currency: "gbp",
        description: "BookMyCab — one-time setup fee",
        metadata: { tenant_id: id },
      });
    }
    const productId = plan.subscriptions.length > 0 ? await getOrCreateProduct() : null;
    for (const planned of plan.subscriptions) {
      const sub = await stripe.subscriptions.create({
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: 7,
        automatic_tax: { enabled: true },
        items: [{ price_data: { currency: "gbp", product: productId as string, unit_amount: minorUnits(planned.monthlyGbp), recurring: { interval: "month" } } }],
        metadata: { tenant_id: id, product: planned.product },
      });
      const item = sub.items?.data?.[0];
      const table = planned.product === "chat" ? "chat_subscriptions" : "voice_subscriptions";
      await db().from(table).update({
        stripe_subscription_id: sub.id,
        current_period_start: unixToIso(item?.current_period_start ?? null),
        current_period_end: unixToIso(item?.current_period_end ?? null),
      }).eq("tenant_id", id);
      // Capture the first invoice's hosted URL (the one with setup folded in).
      const latest = typeof sub.latest_invoice === "string"
        ? await stripe.invoices.retrieve(sub.latest_invoice)
        : (sub.latest_invoice as import("stripe").Stripe.Invoice | null);
      if (latest?.id) {
        if (latest.status === "draft") await stripe.invoices.finalizeInvoice(latest.id);
        const finalised = await stripe.invoices.retrieve(latest.id);
        hostedInvoiceUrl = finalised.hosted_invoice_url ?? hostedInvoiceUrl;
        if (fee) await db().from("setup_fees").update({ stripe_invoice_id: latest.id }).eq("id", fee.id);
      }
    }
  } else {
    // One-time pack: a single invoice with pack + setup line items.
    if (fee && !fee.stripe_invoice_id) {
      for (const line of plan.oneTimeLines) {
        await stripe.invoiceItems.create({ customer: customerId, amount: minorUnits(line.amountGbp), currency: "gbp", description: line.label, metadata: { tenant_id: id } });
      }
      if (plan.setupGbp > 0) {
        await stripe.invoiceItems.create({ customer: customerId, amount: minorUnits(plan.setupGbp), currency: "gbp", description: "BookMyCab — one-time setup fee", metadata: { tenant_id: id } });
      }
      const invoice = await stripe.invoices.create({
        customer: customerId, collection_method: "send_invoice", days_until_due: 7,
        automatic_tax: { enabled: true }, metadata: { tenant_id: id, kind: "activation_pack" },
      });
      if (!invoice.id) throw new Error("Stripe did not return an invoice id.");
      await stripe.invoices.finalizeInvoice(invoice.id);
      const finalised = await stripe.invoices.retrieve(invoice.id);
      hostedInvoiceUrl = finalised.hosted_invoice_url ?? hostedInvoiceUrl;
      await db().from("setup_fees").update({ stripe_invoice_id: invoice.id }).eq("id", fee.id);
    }
  }

  // Persist the hosted invoice URL + email the tenant the pay link.
  if (hostedInvoiceUrl && fee) {
    await db().from("setup_fees").update({ hosted_invoice_url: hostedInvoiceUrl }).eq("id", fee.id);
    const amountMajor = (Number(chat?.monthly_price_gbp ?? 0) + Number(voice?.monthly_price_gbp ?? 0)) + (plan.setupGbp ?? 0);
    if (t.contact_email) {
      const body = activationInvoiceEmail({
        tenantName: t.name,
        planLabel: commercialModelLabel(t.commercial_model),
        amountMajor,
        currency: (t.currency ?? "GBP") as Currency,
        invoiceUrl: hostedInvoiceUrl,
      });
      await sendEmail({ to: t.contact_email, subject: body.subject, html: body.html, text: body.text });
    }
  }

  await writeAudit({
    actorUserId: claims.sub, tenantId: id, action: "tenant.activation_invoice",
    targetType: "tenant", targetId: id,
    metadata: { mode: plan.mode, subscriptions: plan.subscriptions.map((s) => s.product), invoiced: !!hostedInvoiceUrl },
  });

  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin/billing");
}
```

> Keep `tenants.status='active'` transition OUT of this action — billing going live is now tied to Go-Live + invoice.paid, not invoice issuance. (The old action flipped status to active; the new flow keeps the tenant in `onboarding` until paid/Go-Live. The webhook in Task D4 flips `setup_fee_paid`; status is moved to `active` by Go-Live.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/admin-start-billing.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the billing-panel** — `src/app/admin/tenants/[tenantId]/billing-panel.tsx`: rename the action import + button. Replace `startNewModelBilling` with `issueActivationInvoice`, change the button label logic to `{billingActive ? "Billing active" : "Issue / re-send invoice"}`, and add an `invoiceUrl?: string | null` prop showing a "View invoice" link when present. Update the call site in `[tenantId]/page.tsx` to pass `invoiceUrl={feesData?.[0]?.hosted_invoice_url ?? null}` (add `hosted_invoice_url` to the `setup_fees` select on line ~228).

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/tenants/[tenantId]/billing-actions.ts src/app/admin/tenants/[tenantId]/billing-panel.tsx "src/app/admin/tenants/[tenantId]/page.tsx" tests/admin-start-billing.test.ts
git commit -m "feat(billing): issueActivationInvoice (setup+first period) + email pay link"
```

---

### Task D4: Webhook — activation paid → mark paid + grant one-time pack pool

**Files:**
- Modify: `src/lib/billing/handle-event.ts`, `src/lib/billing/webhook-deps.ts`
- Test: `tests/billing-handle-event.test.ts`

- [ ] **Step 1: Add a failing test** — in `tests/billing-handle-event.test.ts` add a case: an `invoice.paid` whose `metadata.kind === "activation_pack"` (no subscription id) calls `markSetupFeePaid` AND `grantCustomPackPool`. Use the file's existing `deps` fake; add a `grantCustomPackPool` spy to it. Assert the result action is `"setup_fee.paid"` and both deps fired.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-handle-event.test.ts`
Expected: FAIL — `grantCustomPackPool` not in `BillingDeps` / not called.

- [ ] **Step 3: Extend `BillingDeps`** in `handle-event.ts`: add to the interface:

```ts
  /** For a paid one-time custom pack invoice, open the prepaid call pool for the
   *  pack's validity window (idempotent). No-op when the tenant has no one-time
   *  custom plan. */
  grantCustomPackPool(stripeInvoiceId: string): Promise<void>;
```

In the `invoice.paid` → setup branch (lines 105–108), after `markSetupFeePaid`, also call the pack-pool grant:

```ts
      if (classifyInvoice(invoice) === "setup" && invoice.id) {
        await deps.markSetupFeePaid(invoice.id);
        await deps.grantCustomPackPool(invoice.id);
        return { action: "setup_fee.paid" };
      }
```

- [ ] **Step 4: Implement `grantCustomPackPool` in `webhook-deps.ts`** and add it to the returned `BillingDeps`:

```ts
    async grantCustomPackPool(stripeInvoiceId) {
      // Find the tenant whose activation invoice this is.
      const { data: fee } = await db
        .from("setup_fees").select("tenant_id").eq("stripe_invoice_id", stripeInvoiceId).maybeSingle();
      const tenantId = (fee as { tenant_id?: string } | null)?.tenant_id;
      if (!tenantId) return;
      const { data: plan } = await db
        .from("custom_plans")
        .select("billing_mode, monthly_call_allowance, starts_at, expires_at")
        .eq("tenant_id", tenantId).maybeSingle();
      const p = plan as { billing_mode: string; monthly_call_allowance: number; starts_at: string | null; expires_at: string | null } | null;
      if (!p || p.billing_mode !== "one_time") return; // recurring handled by resetVoiceCallPool
      const start = p.starts_at ?? new Date().toISOString().slice(0, 10);
      const end = p.expires_at ?? start;
      // INSERT-ONLY: a re-delivered invoice.paid is a no-op.
      const { error } = await db.from("usage_counters").upsert(
        { tenant_id: tenantId, feature_key: "voice_calls", period_start: start, period_end: end, used: 0, limit_amount: p.monthly_call_allowance },
        { onConflict: "tenant_id,feature_key,period_start", ignoreDuplicates: true },
      );
      if (error) throw new Error(`grantCustomPackPool failed: ${error.message}`);
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/billing-handle-event.test.ts tests/billing-webhook-route.test.ts`
Expected: PASS. (If `billing-webhook-route.test.ts` builds a full `deps` it may need the new spy added — add a no-op `grantCustomPackPool: async () => {}` to its fixture.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/billing/handle-event.ts src/lib/billing/webhook-deps.ts tests/billing-handle-event.test.ts tests/billing-webhook-route.test.ts
git commit -m "feat(billing): activation-paid grants one-time custom pack pool"
```

---

## Phase E — Build Queue soft Go-Live gate

### Task E1: Surface "invoice unpaid" on UAT cards (soft)

**Files:**
- Modify: `src/app/admin/build-queue/page.tsx`, `src/app/admin/build-queue/build-queue-board.tsx`

- [ ] **Step 1: Load setup-fee-paid per tenant in the page.** In `build-queue/page.tsx`, after fetching `automations`, fetch the paid flag for the tenants in view and attach it. Add to the `AutomationRow` select `tenant_id` and join, then:

```ts
  // Map tenant → activation invoice paid? (soft Go-Live signal). A bypassed
  // tenant or one with a paid setup fee counts as paid.
  const tenantIds = Array.from(new Set(automations.map((a) => a.tenant_id).filter(Boolean))) as string[];
  const paidByTenant = new Map<string, boolean>();
  if (tenantIds.length > 0) {
    const [{ data: fees }, { data: tens }] = await Promise.all([
      serviceClient.from("setup_fees").select("tenant_id, paid_at").in("tenant_id", tenantIds),
      serviceClient.from("tenants").select("id, billing_bypass").in("id", tenantIds),
    ]);
    const bypass = new Set((tens ?? []).filter((t: { billing_bypass?: boolean }) => t.billing_bypass).map((t: { id: string }) => t.id));
    for (const id of tenantIds) paidByTenant.set(id, bypass.has(id));
    for (const f of (fees ?? []) as Array<{ tenant_id: string; paid_at: string | null }>) {
      if (f.paid_at) paidByTenant.set(f.tenant_id, true);
    }
  }
```

Add `invoicePaid: a.tenant_id ? (paidByTenant.get(a.tenant_id) ?? false) : true` to each `BuildCard`. Add `tenant_id` to the `AutomationRow` type + select.

- [ ] **Step 2: Render the soft warning** in `build-queue-board.tsx`. Add `invoicePaid: boolean` to `BuildCard`. In the UAT block (around line 166), show a warning above the Go-Live button when `!card.invoicePaid` (do NOT disable the button — soft gate per decision):

```tsx
        {card.buildStage === "UAT" && (
          <>
            {!card.invoicePaid && (
              <p className="border-2 border-ink bg-brut-red/15 px-2 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider text-brut-red-deep">
                ⚠ Invoice unpaid
              </p>
            )}
            <button
              type="button"
              onClick={handleGoLive}
              disabled={pending}
              className="cursor-pointer bg-brut-lime px-2 py-1.5 text-xs font-medium text-white outline-none transition-colors hover:bg-brut-lime focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Working…" : card.invoicePaid ? "Go Live" : "Go Live anyway"}
            </button>
          </>
        )}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build 2>&1 | grep -iE "build-queue" | head`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/build-queue/page.tsx src/app/admin/build-queue/build-queue-board.tsx
git commit -m "feat(admin): soft invoice-unpaid warning on Go-Live"
```

---

## Phase F — Tenant dashboard billing

### Task F1: billing-queries — load custom plan + invoice link

**Files:**
- Modify: `src/lib/dashboard/billing-queries.ts`

- [ ] **Step 1: Extend `BillingOverview`** — add to the interface:

```ts
  custom: {
    planName: string;
    billingMode: "recurring" | "one_time";
    callAllowance: number;
    includedAgents: number;
    planPriceGbp: number;
    extraCreditPriceGbp: number;
    validityDays: number;
    startsAt: string | null;
    expiresAt: string | null;
  } | null;
  activationInvoiceUrl: string | null;
```

Add to the `commercialModel` union `| "custom"`.

- [ ] **Step 2: Load the rows.** Add two reads to the `Promise.all`: `custom_plans` (by tenant) and the `hosted_invoice_url` to the existing `setup_fees` select. Map them into the returned object:

```ts
    supabase.from("custom_plans")
      .select("plan_name, billing_mode, monthly_call_allowance, included_agents, plan_price_gbp, extra_credit_price_gbp, validity_days, starts_at, expires_at")
      .eq("tenant_id", tenantId).maybeSingle(),
```

and change the setup_fees select to `"amount, currency, paid_at, hosted_invoice_url"`. Then build:

```ts
  const cp = (customRes.data as Record<string, unknown> | null) ?? null;
  const custom = cp ? {
    planName: String(cp.plan_name ?? ""),
    billingMode: (cp.billing_mode as "recurring" | "one_time"),
    callAllowance: Number(cp.monthly_call_allowance ?? 0),
    includedAgents: Number(cp.included_agents ?? 0),
    planPriceGbp: Number(cp.plan_price_gbp ?? 0),
    extraCreditPriceGbp: Number(cp.extra_credit_price_gbp ?? 0),
    validityDays: Number(cp.validity_days ?? 0),
    startsAt: (cp.starts_at as string | null) ?? null,
    expiresAt: (cp.expires_at as string | null) ?? null,
  } : null;
```

Return `custom` and `activationInvoiceUrl: (f?.hosted_invoice_url as string | null) ?? null`.

- [ ] **Step 3: Verify it compiles**

Run: `npm run build 2>&1 | grep -iE "billing-queries" | head`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dashboard/billing-queries.ts
git commit -m "feat(dashboard): billing overview includes custom plan + invoice url"
```

---

### Task F2: Tenant billing page — custom plan card + Pay-invoice CTA

**Files:**
- Modify: `src/app/dashboard/billing/page.tsx`

- [ ] **Step 1: Add a "Pay invoice" banner** when an activation invoice is unpaid. Just below the existing status banners (after line 129), add:

```tsx
      {b.activationInvoiceUrl && !b.setupFee?.paidAt && (
        <a
          href={b.activationInvoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-[3px] border-ink bg-brut-yellow p-4 text-sm font-bold text-ink shadow-brut-sm hover:bg-ink hover:text-paper"
        >
          Your activation invoice is ready — click to pay and go live →
        </a>
      )}
```

- [ ] **Step 2: Render a custom-plan row** in the plan table. In the `b.products` branch, when `b.custom` is present, show the custom voice row's allowance/validity. Add after the voice `<tr>` (line ~186), guarded by `b.custom`:

```tsx
                  {b.custom && (
                    <tr>
                      <td className="px-3 py-2 font-bold text-ink">Custom</td>
                      <td className="px-3 py-2 text-gray-700">{b.custom.planName}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {b.custom.callAllowance.toLocaleString("en-GB")} calls
                        {b.custom.billingMode === "one_time" ? ` · valid ${b.custom.validityDays} days` : " / period"} ·
                        overage £{b.custom.extraCreditPriceGbp.toFixed(2)}/call
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-ink">{formatCurrency(b.custom.planPriceGbp, "GBP")}</td>
                    </tr>
                  )}
```

- [ ] **Step 3: Add `custom` to the local `MODEL_LABEL`** map (line ~100): `custom: "Custom plan"`.

- [ ] **Step 4: Verify it compiles + visual check**

Run: `npm run build 2>&1 | grep -iE "dashboard/billing" | head`
Expected: no errors. Then run the impeccable skill's quick visual review on `/dashboard/billing` for a custom tenant (spacing, the yellow pay-banner contrast vs. the existing brut-yellow status banners).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/billing/page.tsx
git commit -m "feat(dashboard): custom plan row + pay-invoice CTA"
```

---

## Phase G — Admin plans catalogue page

### Task G1: /admin/plans → three offerings

**Files:**
- Modify: `src/app/admin/plans/page.tsx`

- [ ] **Step 1: Replace the imports + the three catalogue cards.** Swap the pricing imports (lines 3–13) for:

```tsx
import {
  CHAT_SUITE_PRICE_GBP,
  CHAT_SUITE_SETUP_GBP,
  VOICE_IGNITION_SPEC,
} from "@/lib/billing/pricing";
import { CREDIT_UNIT_GBP, MIN_TOPUP_GBP } from "@/lib/billing/credit";
```

Remove the `TIERS`/`TIER_LABEL` constants (lines 19–24). Replace the three `CatalogCard` blocks (lines 83–161) with three cards reflecting the new offerings (keep the `CatalogCard`/`Th`/`Td`/`gbp` helpers and the page chrome):

```tsx
        {/* 1. WhatsApp Booking Suite */}
        <CatalogCard accent="bg-brut-cyan" title="WhatsApp Booking Suite — Chatbot + Voice Note">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50"><tr><Th>Plan</Th><Th right>Monthly</Th><Th right>Setup (one-time)</Th></tr></thead>
            <tbody className="divide-y-2 divide-gray-100">
              <tr><Td strong>One simple price</Td><Td right>{gbp(CHAT_SUITE_PRICE_GBP)}</Td><Td right>{gbp(CHAT_SUITE_SETUP_GBP)}</Td></tr>
            </tbody>
          </table>
          <p className="border-t-2 border-gray-100 px-3 py-2 text-xs text-gray-500">
            One WhatsApp chatbot with voice-note handling. Rolling monthly, GBP.
          </p>
        </CatalogCard>

        {/* 2. AI Voice — Ignition + Full Throttle */}
        <CatalogCard accent="bg-brut-violet" title="AI Voice Booking">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50"><tr><Th>Plan</Th><Th right>Monthly</Th><Th right>Calls / mo</Th><Th right>Agents</Th><Th right>Setup</Th></tr></thead>
            <tbody className="divide-y-2 divide-gray-100">
              <tr><Td strong>Ignition</Td><Td right>{gbp(VOICE_IGNITION_SPEC.priceGbp)}</Td><Td right>{VOICE_IGNITION_SPEC.callAllowance.toLocaleString("en-GB")}</Td><Td right>{VOICE_IGNITION_SPEC.includedAgents}</Td><Td right>{gbp(VOICE_IGNITION_SPEC.setupGbp)}</Td></tr>
              <tr><Td strong>Full Throttle</Td><Td right>Custom</Td><Td right>Custom</Td><Td right>Custom</Td><Td right>Custom</Td></tr>
            </tbody>
          </table>
          <p className="border-t-2 border-gray-100 px-3 py-2 text-xs text-gray-500">
            Ignition plan calls reset each month (no carry-over); extra calls draw from prepaid credit at{" "}
            <span className="font-mono font-bold text-ink">£{CREDIT_UNIT_GBP.toFixed(2)}</span>/call (min top-up{" "}
            <span className="font-mono font-bold text-ink">£{MIN_TOPUP_GBP}</span>). Full Throttle is configured per tenant on the New Tenant form.
          </p>
        </CatalogCard>

        {/* 3. Custom (Full Throttle) */}
        <CatalogCard accent="bg-brut-yellow" title="Custom (Full Throttle) — configured per tenant">
          <p className="px-3 py-3 text-sm text-gray-700">
            After a discovery call, set everything on the New Tenant form under <span className="font-bold">Commercial model → Custom</span>:
            plan name, number of calls, price per call, number of agents, setup fee, pack validity, and per-call extra-credit (overage) pricing.
            Recurring or one-time prepaid pack. The tenant is emailed a Stripe invoice (setup + first period) to pay before Go-Live.
          </p>
        </CatalogCard>
```

Update the page intro `<p>` (lines 76–79) to say "Three offerings (GBP, rolling monthly or one-time pack). Custom plans are configured per tenant."

- [ ] **Step 2: Verify it compiles**

Run: `npm run build 2>&1 | grep -iE "admin/plans" | head`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/plans/page.tsx
git commit -m "feat(admin): plans catalogue shows three offerings"
```

---

## Phase H — Per-call extra credit (custom overage)

### Task H1: Credit checkout uses the tenant's custom overage price

**Files:**
- Modify: `src/app/api/orgs/[orgId]/billing/credit/checkout/route.ts`
- Test: `tests/billing-credit-checkout.test.ts`

- [ ] **Step 1: Read the checkout route + its test.** The route currently prices top-ups at the global `CREDIT_UNIT_GBP` (£0.90). Add a failing test in `tests/billing-credit-checkout.test.ts`: for a tenant with a `custom_plans.extra_credit_price_gbp = 0.75`, a custom-GBP top-up computes `credits = floor(gbp / 0.75)` and the Stripe line `unit_amount` uses 75p. (Match the existing test harness/mocks in that file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-credit-checkout.test.ts`
Expected: FAIL.

- [ ] **Step 3: Make the per-call price tenant-aware.** In `src/lib/billing/credit.ts`, generalise the pure helpers to accept a unit price (default to the global constant) — add:

```ts
/** Whole credits a paid GBP amount buys at a given unit price (default base). */
export function creditsForGbpAt(gbp: number, unitGbp: number = CREDIT_UNIT_GBP): number {
  return Math.floor(gbp / (unitGbp > 0 ? unitGbp : CREDIT_UNIT_GBP));
}
```

In the checkout route, before pricing, load the tenant's custom overage: `select extra_credit_price_gbp from custom_plans where tenant_id = orgId`. Use `const unit = customRow?.extra_credit_price_gbp ?? CREDIT_UNIT_GBP;` and compute credits via `creditsForGbpAt(gbp, unit)` and the Stripe `unit_amount` via `minorUnits(unit)`. Store the chosen unit in the Checkout session metadata (`credit_unit_micros`) so the webhook's `grantTopupCredits` ledger price matches (extend `webhook-deps.ts` `buildGrantTopupCredits` to read `session.metadata.credit_unit_micros` when present, falling back to `TOPUP_UNIT_PRICE_MICROS`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-credit-checkout.test.ts tests/billing-credit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/credit.ts src/app/api/orgs/[orgId]/billing/credit/checkout/route.ts src/lib/billing/webhook-deps.ts tests/billing-credit-checkout.test.ts
git commit -m "feat(billing): custom per-call overage price for credit top-ups"
```

---

## Phase I — Integration, build, and live sandbox test

### Task I1: Full typecheck + unit suite + build

**Files:** none (verification)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Fix any remaining references to deleted exports (`CHAT_TIERS`, `VOICE_TIERS`, `commercial_model='double_decker'` in the form, `resolveNewModelPricing`, `tierLabel`, `VOICE_PLAN_SPEC`). Grep to find them:

```bash
grep -rn "CHAT_TIERS\|VOICE_TIERS\|resolveNewModelPricing\|VOICE_PLAN_SPEC\|bundleChatPriceGbp\|double_decker" src | grep -v "commercialModelLabel\|0068\|migrations"
```

- [ ] **Step 2: Run the full unit suite**

Run: `npm run test`
Expected: PASS. Address any test still asserting the old tier model (e.g. `admin-billing-math.test.ts`, `billing-structure.test.ts`) — update those assertions to the new constants.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS (per memory: always build, not just tsc, after server-action/route changes).

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "test/build: reconcile suite with three-offering pricing"
```

---

### Task I2: Confirm migration applied + advisors clean

**Files:** none (Supabase MCP verification)

- [ ] **Step 1:** Call `mcp__supabase__list_migrations` and confirm `0068_pricing_restructure_custom_plans` is listed as applied.
- [ ] **Step 2:** Call `mcp__supabase__execute_sql` with `select table_name from information_schema.columns where column_name = 'plan_type' and table_name = 'tenants';` and confirm one row. Also confirm `custom_plans` columns via `select column_name from information_schema.columns where table_name='custom_plans' order by ordinal_position;`.
- [ ] **Step 3:** Call `mcp__supabase__get_advisors` (`type: "security"`) — confirm no new ERROR-level findings for `custom_plans` (RLS enabled; only a SELECT policy, writes via service_role — expected).

---

### Task I3: Live sandbox test payment — create a custom tenant, issue invoice, pay it

**Files:** none (end-to-end against Stripe test mode + Supabase)

> Goal (per the request): do a real test payment in the Stripe sandbox and surface the hosted invoice pay link to the user.

- [ ] **Step 1: Start the app**

Run: `npm run dev` (background). Confirm it boots without env errors.

- [ ] **Step 2: Provision a test custom tenant.** Sign in as the admin (`admin@flowmoai.com`, see `.env.local`) → `/admin/tenants/new`. Fill: name `Sandbox Test Cabs`, slug `sandbox-test-cabs`, country GB, contact email a mailbox you control, dispatch AutoCab, Plan = **Custom**, billing **recurring**, include AI Voice, calls `1500`, agents `2`, plan price `2500`, setup fee `1000`, validity `30`, extra credit `0.80`. Submit. This triggers `issueActivationInvoice` (Stripe customer + subscription with setup folded into the first invoice + Resend email).

- [ ] **Step 3: Confirm the invoice exists in Stripe (test mode).** Either:
  - In the app, open `/admin/tenants/<id>` → Billing actions → the "View invoice" link (the stored `hosted_invoice_url`); OR
  - Verify via Supabase MCP: `mcp__supabase__execute_sql` → `select hosted_invoice_url, stripe_invoice_id from setup_fees where tenant_id = '<id>';`.

- [ ] **Step 4: Pay the invoice in the sandbox.** Open the `hosted_invoice_url` in a browser and pay with the Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode. (The keys in `.env.local` are confirmed `sk_test_…` / `pk_test_…`.)

- [ ] **Step 5: Confirm the webhook marked it paid.** If Stripe can't reach localhost, forward events: `stripe listen --forward-to localhost:3000/webhooks/stripe` (run before paying; copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` for the session). After payment, verify:

```bash
# via Supabase MCP execute_sql
select paid_at from setup_fees where tenant_id = '<id>';   -- not null
select setup_fee_paid from tenants where id = '<id>';        -- true
```

The build-queue card for the tenant's automation should now show no "Invoice unpaid" warning once a Voice automation is in UAT.

- [ ] **Step 6: Report the pay link to the user.** Output the `hosted_invoice_url` (the test pay link) and a one-line summary: plan, amount, paid status. This satisfies "show me the link to pay the invoice to test."

- [ ] **Step 7 (cleanup, optional):** If the test tenant should not persist, force-delete it from `/admin/tenants/<id>` → Danger zone (or leave it — it's clearly named `Sandbox Test Cabs`). Do not delete unless asked.

---

## Self-review checklist (run after the plan, before execution)

- **Spec coverage:** Marketing page (A5/A6) ✓; Admin plans page (G1) ✓; New-tenant Commercial-model custom controls — plan name, # calls, price/call, # agents, setup fee, pack validity, per-call extra credit (C1/C2) ✓; remove old plans for both products (A1/A2/A5/G1) ✓; tenant email with invoice (D2/D3) ✓; Go-Live from build queue after payment (E1, soft) ✓; Stripe via MCP + sandbox test payment (I3) ✓; Supabase via MCP (B1/I2) ✓; tenant dashboard (F1/F2) ✓; per-call extra credit working (H1) ✓.
- **Type consistency:** `PlanType`, `CommercialModel`, `resolveBasePlanPricing`, `resolveCustomPlan`, `planActivationCharges`, `issueActivationInvoice`, `grantCustomPackPool`, `activationInvoiceEmail`, `custom_plans` columns, plan_tier `"custom"`/`"ignition"` are used identically across all tasks.
- **No placeholders:** every code step shows full code; every run step shows the command + expected result.
- **Open risk to watch during execution:** several existing tests assert the old tier model (`admin-billing-math`, `billing-structure`, `admin-provisioning-action`, `admin-start-billing`, `billing-handle-event`, `billing-webhook-route`). Task I1 Step 2 is the catch-all to reconcile them; budget time there.
