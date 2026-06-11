# B2 — New-Model Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy `plan_band` tenant-provisioning flow with a new-model flow (Chat / Voice / Double Decker tiers, auto-computed GBP prices) that writes `chat_subscriptions` / `voice_subscriptions` + `tenants.commercial_model` and leaves the tenant in `onboarding`.

**Architecture:** Add pure helpers to `src/lib/billing/pricing.ts` (`VOICE_PLAN_SPEC`, `setupFeeGbp`, plus a single `resolveNewModelPricing` that returns the chat/voice/setup GBP figures for a selection). Rewrite the `createTenant` server action to validate a new-model schema, compute prices via those helpers, and insert the tenant + subscription rows. Rebuild the client form to drive the selection and show computed prices. Stripe is untouched here (B3).

**Tech Stack:** Next.js 15 server actions, React 19 client form, Zod, Supabase service-role client, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-10-b2-new-model-provisioning-design.md`
**Depends on:** B1 applied (schema + `chatMonthlyPriceGbp`/`voiceMonthlyPriceGbp`/setup constants in `billing/pricing.ts`).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/lib/billing/pricing.ts` | Add `VOICE_PLAN_SPEC`, `setupFeeGbp`, `resolveNewModelPricing` | Modify (append) |
| `src/app/admin/tenants/actions.ts` | Rewrite `createTenant` for the new model | Modify |
| `src/app/admin/tenants/new/tenant-form.tsx` | Rebuild form fields + live price display | Modify |
| `tests/billing-new-model-provisioning.test.ts` | Unit tests for the new helpers | Create |
| `tests/admin-provisioning-action.test.ts` | Schema/validation + insert-shape tests for `createTenant` | Create |

---

### Task 1: Provisioning pricing helpers

**Files:**
- Modify: `src/lib/billing/pricing.ts` (append after the B1 new-model section)
- Create: `tests/billing-new-model-provisioning.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/billing-new-model-provisioning.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  VOICE_PLAN_SPEC,
  setupFeeGbp,
  resolveNewModelPricing,
} from "@/lib/billing/pricing";

describe("VOICE_PLAN_SPEC", () => {
  it("maps tier → allowance + included agents", () => {
    expect(VOICE_PLAN_SPEC.ignition).toEqual({ callAllowance: 1500, includedAgents: 1 });
    expect(VOICE_PLAN_SPEC.in_motion).toEqual({ callAllowance: 2250, includedAgents: 2 });
    expect(VOICE_PLAN_SPEC.full_throttle).toEqual({ callAllowance: 3000, includedAgents: 2 });
  });
});

describe("setupFeeGbp", () => {
  it("chat = 1000", () => {
    expect(setupFeeGbp("chat", 0)).toBe(1000);
  });
  it("voice = 1000 (1 agent) / 1500 (2 agents)", () => {
    expect(setupFeeGbp("voice", 1)).toBe(1000);
    expect(setupFeeGbp("voice", 2)).toBe(1500);
  });
  it("double_decker = 1500 (1 voice agent) / 2000 (2 voice agents)", () => {
    expect(setupFeeGbp("double_decker", 1)).toBe(1500);
    expect(setupFeeGbp("double_decker", 2)).toBe(2000);
  });
});

describe("resolveNewModelPricing", () => {
  it("chat-only: chat price set, voice null, setup 1000", () => {
    const r = resolveNewModelPricing({
      model: "chat", chatTier: "in_motion", chatMode: "bundle", voiceTier: null,
    });
    expect(r).toEqual({ chatGbp: 1799, voiceGbp: null, voiceAllowance: null, voiceAgents: null, setupGbp: 1000 });
  });
  it("voice-only: voice price + allowance/agents, chat null, setup by agents", () => {
    const r = resolveNewModelPricing({
      model: "voice", chatTier: null, chatMode: null, voiceTier: "in_motion",
    });
    expect(r).toEqual({ chatGbp: null, voiceGbp: 1599, voiceAllowance: 2250, voiceAgents: 2, setupGbp: 1500 });
  });
  it("double_decker: authored split + allowance + bundle setup", () => {
    const r = resolveNewModelPricing({
      model: "double_decker", chatTier: "in_motion", chatMode: "bundle", voiceTier: "in_motion",
    });
    expect(r).toEqual({ chatGbp: 1600, voiceGbp: 1599, voiceAllowance: 2250, voiceAgents: 2, setupGbp: 2000 });
  });
  it("full_throttle chat is quoted: chatGbp null (caller must supply override)", () => {
    const r = resolveNewModelPricing({
      model: "chat", chatTier: "full_throttle", chatMode: "single", voiceTier: null,
    });
    expect(r.chatGbp).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/billing-new-model-provisioning.test.ts`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Append the helpers to `src/lib/billing/pricing.ts`**

Add at the END of the file (after the B1 new-model section):

```ts

/* ----------------------------------------------------------------------------
   B2: Provisioning helpers — operational voice plan shape + resolved pricing.
   -------------------------------------------------------------------------- */

/** Operational shape of a voice plan tier (drives voice_subscriptions). */
export interface VoicePlanSpec {
  callAllowance: number;
  includedAgents: number;
}

export const VOICE_PLAN_SPEC: Record<NewTierKey, VoicePlanSpec> = {
  ignition: { callAllowance: 1500, includedAgents: 1 },
  in_motion: { callAllowance: 2250, includedAgents: 2 },
  full_throttle: { callAllowance: 3000, includedAgents: 2 },
};

/** One-time setup fee (GBP) for a commercial model + voice agent count. */
export function setupFeeGbp(model: CommercialModel, voiceAgents: 0 | 1 | 2): number {
  if (model === "chat") return NEW_CHAT_SETUP_GBP;
  if (model === "voice") {
    return voiceAgents >= 2 ? NEW_VOICE_SETUP_GBP.twoAgents : NEW_VOICE_SETUP_GBP.oneAgent;
  }
  return voiceAgents >= 2 ? NEW_BUNDLE_SETUP_GBP.twoVoiceAgents : NEW_BUNDLE_SETUP_GBP.oneVoiceAgent;
}

export interface NewModelSelection {
  model: CommercialModel;
  chatTier: NewTierKey | null;
  chatMode: ChatChannelMode | null;
  voiceTier: NewTierKey | null;
}

export interface ResolvedNewModelPricing {
  chatGbp: number | null;     // null = no chat product OR quoted (full_throttle)
  voiceGbp: number | null;    // null = no voice product
  voiceAllowance: number | null;
  voiceAgents: number | null;
  setupGbp: number;
}

/**
 * Resolve all GBP figures + voice operational shape for a provisioning
 * selection. chatGbp is null for a voice-only tenant or a quoted Full Throttle
 * chat tier (the caller supplies a manual override in that case).
 */
export function resolveNewModelPricing(sel: NewModelSelection): ResolvedNewModelPricing {
  const hasChat = sel.model === "chat" || sel.model === "double_decker";
  const hasVoice = sel.model === "voice" || sel.model === "double_decker";

  const chatGbp =
    hasChat && sel.chatTier && sel.chatMode
      ? chatMonthlyPriceGbp(sel.model, sel.chatTier, sel.chatMode)
      : null;

  const voiceGbp =
    hasVoice && sel.voiceTier
      ? voiceMonthlyPriceGbp(sel.model, sel.voiceTier, sel.chatMode ?? "single")
      : null;

  const voiceAllowance = hasVoice && sel.voiceTier ? VOICE_PLAN_SPEC[sel.voiceTier].callAllowance : null;
  const voiceAgents = hasVoice && sel.voiceTier ? VOICE_PLAN_SPEC[sel.voiceTier].includedAgents : null;

  const setupGbp = setupFeeGbp(sel.model, (voiceAgents ?? 0) as 0 | 1 | 2);

  return { chatGbp, voiceGbp, voiceAllowance, voiceAgents, setupGbp };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/billing-new-model-provisioning.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/billing/pricing.ts tests/billing-new-model-provisioning.test.ts
git commit -m "feat(billing): new-model provisioning pricing helpers"
```

---

### Task 2: Rewrite the `createTenant` server action

**Files:**
- Modify: `src/app/admin/tenants/actions.ts`
- Create: `tests/admin-provisioning-action.test.ts`

> Read the current `createTenant` fully before editing — preserve the coupon validation, `billing_bypass` comp logic, audit, and redirect; change the schema + what gets inserted. The schema moves from `plan_band` + manual `monthly_price`/`setup_fee` to the new-model selection. The function still uses the service-role client.

- [ ] **Step 1: Write the failing test (schema + computed inserts)**

Create `tests/admin-provisioning-action.test.ts`. This tests the exported zod schema and a pure `buildTenantInsert` helper you will extract from the action (so the DB/Stripe-free logic is unit-testable):

```ts
import { describe, it, expect } from "vitest";
import {
  createTenantSchema,
  buildProvisioningRows,
} from "@/app/admin/tenants/actions";

const base = {
  name: "Speedy Cabs",
  slug: "speedy-cabs",
  country: "GB",
  contact_email: "ops@speedy.example",
  dispatch_adapter: "autocab",
};

describe("createTenantSchema", () => {
  it("accepts a valid double_decker selection", () => {
    const r = createTenantSchema.safeParse({
      ...base, commercial_model: "double_decker",
      chat_tier: "in_motion", chat_channel_mode: "bundle", voice_tier: "in_motion",
    });
    expect(r.success).toBe(true);
  });
  it("requires chat fields when model includes chat", () => {
    const r = createTenantSchema.safeParse({ ...base, commercial_model: "chat" });
    expect(r.success).toBe(false);
  });
  it("requires a manual chat price for full_throttle chat", () => {
    const r = createTenantSchema.safeParse({
      ...base, commercial_model: "chat", chat_tier: "full_throttle", chat_channel_mode: "single",
    });
    expect(r.success).toBe(false); // chat_price_override required
  });
});

describe("buildProvisioningRows", () => {
  it("double_decker → tenant + chat + voice rows with discounted GBP", () => {
    const out = buildProvisioningRows({
      data: {
        ...base, commercial_model: "double_decker",
        chat_tier: "in_motion", chat_channel_mode: "bundle", voice_tier: "in_motion",
        chat_price_override: undefined, coupon_code: undefined,
      },
      discountPercent: 10,
      bypass: false,
    });
    // 10% off: chat 1600→1440, voice 1599→1439.1, setup 2000→1800
    expect(out.tenant.commercial_model).toBe("double_decker");
    expect(out.tenant.currency).toBe("GBP");
    expect(out.tenant.plan_band).toBeNull();
    expect(out.tenant.status).toBe("onboarding");
    expect(out.chat?.monthly_price_gbp).toBeCloseTo(1440, 2);
    expect(out.chat?.channel_mode).toBe("bundle");
    expect(out.voice?.monthly_price_gbp).toBeCloseTo(1439.1, 2);
    expect(out.voice?.monthly_call_allowance).toBe(2250);
    expect(out.voice?.included_agents).toBe(2);
    expect(out.setupGbp).toBeCloseTo(1800, 2);
  });
  it("voice-only → no chat row", () => {
    const out = buildProvisioningRows({
      data: { ...base, commercial_model: "voice", voice_tier: "ignition",
        chat_tier: undefined, chat_channel_mode: undefined, chat_price_override: undefined, coupon_code: undefined },
      discountPercent: 0, bypass: false,
    });
    expect(out.chat).toBeNull();
    expect(out.voice?.monthly_price_gbp).toBe(1199);
  });
  it("bypass (100%-off) → zero prices, status active", () => {
    const out = buildProvisioningRows({
      data: { ...base, commercial_model: "chat", chat_tier: "ignition", chat_channel_mode: "single",
        voice_tier: undefined, chat_price_override: undefined, coupon_code: "FREE" },
      discountPercent: 100, bypass: true,
    });
    expect(out.tenant.status).toBe("active");
    expect(out.tenant.billing_bypass).toBe(true);
    expect(out.chat?.monthly_price_gbp).toBe(0);
    expect(out.setupGbp).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/admin-provisioning-action.test.ts`
Expected: FAIL — `createTenantSchema` / `buildProvisioningRows` not exported.

- [ ] **Step 3: Rewrite the schema + extract `buildProvisioningRows`**

In `src/app/admin/tenants/actions.ts`:

(a) Update imports — replace the pricing/plan-band imports with:

```ts
import { applyDiscount } from "@/lib/admin/coupons";
import { validateCoupon, redeemCoupon } from "@/lib/admin/coupons";
import {
  resolveNewModelPricing,
  type CommercialModel,
  type NewTierKey,
  type ChatChannelMode,
} from "@/lib/billing/pricing";
```
(Keep `CURRENCIES` import removed — currency is forced to GBP. Keep `COUNTRY_CODES`, `writeAudit`, `requireStaff`, `createSupabaseJS`, `env`, `redirect`, `z` as-is. Remove `CONTRACT_MONTHS`, `addMonthsUTC`, `PLAN_BANDS` imports if now unused — verify before removing.)

(b) Replace the `createTenantSchema` with an exported new-model schema:

```ts
const COMMERCIAL_MODELS = ["chat", "voice", "double_decker"] as const;
const TIERS = ["ignition", "in_motion", "full_throttle"] as const;
const CHANNEL_MODES = ["single", "bundle"] as const;
const DISPATCH_ADAPTERS = ["autocab", "icabbi", "cordic"] as const;

const optionalText = z.string().trim().transform((v) => v || undefined).optional();

export const createTenantSchema = z
  .object({
    name: z.string().trim().min(1, "Org name is required."),
    slug: z.string().trim().min(1, "Slug is required.")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and single hyphens."),
    country: z.enum(COUNTRY_CODES, { message: "Select a valid country." }),
    contact_email: z.string().trim().email("Enter a valid contact email."),
    dispatch_adapter: z.enum(DISPATCH_ADAPTERS),
    dispatch_company_id: optionalText,
    commercial_model: z.enum(COMMERCIAL_MODELS),
    chat_tier: z.enum(TIERS).optional(),
    chat_channel_mode: z.enum(CHANNEL_MODES).optional(),
    voice_tier: z.enum(TIERS).optional(),
    chat_price_override: z.string().trim()
      .transform((v) => (v === "" ? undefined : Number(v)))
      .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), { message: "Price must be ≥ 0." })
      .optional(),
    coupon_code: optionalText,
  })
  .superRefine((d, ctx) => {
    const hasChat = d.commercial_model === "chat" || d.commercial_model === "double_decker";
    const hasVoice = d.commercial_model === "voice" || d.commercial_model === "double_decker";
    if (hasChat && !d.chat_tier) ctx.addIssue({ code: "custom", path: ["chat_tier"], message: "Pick a chat tier." });
    if (hasChat && !d.chat_channel_mode) ctx.addIssue({ code: "custom", path: ["chat_channel_mode"], message: "Pick a channel mode." });
    if (hasVoice && !d.voice_tier) ctx.addIssue({ code: "custom", path: ["voice_tier"], message: "Pick a voice tier." });
    if (hasChat && d.chat_tier === "full_throttle" && d.chat_price_override === undefined)
      ctx.addIssue({ code: "custom", path: ["chat_price_override"], message: "Enter a quoted monthly price for Full Throttle." });
  });

export type CreateTenantData = z.infer<typeof createTenantSchema>;
```

(c) Add the exported pure builder:

```ts
export interface ProvisioningRows {
  tenant: {
    name: string; slug: string; country: string; currency: "GBP";
    plan_band: null; commercial_model: CommercialModel;
    dispatch_adapter: string; dispatch_company_id: string | null;
    contact_email: string; coupon_code: string | null; discount_percent: number;
    billing_bypass: boolean; status: "onboarding" | "active";
  };
  chat: { plan_tier: NewTierKey; channel_mode: ChatChannelMode; monthly_price_gbp: number } | null;
  voice: { plan_tier: NewTierKey; monthly_price_gbp: number; monthly_call_allowance: number; included_agents: number } | null;
  setupGbp: number;
}

export function buildProvisioningRows(args: {
  data: CreateTenantData;
  discountPercent: number;
  bypass: boolean;
}): ProvisioningRows {
  const { data, discountPercent, bypass } = args;
  const resolved = resolveNewModelPricing({
    model: data.commercial_model,
    chatTier: data.chat_tier ?? null,
    chatMode: data.chat_channel_mode ?? null,
    voiceTier: data.voice_tier ?? null,
  });

  // Full Throttle chat: use the admin override.
  const chatBase =
    data.chat_tier === "full_throttle" ? data.chat_price_override ?? 0 : resolved.chatGbp;

  const priced = (base: number | null): number | null =>
    base === null ? null : bypass ? 0 : applyDiscount(base, discountPercent);

  const hasChat = data.commercial_model === "chat" || data.commercial_model === "double_decker";
  const hasVoice = data.commercial_model === "voice" || data.commercial_model === "double_decker";

  return {
    tenant: {
      name: data.name, slug: data.slug, country: data.country, currency: "GBP",
      plan_band: null, commercial_model: data.commercial_model,
      dispatch_adapter: data.dispatch_adapter, dispatch_company_id: data.dispatch_company_id ?? null,
      contact_email: data.contact_email, coupon_code: data.coupon_code ?? null,
      discount_percent: discountPercent, billing_bypass: bypass,
      status: bypass ? "active" : "onboarding",
    },
    chat: hasChat && data.chat_tier && data.chat_channel_mode
      ? { plan_tier: data.chat_tier, channel_mode: data.chat_channel_mode, monthly_price_gbp: priced(chatBase) ?? 0 }
      : null,
    voice: hasVoice && data.voice_tier
      ? {
          plan_tier: data.voice_tier,
          monthly_price_gbp: priced(resolved.voiceGbp) ?? 0,
          monthly_call_allowance: resolved.voiceAllowance ?? 0,
          included_agents: resolved.voiceAgents ?? 0,
        }
      : null,
    setupGbp: bypass ? 0 : applyDiscount(resolved.setupGbp, discountPercent),
  };
}
```

- [ ] **Step 4: Wire `buildProvisioningRows` into `createTenant`'s side effects**

Replace the body of `createTenant` (after coupon validation, which stays) so it: parses with `createTenantSchema`, validates the coupon (existing), computes `bypass = discountPercent === 100`, calls `buildProvisioningRows`, then inserts:
- `tenants` row from `rows.tenant` (`.select("id").single()`), with the existing duplicate-slug error handling.
- when `rows.chat`: `serviceClient.from("chat_subscriptions").insert({ tenant_id, ...rows.chat })`.
- when `rows.voice`: `serviceClient.from("voice_subscriptions").insert({ tenant_id, ...rows.voice })`.
- a `setup_fees` row (`amount: rows.setupGbp`, `currency: 'GBP'`, `paid_at: bypass ? now : null`).
- when `bypass`: comp subscriptions — for each of chat/voice present, set their row's `status='active'`, `stripe_subscription_id = 'comp_<tenantId>_<product>'`, `current_period_start=now`, `current_period_end = now + 1 month`. (Use the existing date helper or `new Date` + setMonth.)
- coupon redemption (existing `redeemCoupon`) + audit (`tenant.create`, metadata now includes `commercial_model`, `chat_tier`, `voice_tier`).
- `redirect(\`/admin/tenants/${tenantId}\`)`.

Show the full rewritten `createTenant` body in your implementation; keep the service-role client, the coupon block, and the audit/redirect intact.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/admin-provisioning-action.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` → fix any unused legacy imports.

```bash
git add src/app/admin/tenants/actions.ts tests/admin-provisioning-action.test.ts
git commit -m "feat(admin): new-model tenant provisioning action"
```

---

### Task 3: Rebuild the provisioning form

**Files:**
- Modify: `src/app/admin/tenants/new/tenant-form.tsx`

> The form is a client component using `useActionState(createTenant, ...)` (or the repo's existing pattern — read it first). Replace the `plan_band` / `monthly_price` / `setup_fee` / `currency` fields with the new-model selection, and show computed prices live.

- [ ] **Step 1: Read the current form**

Read `src/app/admin/tenants/new/tenant-form.tsx` to match its state/error-rendering conventions and the `createTenant` action binding.

- [ ] **Step 2: Replace the commercial fields**

Implement these fields (keep name/slug/country/contact_email/dispatch fields as-is):
- `commercial_model` select (Chat / Voice / Double Decker).
- `chat_tier` + `chat_channel_mode` selects — shown when model includes chat.
- `voice_tier` select — shown when model includes voice.
- A read-only **price summary** computed client-side via `resolveNewModelPricing` (import it — it's a pure function, safe in a client component): shows chat £/mo, voice £/mo, setup £, and "billed in GBP". For `chat_tier='full_throttle'`, render an editable `chat_price_override` number input instead of the read-only chat price.
- `coupon_code` optional input (unchanged).

Use local `useState` for the selection to drive the live summary; the actual submit still posts the FormData fields to `createTenant`.

Show the complete component in your implementation. Match the existing form's label/error markup.

- [ ] **Step 3: Verify build + manual check**

Run: `npx tsc --noEmit` (clean) and `npm run lint` (clean).
Run: `npm run dev`, open `/admin/tenants/new`, confirm: selecting Double Decker / In Motion / bundle / In Motion shows chat £1,600 + voice £1,599 + setup £2,000; switching chat tier to Full Throttle reveals an editable price field.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/tenants/new/tenant-form.tsx"
git commit -m "feat(admin): new-model provisioning form with live GBP pricing"
```

---

## Self-Review

**Spec coverage:** auto-computed pricing + Full Throttle override (Task 1 `resolveNewModelPricing`, Task 3 form); writes commercial_model + chat/voice rows + setup_fees, status onboarding (Task 2 `buildProvisioningRows` + inserts); coupon discount + 100% bypass comp (Task 2); GBP forced (Task 2 tenant.currency); `VOICE_PLAN_SPEC`/`setupFeeGbp` values (Task 1 tests). ✓

**Placeholder scan:** Steps 4 of Task 2 and Step 2 of Task 3 describe inserts/markup the engineer must write out in full — they are integration glue around tested pure functions (`buildProvisioningRows`, `resolveNewModelPricing`), with the exact insert fields and form fields enumerated. No vague "handle errors". ✓

**Type consistency:** `resolveNewModelPricing`/`NewModelSelection`/`ResolvedNewModelPricing`, `setupFeeGbp`, `VOICE_PLAN_SPEC`, `buildProvisioningRows`/`ProvisioningRows`/`CreateTenantData`, and `CommercialModel`/`NewTierKey`/`ChatChannelMode` (from B1) are used consistently across tasks and tests. ✓
