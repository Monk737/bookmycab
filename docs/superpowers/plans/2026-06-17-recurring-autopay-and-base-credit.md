# Recurring Renewals, Autopay & £2 Base Credit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Frontend tasks run through the `impeccable` skill (keep the existing Neo-Brutalism design; change content/behaviour, not the visual system).

**Goal:** Make custom recurring subscriptions truly renewable each month (tenants can pay renewals from their dashboard; enabling Autopay auto-charges renewals), let admins edit a tenant's custom plan (including the per-call extra-credit price) after creation, and set the **base** pay-as-you-go credit to **£2 per call** without affecting custom-plan tenants' own rate.

**Architecture:** This builds on the just-shipped pricing restructure (branch `feat/pricing-restructure-custom-plans`). Three cohesive billing changes: (1) flip the base credit unit price to £2 across the canonical constants + ledger + copy, leaving the existing custom-rate override path (reads `custom_plans.extra_credit_price_gbp`) untouched; (2) an admin "Edit custom plan" server action + form that updates `custom_plans` and mirrors economics into `voice_subscriptions` + `tenants.monthly_price`; (3) Autopay now flips a tenant's BookMyCab subscriptions to Stripe `charge_automatically` so renewals auto-charge the saved card, and the tenant billing page surfaces open renewal invoices with pay links + the autopay status.

**Tech Stack:** Next.js 15 App Router + React 19 + TypeScript, Supabase (PostgreSQL + RLS), Stripe (test/sandbox `sk_test_` keys in `.env.local`), Resend, Tailwind v4, Vitest.

---

## Decisions locked (from the brief)

1. **Base credit = £2/call (1 credit = £2, per call, not per minute).** Applies to all NON-custom tenants. Custom-plan tenants keep their admin-chosen `extra_credit_price_gbp` (already wired). Credit packs reprice to £2/credit.
2. **Renewals:** subscriptions stay `send_invoice` (emailed + dashboard pay link) **until** the tenant enables Autopay; enabling Autopay flips their active BookMyCab subscriptions to `charge_automatically` so renewals auto-charge the saved default card. No autopay → manual payment via the dashboard's open-invoice links or the Stripe portal.
3. **Admin can edit a custom plan post-creation** (plan name, calls, agents, plan price, validity, and the per-call extra-credit price); the edit mirrors into `voice_subscriptions` + `tenants.monthly_price` and recomputes `expires_at`.

## Naming & constants (use these EXACT identifiers everywhere)

- `CREDIT_UNIT_GBP = 2` (base), `MIN_TOPUP_GBP = 9` (unchanged), repriced `CREDIT_PACKS` — `src/lib/billing/credit.ts`
- `EXTRA_CALL_PRICE_GBP = 2` — `src/lib/marketing/pricing.ts`
- `DEFAULT_EXTRA_CALL_PRICE_GBP = 2` — `src/lib/billing/pricing.ts`
- `TOPUP_UNIT_PRICE_MICROS = 2_000_000` — `src/lib/billing/webhook-deps.ts`
- New `BillingDeps.enableAutopayRenewals({ customerId })` — `handle-event.ts` + `webhook-deps.ts`
- New admin action `updateCustomPlan(tenantId, prevState, formData)` + `editCustomPlanSchema` + pure `buildCustomPlanUpdate(input, ctx)` — `[tenantId]/actions.ts` + `src/lib/billing/custom-plan.ts`
- New `getOpenInvoices(customerId)` + `getAutopayEnabled(customerId)` + pure `mapStripeInvoiceRow(inv)` — `src/lib/dashboard/open-invoices.ts`

## File Structure

**Create:**
- `src/lib/dashboard/open-invoices.ts` — server helper: list a customer's open Stripe invoices (pay links) + autopay status; pure `mapStripeInvoiceRow`.
- `tests/billing-open-invoices.test.ts`, `tests/billing-custom-plan-edit.test.ts`.
- `scripts/sandbox-renewal-autopay.ts` — sandbox proof for £2 base credit + custom rate + autopay auto-charge.

**Modify:**
- `src/lib/billing/credit.ts` — base £2 + repriced packs.
- `src/lib/marketing/pricing.ts` — `EXTRA_CALL_PRICE_GBP = 2`.
- `src/lib/billing/pricing.ts` — `DEFAULT_EXTRA_CALL_PRICE_GBP = 2`.
- `src/lib/billing/webhook-deps.ts` — `TOPUP_UNIT_PRICE_MICROS = 2_000_000` + `enableAutopayRenewals` impl.
- `src/lib/billing/handle-event.ts` — autopay branch calls `enableAutopayRenewals`.
- `src/lib/email/templates.ts` — make the "£0.90 per call" copy rate-agnostic.
- `src/lib/billing/custom-plan.ts` — `editCustomPlanSchema` + `buildCustomPlanUpdate`.
- `src/app/admin/tenants/[tenantId]/actions.ts` — `updateCustomPlan` action.
- `src/app/admin/tenants/[tenantId]/tenant-manage-forms.tsx` — `EditCustomPlanForm`.
- `src/app/admin/tenants/[tenantId]/page.tsx` — load custom plan + render the edit form for custom tenants.
- `src/lib/dashboard/billing-queries.ts` — expose `stripeCustomerId` (already present) for the open-invoices fetch.
- `src/app/dashboard/billing/page.tsx` — open-invoices section + autopay status.
- Tests: `tests/billing-credit.test.ts`, `tests/pricing.test.ts`, `tests/billing-new-model-provisioning.test.ts`, `tests/billing-pricing-drift.test.ts`, `tests/billing-credit-checkout.test.ts`, `tests/billing-handle-event.test.ts`, `tests/billing-webhook-route.test.ts`, `tests/email-templates.test.ts` (only if it asserts the old copy).

---

## Phase A — Base pay-as-you-go credit = £2/call

### Task A1: Credit constants → £2 base + repriced packs

**Files:**
- Modify: `src/lib/billing/credit.ts`
- Test: `tests/billing-credit.test.ts`

- [ ] **Step 1: Update the failing assertions** — open `tests/billing-credit.test.ts`, find the test that asserts the base unit/packs (currently `it("unit £0.90, min £9, three packs", ...)` with `expect(CREDIT_UNIT_GBP).toBe(0.9)`, `creditsForGbp(9)===10`, and the pack list) and replace that single `it(...)` block with:

```ts
  it("base unit £2, min £9, three £2/credit packs", () => {
    expect(CREDIT_UNIT_GBP).toBe(2);
    expect(MIN_TOPUP_GBP).toBe(9);
    expect(CREDIT_PACKS).toEqual([
      { id: "pack_10", gbp: 20, credits: 10 },
      { id: "pack_50", gbp: 100, credits: 50 },
      { id: "pack_100", gbp: 200, credits: 100 },
    ]);
  });
```

Then update any other assertion in the file that uses the old £0.90 maths: change `expect(creditsForGbp(9)).toBe(10)` → `expect(creditsForGbp(20)).toBe(10)` (20 / 2), and `expect(creditsForGbpAt(9, 0.9)).toBe(10)` → keep the custom-rate cases as-is (they pass an explicit unit) but add `expect(creditsForGbpAt(20)).toBe(10)` to assert the new base default. Leave the `creditsForGbpAt(15, 0.75) === 20` custom case unchanged.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-credit.test.ts`
Expected: FAIL (`CREDIT_UNIT_GBP` is 0.9).

- [ ] **Step 3: Edit `src/lib/billing/credit.ts`** — change the header comment + constants + packs (leave `creditsForGbp`, `creditsForGbpAt`, `validateCustomTopup`, `resolveTopupAmount` logic unchanged — they already read `CREDIT_UNIT_GBP`):

```ts
/**
 * AI Voice credit top-up pricing. App-managed prepaid model:
 * 1 credit = 1 call. The BASE pay-as-you-go rate is £2 per call. Custom-plan
 * tenants override this with their own `custom_plans.extra_credit_price_gbp`
 * (applied by the checkout route); this base never applies to them. Stripe
 * handles the purchase only; the webhook grants the credits to credit_ledger.
 */
export const CREDIT_UNIT_GBP = 2;
export const MIN_TOPUP_GBP = 9;

export interface CreditPack {
  id: string;
  gbp: number;
  credits: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_10", gbp: 20, credits: 10 },
  { id: "pack_50", gbp: 100, credits: 50 },
  { id: "pack_100", gbp: 200, credits: 100 },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-credit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/credit.ts tests/billing-credit.test.ts
git commit -m "feat(billing): base pay-as-you-go credit is £2/call (packs repriced)"
```

---

### Task A2: Marketing + billing base-credit constants → £2 (with drift guard)

**Files:**
- Modify: `src/lib/marketing/pricing.ts`, `src/lib/billing/pricing.ts`
- Test: `tests/pricing.test.ts`, `tests/billing-new-model-provisioning.test.ts`, `tests/billing-pricing-drift.test.ts`

- [ ] **Step 1: Update the unit assertions.**
  - In `tests/pricing.test.ts`, change `expect(EXTRA_CALL_PRICE_GBP).toBe(0.9)` → `expect(EXTRA_CALL_PRICE_GBP).toBe(2)` and rename that test to `"base extra-call credit is £2"`.
  - In `tests/billing-new-model-provisioning.test.ts`, change `expect(DEFAULT_EXTRA_CALL_PRICE_GBP).toBe(0.9)` → `expect(DEFAULT_EXTRA_CALL_PRICE_GBP).toBe(2)` and rename to `"default overage is £2"`.

- [ ] **Step 2: Add a drift guard** — append to `tests/billing-pricing-drift.test.ts` (inside the existing `describe`):

```ts
  it("base credit rate matches across marketing + billing + ledger", () => {
    expect(DEFAULT_EXTRA_CALL_PRICE_GBP).toBe(EXTRA_CALL_PRICE_GBP);
    expect(CREDIT_UNIT_GBP).toBe(EXTRA_CALL_PRICE_GBP);
  });
```

Add the imports at the top of that file: `import { EXTRA_CALL_PRICE_GBP } from "@/lib/marketing/pricing";`, `import { DEFAULT_EXTRA_CALL_PRICE_GBP } from "@/lib/billing/pricing";`, `import { CREDIT_UNIT_GBP } from "@/lib/billing/credit";`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/pricing.test.ts tests/billing-new-model-provisioning.test.ts tests/billing-pricing-drift.test.ts`
Expected: FAIL (constants still 0.9).

- [ ] **Step 4: Flip the constants.**
  - `src/lib/marketing/pricing.ts`: change `export const EXTRA_CALL_PRICE_GBP = 0.9;` → `export const EXTRA_CALL_PRICE_GBP = 2;` and update its doc comment to "Pay-as-you-go base voice credit, £2 per call (custom plans override this)."
  - `src/lib/billing/pricing.ts`: change `export const DEFAULT_EXTRA_CALL_PRICE_GBP = 0.9;` → `export const DEFAULT_EXTRA_CALL_PRICE_GBP = 2;`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/pricing.test.ts tests/billing-new-model-provisioning.test.ts tests/billing-pricing-drift.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/marketing/pricing.ts src/lib/billing/pricing.ts tests/pricing.test.ts tests/billing-new-model-provisioning.test.ts tests/billing-pricing-drift.test.ts
git commit -m "feat(pricing): base extra-call credit £2 across marketing + billing + drift guard"
```

---

### Task A3: Ledger micros £2 + rate-agnostic email copy + custom-unaffected test

**Files:**
- Modify: `src/lib/billing/webhook-deps.ts`, `src/lib/email/templates.ts`
- Test: `tests/billing-credit-checkout.test.ts`

- [ ] **Step 1: Add a failing test** proving a CUSTOM tenant's top-up still prices at their rate (not £2) and a base tenant prices at £2. In `tests/billing-credit-checkout.test.ts`, locate the existing custom-rate test from H1 and add (matching the file's mock harness — it mocks `custom_plans` `.select().eq().maybeSingle()`):

```ts
  it("base tenant (no custom plan) prices top-ups at £2/credit", async () => {
    // custom_plans lookup returns null → base rate. A £20 ad-hoc top-up = 10 credits.
    // (Adapt to the file's harness: mock custom_plans maybeSingle → { data: null }.)
    // Assert the Stripe line unit/credits reflect £2 and metadata.credit_unit_micros === "2000000".
  });
```

Replace the comment body with the file's actual assertion style (mock `custom_plans` → `{ data: null }`, POST `{ customGbp: 20 }`, assert `creditsForGbpAt(20, 2) === 10` flows through and `credit_unit_micros: "2000000"` is set). Keep the H1 custom case (`extra_credit_price_gbp: 0.75`) asserting `750000`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-credit-checkout.test.ts`
Expected: FAIL (ledger micros still 900000 / base still 0.9 until A1/A2 land — if A1/A2 are already merged, the failing piece is the `2000000` metadata; ensure the test asserts it).

- [ ] **Step 3: Update the ledger micros + comment** in `src/lib/billing/webhook-deps.ts`:

```ts
/** Unit price of a single voice top-up credit, in micros (base £2 → 2,000,000).
 *  Custom-plan top-ups pass their own price via session metadata. */
const TOPUP_UNIT_PRICE_MICROS = 2_000_000;
```

- [ ] **Step 4: Make the email copy rate-agnostic** in `src/lib/email/templates.ts` — in `voiceUsageLowEmail`, replace the line:

```ts
      `When the plan is used up, calls keep being answered on pay-as-you-go credit at £0.90 per call. You can top up in advance to stay ahead.`,
```

with:

```ts
      `When the plan is used up, calls keep being answered on your pay-as-you-go credit. You can top up in advance to stay ahead.`,
```

(Removes the hardcoded rate so it stays correct for both base £2 and custom rates.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/billing-credit-checkout.test.ts tests/email-templates.test.ts tests/billing-handle-event.test.ts`
Expected: PASS. (If `email-templates.test.ts` asserted the old "£0.90 per call" string, update that assertion to match the new copy.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/billing/webhook-deps.ts src/lib/email/templates.ts tests/billing-credit-checkout.test.ts
git commit -m "feat(billing): ledger micros £2 base + rate-agnostic low-usage email"
```

---

## Phase B — Admin edit of a tenant's custom plan

### Task B1: Pure custom-plan edit schema + update builder

**Files:**
- Modify: `src/lib/billing/custom-plan.ts`
- Test: `tests/billing-custom-plan-edit.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/billing-custom-plan-edit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { editCustomPlanSchema, buildCustomPlanUpdate } from "@/lib/billing/custom-plan";

const valid = {
  plan_name: "Airport Pack v2",
  monthly_call_allowance: "6000",
  included_agents: "4",
  plan_price_gbp: "5200",
  extra_credit_price_gbp: "0.65",
  validity_days: "30",
};

describe("editCustomPlanSchema", () => {
  it("accepts valid edit input", () => {
    expect(editCustomPlanSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a blank plan name and zero validity", () => {
    expect(editCustomPlanSchema.safeParse({ ...valid, plan_name: "" }).success).toBe(false);
    expect(editCustomPlanSchema.safeParse({ ...valid, validity_days: "0" }).success).toBe(false);
  });
  it("rejects negative prices", () => {
    expect(editCustomPlanSchema.safeParse({ ...valid, extra_credit_price_gbp: "-1" }).success).toBe(false);
  });
});

describe("buildCustomPlanUpdate", () => {
  it("builds custom + voice updates and a combined monthly price (voice-only)", () => {
    const input = editCustomPlanSchema.parse(valid);
    const out = buildCustomPlanUpdate(input, { startsAt: "2026-06-17", chatMonthlyGbp: null });
    expect(out.custom).toMatchObject({
      plan_name: "Airport Pack v2",
      monthly_call_allowance: 6000,
      included_agents: 4,
      plan_price_gbp: 5200,
      extra_credit_price_gbp: 0.65,
      validity_days: 30,
      expires_at: "2026-07-17",
    });
    expect(out.voice).toEqual({ monthly_call_allowance: 6000, included_agents: 4, monthly_price_gbp: 5200 });
    expect(out.monthlyPrice).toBe(5200);
  });
  it("adds existing chat monthly into the combined monthly price", () => {
    const input = editCustomPlanSchema.parse(valid);
    const out = buildCustomPlanUpdate(input, { startsAt: null, chatMonthlyGbp: 499 });
    expect(out.monthlyPrice).toBe(5699); // 5200 voice + 499 chat
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-custom-plan-edit.test.ts`
Expected: FAIL (exports missing).

- [ ] **Step 3: Append to `src/lib/billing/custom-plan.ts`** (it already imports `z` and exports `packExpiry`):

```ts
/** Admin edit of an existing custom plan — the economic fields only. */
export const editCustomPlanSchema = z.object({
  plan_name: z.string().trim().min(1, "Plan name is required."),
  monthly_call_allowance: z.coerce.number().int().min(0),
  included_agents: z.coerce.number().int().min(0),
  plan_price_gbp: z.coerce.number().min(0),
  extra_credit_price_gbp: z.coerce.number().min(0),
  validity_days: z.coerce.number().int().positive("Validity must be at least 1 day."),
});

export type EditCustomPlanInput = z.infer<typeof editCustomPlanSchema>;

export interface CustomPlanUpdate {
  custom: {
    plan_name: string;
    monthly_call_allowance: number;
    included_agents: number;
    plan_price_gbp: number;
    extra_credit_price_gbp: number;
    validity_days: number;
    expires_at: string;
    updated_at: string;
  };
  voice: { monthly_call_allowance: number; included_agents: number; monthly_price_gbp: number };
  monthlyPrice: number;
}

/**
 * Pure builder for a custom-plan edit: shapes the custom_plans patch (recomputing
 * expires_at from the original start date), the mirrored voice_subscriptions
 * patch, and the tenant's combined monthly price (voice + any existing chat).
 */
export function buildCustomPlanUpdate(
  input: EditCustomPlanInput,
  ctx: { startsAt: string | null; chatMonthlyGbp: number | null },
): CustomPlanUpdate {
  const base = ctx.startsAt ?? new Date().toISOString().slice(0, 10);
  return {
    custom: {
      plan_name: input.plan_name,
      monthly_call_allowance: input.monthly_call_allowance,
      included_agents: input.included_agents,
      plan_price_gbp: input.plan_price_gbp,
      extra_credit_price_gbp: input.extra_credit_price_gbp,
      validity_days: input.validity_days,
      expires_at: packExpiry(base, input.validity_days),
      updated_at: new Date().toISOString(),
    },
    voice: {
      monthly_call_allowance: input.monthly_call_allowance,
      included_agents: input.included_agents,
      monthly_price_gbp: input.plan_price_gbp,
    },
    monthlyPrice: input.plan_price_gbp + (ctx.chatMonthlyGbp ?? 0),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-custom-plan-edit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/custom-plan.ts tests/billing-custom-plan-edit.test.ts
git commit -m "feat(billing): pure custom-plan edit schema + update builder"
```

---

### Task B2: `updateCustomPlan` server action

**Files:**
- Modify: `src/app/admin/tenants/[tenantId]/actions.ts`

- [ ] **Step 1: Add the action.** At the top of `[tenantId]/actions.ts`, extend the existing custom-plan import to include the edit helpers:

```ts
import { editCustomPlanSchema, buildCustomPlanUpdate } from "@/lib/billing/custom-plan";
```

(If `custom-plan` isn't imported yet in this file, add the line.) Then append this action (it follows the established `ActionState` + `serviceClient()` + `requireStaff()` + `writeAudit` patterns in the file):

```ts
/**
 * Edit an existing tenant's CUSTOM plan economics (admin only). Updates the
 * custom_plans row, mirrors allowance/agents/price into voice_subscriptions, and
 * keeps tenants.monthly_price (the MRR source of truth) in sync. The new
 * extra_credit_price_gbp takes effect immediately for the tenant's next top-up
 * (the credit-checkout route reads it live). No-op for non-custom tenants.
 */
export async function updateCustomPlan(
  tenantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const claims = await requireStaff();
  const client = serviceClient();

  const parsed = editCustomPlanSchema.safeParse({
    plan_name: formData.get("plan_name"),
    monthly_call_allowance: formData.get("monthly_call_allowance"),
    included_agents: formData.get("included_agents"),
    plan_price_gbp: formData.get("plan_price_gbp"),
    extra_credit_price_gbp: formData.get("extra_credit_price_gbp"),
    validity_days: formData.get("validity_days"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>, formError: null };
  }

  const { data: existing } = await client
    .from("custom_plans")
    .select("starts_at, chat_monthly_gbp")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!existing) {
    return { fieldErrors: {}, formError: "This tenant has no custom plan to edit." };
  }

  const update = buildCustomPlanUpdate(parsed.data, {
    startsAt: (existing.starts_at as string | null) ?? null,
    chatMonthlyGbp: existing.chat_monthly_gbp == null ? null : Number(existing.chat_monthly_gbp),
  });

  const { error: cpErr } = await client.from("custom_plans").update(update.custom).eq("tenant_id", tenantId);
  if (cpErr) {
    console.error("updateCustomPlan: custom_plans update failed", cpErr);
    return { fieldErrors: {}, formError: "Could not update the custom plan. Please try again." };
  }

  // Mirror the voice economics so the call pool + dashboard reflect the edit.
  await client.from("voice_subscriptions").update(update.voice).eq("tenant_id", tenantId);
  await client.from("tenants").update({ monthly_price: update.monthlyPrice }).eq("id", tenantId);

  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "tenant.custom_plan_update",
    targetType: "tenant",
    targetId: tenantId,
    metadata: {
      plan_name: parsed.data.plan_name,
      monthly_call_allowance: parsed.data.monthly_call_allowance,
      extra_credit_price_gbp: parsed.data.extra_credit_price_gbp,
      plan_price_gbp: parsed.data.plan_price_gbp,
    },
  });
  if (!audited) console.error("audit write failed for tenant.custom_plan_update", { tenantId });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { fieldErrors: {}, formError: null, ok: true };
}
```

- [ ] **Step 2: Verify it compiles in isolation**

Run: `npm run build 2>&1 | grep -iE "tenants/\[tenantId\]/actions" | head`
Expected: no errors referencing this file. (If the build flags an unused import or missing symbol, fix it.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/tenants/[tenantId]/actions.ts"
git commit -m "feat(admin): updateCustomPlan action (incl. extra-credit price), mirrors to subs"
```

---

### Task B3: Edit-custom-plan form on the tenant detail page

**Files:**
- Modify: `src/app/admin/tenants/[tenantId]/tenant-manage-forms.tsx`, `src/app/admin/tenants/[tenantId]/page.tsx`

- [ ] **Step 1: Add the form component.** In `tenant-manage-forms.tsx` (a `"use client"` module that already imports `useActionState`/`useId` and the detail actions), add `updateCustomPlan` to the `./actions` import, and append this component (reuse the file's existing `inputClass` + `FieldError` helpers — match their actual names in the file):

```tsx
export function EditCustomPlanForm({
  tenantId,
  plan,
}: {
  tenantId: string;
  plan: {
    plan_name: string;
    monthly_call_allowance: number;
    included_agents: number;
    plan_price_gbp: number;
    extra_credit_price_gbp: number;
    validity_days: number;
  };
}) {
  const action = updateCustomPlan.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(action, { fieldErrors: {}, formError: null });
  const fe = state.fieldErrors;
  const nameId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.ok && (
        <p role="status" aria-live="polite" className="border-2 border-ink bg-brut-lime/30 px-3 py-2 text-sm font-medium text-ink">
          Custom plan updated. New extra-credit price applies to the next top-up.
        </p>
      )}
      {state.formError && (
        <p role="alert" className="border border-ink bg-brut-red/15 px-3 py-2 text-sm text-brut-red-deep">{state.formError}</p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Plan name
          <input id={nameId} name="plan_name" defaultValue={plan.plan_name} className={inputClass} />
          <FieldError id={`${nameId}-error`} error={fe.plan_name?.[0]} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Number of calls (per period)
          <input name="monthly_call_allowance" type="number" min="0" defaultValue={plan.monthly_call_allowance} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Number of agents
          <input name="included_agents" type="number" min="0" defaultValue={plan.included_agents} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Plan / pack price (£)
          <input name="plan_price_gbp" type="number" step="0.01" min="0" defaultValue={plan.plan_price_gbp} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Per-call extra credit (£, overage)
          <input name="extra_credit_price_gbp" type="number" step="0.01" min="0" defaultValue={plan.extra_credit_price_gbp} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Pack validity (days)
          <input name="validity_days" type="number" min="1" defaultValue={plan.validity_days} className={inputClass} />
        </label>
      </div>
      <div>
        <button type="submit" disabled={pending} className="border-2 border-ink bg-brut-lime px-4 py-2 text-sm font-bold uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-50">
          {pending ? "Saving…" : "Save custom plan"}
        </button>
      </div>
    </form>
  );
}
```

> If the file's error helper is not named `FieldError`, use the actual one (the `createAutomation`/`InviteForm` forms in the repo use a small inline error `<p>` — match that). If `inputClass` isn't exported in this module, copy the one-line `const inputClass = "..."` used by the other forms here.

- [ ] **Step 2: Load the custom plan + render the form** in `[tenantId]/page.tsx`. Add a `custom_plans` read to the page's `Promise.all`:

```ts
    serviceClient
      .from("custom_plans")
      .select("plan_name, monthly_call_allowance, included_agents, plan_price_gbp, extra_credit_price_gbp, validity_days")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
```

Destructure it as `{ data: customPlanData }` (add it positionally to the destructuring array). Import `EditCustomPlanForm` from `./tenant-manage-forms`. Then, after the "Billing actions" `<Section>`, add:

```tsx
      {customPlanData && (
        <Section title="Custom plan">
          <div className="border-[3px] border-ink bg-paper p-5">
            <EditCustomPlanForm
              tenantId={tenant.id}
              plan={{
                plan_name: String((customPlanData as Record<string, unknown>).plan_name ?? ""),
                monthly_call_allowance: Number((customPlanData as Record<string, unknown>).monthly_call_allowance ?? 0),
                included_agents: Number((customPlanData as Record<string, unknown>).included_agents ?? 0),
                plan_price_gbp: Number((customPlanData as Record<string, unknown>).plan_price_gbp ?? 0),
                extra_credit_price_gbp: Number((customPlanData as Record<string, unknown>).extra_credit_price_gbp ?? 0),
                validity_days: Number((customPlanData as Record<string, unknown>).validity_days ?? 0),
              }}
            />
          </div>
        </Section>
      )}
```

- [ ] **Step 3: Verify it compiles**

Run: `npm run build 2>&1 | grep -iE "tenant-manage-forms|\[tenantId\]/page" | head`
Expected: no errors. Then run the `impeccable` skill's quick visual check on the tenant detail page for a custom tenant (form spacing, the success banner contrast).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/tenants/[tenantId]/tenant-manage-forms.tsx" "src/app/admin/tenants/[tenantId]/page.tsx"
git commit -m "feat(admin): edit-custom-plan form on tenant detail (custom tenants only)"
```

---

## Phase C — Recurring renewals: dashboard pay + working Autopay

### Task C1: Autopay flips subscriptions to charge_automatically

**Files:**
- Modify: `src/lib/billing/handle-event.ts`, `src/lib/billing/webhook-deps.ts`
- Test: `tests/billing-handle-event.test.ts`, `tests/billing-webhook-route.test.ts`

- [ ] **Step 1: Add a failing test** to `tests/billing-handle-event.test.ts` — the autopay-setup checkout completion must call BOTH `setDefaultPaymentMethod` AND `enableAutopayRenewals`. Add `enableAutopayRenewals: vi.fn(async () => {})` to the shared `deps()` factory (so all tests keep passing), then add:

```ts
  it("autopay setup sets the default PM AND enables auto-charge on renewals", async () => {
    const calls: string[] = [];
    const ev = {
      id: "evt_autopay",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_autopay",
          metadata: { reason: "autopay_setup", tenant_id: "tnt-1" },
          setup_intent: "si_1",
          customer: "cus_1",
        },
      },
    } as unknown as Stripe.Event;
    const d = deps({
      setDefaultPaymentMethod: vi.fn(async () => { calls.push("pm"); }),
      enableAutopayRenewals: vi.fn(async () => { calls.push("auto"); }),
    });
    const res = await handleStripeEvent(ev, d);
    expect(d.setDefaultPaymentMethod).toHaveBeenCalledWith({ customerId: "cus_1", setupIntentId: "si_1" });
    expect(d.enableAutopayRenewals).toHaveBeenCalledWith({ customerId: "cus_1" });
    expect(res.action).toBe("autopay.enabled");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-handle-event.test.ts`
Expected: FAIL (`enableAutopayRenewals` not in interface / not called).

- [ ] **Step 3: Extend `BillingDeps` + the autopay branch** in `handle-event.ts`. Add to the interface (after `setDefaultPaymentMethod`):

```ts
  /** After autopay setup, switch the customer's BookMyCab subscriptions to
   *  `charge_automatically` so renewals auto-charge the saved default card. */
  enableAutopayRenewals(args: { customerId: string }): Promise<void>;
```

In the `checkout.session.completed` autopay branch, after `await deps.setDefaultPaymentMethod(...)` and before `return { action: "autopay.enabled" }`, add:

```ts
        await deps.enableAutopayRenewals({ customerId });
```

- [ ] **Step 4: Implement `enableAutopayRenewals`** in `webhook-deps.ts` `buildBillingDeps()` (uses the closure's `getStripe`):

```ts
    async enableAutopayRenewals({ customerId }) {
      const stripe = getStripe();
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 100 });
      for (const sub of subs.data) {
        // Only our product subscriptions; skip anything else on the customer and
        // anything already auto-charging.
        const product = sub.metadata?.product;
        if (product !== "chat" && product !== "voice") continue;
        if (sub.collection_method === "charge_automatically") continue;
        await stripe.subscriptions.update(sub.id, { collection_method: "charge_automatically" });
      }
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/billing-handle-event.test.ts tests/billing-webhook-route.test.ts`
Expected: PASS. (If `billing-webhook-route.test.ts` builds a manual `BillingDeps` fake, add `enableAutopayRenewals: async () => {}` to it; if it mocks `buildBillingDeps`, no change.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/billing/handle-event.ts src/lib/billing/webhook-deps.ts tests/billing-handle-event.test.ts tests/billing-webhook-route.test.ts
git commit -m "feat(billing): enabling Autopay switches renewals to charge_automatically"
```

---

### Task C2: Dashboard — open renewal invoices + autopay status

**Files:**
- Create: `src/lib/dashboard/open-invoices.ts`
- Test: `tests/billing-open-invoices.test.ts`
- Modify: `src/app/dashboard/billing/page.tsx`

- [ ] **Step 1: Write the failing test** — create `tests/billing-open-invoices.test.ts` (tests the pure mapper only; the Stripe-calling functions are integration-tested in Phase D):

```ts
import { describe, it, expect } from "vitest";
import { mapStripeInvoiceRow } from "@/lib/dashboard/open-invoices";

describe("mapStripeInvoiceRow", () => {
  it("maps id, amount (minor→major), hosted url, due date", () => {
    const row = mapStripeInvoiceRow({
      id: "in_1",
      amount_due: 49900,
      currency: "gbp",
      hosted_invoice_url: "https://invoice.stripe.com/i/x",
      due_date: 1_752_000_000,
      status: "open",
    } as never);
    expect(row).toEqual({
      id: "in_1",
      amountGbp: 499,
      hostedUrl: "https://invoice.stripe.com/i/x",
      dueDate: "2025-07-08",
    });
  });
  it("tolerates a missing due date + url", () => {
    const row = mapStripeInvoiceRow({ id: "in_2", amount_due: 0, currency: "gbp", hosted_invoice_url: null, due_date: null, status: "open" } as never);
    expect(row.dueDate).toBeNull();
    expect(row.hostedUrl).toBeNull();
    expect(row.amountGbp).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/billing-open-invoices.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `src/lib/dashboard/open-invoices.ts`:**

```ts
import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { fromMinor } from "@/lib/billing/plan-price";

export interface OpenInvoiceRow {
  id: string;
  amountGbp: number;
  hostedUrl: string | null;
  dueDate: string | null; // YYYY-MM-DD
}

/** Pure Stripe.Invoice → dashboard row. */
export function mapStripeInvoiceRow(inv: Stripe.Invoice): OpenInvoiceRow {
  return {
    id: inv.id ?? "",
    amountGbp: fromMinor(inv.amount_due ?? 0),
    hostedUrl: inv.hosted_invoice_url ?? null,
    dueDate: typeof inv.due_date === "number" ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : null,
  };
}

/** A tenant's currently payable (open) invoices — renewals awaiting payment. */
export async function getOpenInvoices(customerId: string): Promise<OpenInvoiceRow[]> {
  try {
    const list = await getStripe().invoices.list({ customer: customerId, status: "open", limit: 12 });
    return list.data.map(mapStripeInvoiceRow);
  } catch (err) {
    console.error("getOpenInvoices failed", err);
    return [];
  }
}

/** Whether the customer has a default payment method (autopay active). */
export async function getAutopayEnabled(customerId: string): Promise<boolean> {
  try {
    const customer = await getStripe().customers.retrieve(customerId);
    if (customer.deleted) return false;
    return Boolean(customer.invoice_settings?.default_payment_method);
  } catch (err) {
    console.error("getAutopayEnabled failed", err);
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/billing-open-invoices.test.ts`
Expected: PASS.

- [ ] **Step 5: Render open invoices + autopay status** in `src/app/dashboard/billing/page.tsx`. Add imports:

```ts
import { getOpenInvoices, getAutopayEnabled } from "@/lib/dashboard/open-invoices";
import { formatCurrency } from "@/lib/dashboard/format";
```

(`formatCurrency` is likely already imported — don't duplicate.) After `const b = await getBillingOverview(claims.tenant_id);`, fetch (only when a Stripe customer exists):

```ts
  const openInvoices = b.stripeCustomerId ? await getOpenInvoices(b.stripeCustomerId) : [];
  const autopayOn = b.stripeCustomerId ? await getAutopayEnabled(b.stripeCustomerId) : false;
```

Add a section just above the existing "Actions" section:

```tsx
      {/* Open renewal invoices — pay this month's subscription from here. */}
      {openInvoices.length > 0 && (
        <section aria-labelledby="open-inv-heading" className="space-y-3">
          <h2 id="open-inv-heading" className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Invoices to pay
          </h2>
          <div className="divide-y-2 divide-gray-100 border-[3px] border-ink bg-paper">
            {openInvoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono font-bold tabular-nums text-ink">{formatCurrency(inv.amountGbp, "GBP")}</p>
                  <p className="text-xs text-gray-500">{inv.dueDate ? `Due ${inv.dueDate}` : "Due now"}</p>
                </div>
                {inv.hostedUrl && (
                  <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer"
                    className="border-2 border-ink bg-brut-yellow px-4 py-2 text-sm font-bold uppercase text-ink hover:bg-ink hover:text-paper">
                    Pay now
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
```

In the existing "Actions" section, replace the autopay help line with an autopay status line:

```tsx
        <p className="text-sm text-gray-600">
          {autopayOn ? (
            <><span className="font-medium text-ink">Autopay is on.</span> Your monthly subscription auto-charges your saved card each cycle.</>
          ) : (
            <><span className="font-medium text-ink">Set up autopay</span> to auto-charge your monthly subscription, or pay each invoice above. Use the portal to manage your card.</>
          )}
        </p>
```

- [ ] **Step 6: Verify it compiles**

Run: `npm run build 2>&1 | grep -iE "dashboard/billing|open-invoices" | head`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dashboard/open-invoices.ts tests/billing-open-invoices.test.ts src/app/dashboard/billing/page.tsx
git commit -m "feat(dashboard): pay open renewal invoices in-dashboard + autopay status"
```

---

## Phase D — Verify + sandbox test

### Task D1: Typecheck + full unit suite + build

**Files:** none (verification)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Fix any leftover reference to the old £0.90 maths or a missing import.

- [ ] **Step 2: Full unit suite**

Run: `npm run test`
Expected: the pricing/billing/credit/handle-event/open-invoices/custom-plan-edit tests PASS. Pre-existing, unrelated failures (DB-integration `rls`/`hook`/`admin-rls`, `auth-forms`, `dashboard-format`, `epic-10-voice`, `marketing-demo-whatsapp`) are known and out of scope — confirm the failing set did not grow beyond those files (`git diff` shows you didn't touch them).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A && git commit -m "test/build: reconcile suite with £2 base credit + autopay/edit changes"
```

---

### Task D2: Sandbox proof — £2 base credit, custom rate, autopay auto-charge

**Files:**
- Create: `scripts/sandbox-renewal-autopay.ts`

> Mirrors `scripts/sandbox-activation-invoice.ts`. Test-mode only (guarded by `sk_test_`). Proves: (a) base credit prices at £2/credit; (b) a custom rate prices differently; (c) a `charge_automatically` subscription with a saved test card auto-pays its first invoice (i.e. autopay renewals work).

- [ ] **Step 1: Write the script:**

```ts
/**
 * Sandbox proof for the £2 base credit + autopay auto-charge. Test mode only.
 * Run: npx tsx scripts/sandbox-renewal-autopay.ts
 */
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { creditsForGbpAt, CREDIT_UNIT_GBP } from "../src/lib/billing/credit";

function env(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      if (t.slice(0, i).trim() === key) return t.slice(i + 1).trim();
    }
  } catch {}
  return undefined;
}

async function main() {
  const secret = env("STRIPE_SECRET_KEY");
  if (!secret?.startsWith("sk_test_")) throw new Error("sandbox-only: need sk_test_ key in .env.local");
  const stripe = new Stripe(secret);

  // (a) + (b) pure credit maths
  console.log("\n--- credit pricing ---");
  console.log("base £20 top-up →", creditsForGbpAt(20, CREDIT_UNIT_GBP), "credits (expect 10 @ £2)");
  console.log("custom £20 @ £0.75 →", creditsForGbpAt(20, 0.75), "credits (expect 26)");

  // (c) autopay auto-charge: customer + saved test card + charge_automatically sub
  const customer = await stripe.customers.create({ name: "Sandbox Autopay Cabs", email: "sandbox-autopay@bookmycab.test", address: { country: "GB" }, metadata: { bookmycab: "sandbox-autopay" } });
  const pm = await stripe.paymentMethods.create({ type: "card", card: { token: "tok_visa" } });
  await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });

  const product = await stripe.products.create({ name: "BookMyCab Automation (sandbox autopay)", metadata: { bookmycab: "automation-sandbox" } });
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    collection_method: "charge_automatically",
    items: [{ price_data: { currency: "gbp", product: product.id, unit_amount: 49900, recurring: { interval: "month" } } }],
    metadata: { tenant_id: "sandbox", product: "chat" },
  });
  const latestId = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id ?? null;
  const inv = latestId ? await stripe.invoices.retrieve(latestId) : null;

  console.log("\n--- autopay subscription ---");
  console.log("collection_method:", sub.collection_method, "(expect charge_automatically)");
  console.log("first invoice status:", inv?.status, "(expect 'paid' — auto-charged the saved test card)");
  console.log("invoice total: £" + ((inv?.total ?? 0) / 100).toFixed(2));
  console.log("customer:", customer.id);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/sandbox-renewal-autopay.ts`
Expected output shows: base £20 → 10 credits; custom £20 @ £0.75 → 26 credits; `collection_method: charge_automatically`; **first invoice status: paid** (proves autopay auto-charges).

- [ ] **Step 3: Report the result to the user** — paste the script output (the credit counts + the auto-paid invoice status). This is the "test like we did" confirmation that £2 base credit, custom override, and autopay auto-charge all work.

- [ ] **Step 4: Commit**

```bash
git add scripts/sandbox-renewal-autopay.ts
git commit -m "chore(billing): sandbox proof for £2 base credit + autopay auto-charge"
```

---

## Self-review checklist (run after the plan, before execution)

- **Spec coverage:** Recurring renewal payable in dashboard (C2 open-invoices) ✓; autopay actually applies (C1 flip to charge_automatically + D2 proof) ✓; admin can change the custom extra-credit price post-creation (B1/B2/B3, takes effect live via the H1 checkout read) ✓; base credit £2/call not affecting custom tenants (A1/A2/A3 + the custom override already in the checkout route) ✓; sandbox testing (D2) ✓.
- **Type consistency:** `enableAutopayRenewals({ customerId })`, `editCustomPlanSchema`/`buildCustomPlanUpdate({ startsAt, chatMonthlyGbp })`, `updateCustomPlan`, `getOpenInvoices`/`getAutopayEnabled`/`mapStripeInvoiceRow`/`OpenInvoiceRow`, `CREDIT_UNIT_GBP`/`EXTRA_CALL_PRICE_GBP`/`DEFAULT_EXTRA_CALL_PRICE_GBP`/`TOPUP_UNIT_PRICE_MICROS` are used identically across tasks.
- **No placeholders:** every code step shows full code; every run step shows the command + expected result. (A3 Step 1's test body must be filled to the file's real harness during execution — flagged inline.)
- **Watch during execution:** the dashboard billing page now makes 2 Stripe calls (`getOpenInvoices` + `getAutopayEnabled`) on render — both are wrapped in try/catch returning empty/false so a Stripe hiccup never breaks the page; keep them after the existing queries. `enableAutopayRenewals` only flips subs tagged `metadata.product` chat|voice, so unrelated customer subscriptions are untouched.
