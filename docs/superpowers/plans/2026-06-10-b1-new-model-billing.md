# B1 — New-Model Billing Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the billing/provisioning schema and GBP charge figures for the new Chat / AI Voice / Double Decker model — additively, alongside the grandfathered legacy `plan_band` model.

**Architecture:** One additive migration (`0040`) adds `chat_subscriptions` (mirroring R1's `voice_subscriptions`), gives `voice_subscriptions` a `monthly_price_gbp`, marks the bundle via `tenants.commercial_model`, and makes `tenants.plan_band` nullable. A new section in `src/lib/billing/pricing.ts` holds the new-model GBP charge figures (chat, voice, authored Double Decker split, setup fees) plus per-product price-resolution helpers. Tests guard that the billing figures never drift from the marketing display figures and that every bundle split sums to its advertised total.

**Tech Stack:** Supabase (PostgreSQL 17) SQL migrations, Supabase CLI, Vitest + `pg` (`tests/helpers/db.ts`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-10-b1-new-model-billing-design.md`

---

## Prerequisites

B1 depends on two earlier pieces. **Do not start until both are true:**

1. **R1 schema applied** (`0035`–`0039`) — `voice_subscriptions` must exist (Task 1 alters it). Run R1's plan first.
2. **Marketing new-model exports present** — `src/lib/marketing/pricing.ts` exports `CHAT_TIERS`, `VOICE_TIERS`, `BUNDLE_TIERS` (i.e. the marketing pricing plan's Task 1 has been (re)applied). Task 3's drift-guard imports them. (B0 reverted that change, so it must be re-applied before Task 3 runs.)

Local stack must be running (`npx supabase start`). After the migration, re-apply with `npx supabase db reset`.

> **Conventions (already in the repo):** static migration test = `readFileSync` + regex (`tests/invoicing-migration.test.ts`); live test = `withPostgres`/`asUser` from `tests/helpers/db.ts` (`tests/rls.test.ts`); tenant SELECT policies use `tenant_id in (select public.current_user_tenants())`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/0040_new_model_billing.sql` | `chat_subscriptions` + RLS; ALTER `voice_subscriptions`; ALTER `tenants` | Create |
| `src/lib/billing/pricing.ts` | Add new-model GBP charge figures + price-resolution helpers | Modify (append section) |
| `tests/new-model-billing-migration.test.ts` | Static structure assertions for `0040` | Create |
| `tests/b1-billing-rls.test.ts` | Live RLS + column behaviour for the new schema | Create |
| `tests/billing-new-model.test.ts` | Figures + helpers + bundle-split-sums (self-contained) | Create |
| `tests/billing-pricing-drift.test.ts` | Drift guard: billing GBP == marketing canonical GBP | Create |
| the repo's generated Supabase types file | Regenerated types | Modify (Task 5 confirms path) |

---

### Task 1: Migration 0040 — new-model billing schema

**Files:**
- Create: `supabase/migrations/0040_new_model_billing.sql`
- Create: `tests/new-model-billing-migration.test.ts`

- [ ] **Step 1: Write the failing static test**

Create `tests/new-model-billing-migration.test.ts`:

```ts
// tests/new-model-billing-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0040_new_model_billing.sql"),
  "utf8",
);

describe("0040 new-model billing migration", () => {
  it("creates chat_subscriptions mirroring voice_subscriptions", () => {
    expect(sql).toMatch(/create table public\.chat_subscriptions/i);
    expect(sql).toMatch(/plan_tier .*check .*ignition.*in_motion.*full_throttle/i);
    expect(sql).toMatch(/channel_mode .*check .*single.*bundle/i);
    expect(sql).toMatch(/monthly_price_gbp numeric\(10,2\) not null/i);
    expect(sql).toMatch(/stripe_subscription_id text/i);
  });
  it("adds monthly_price_gbp to voice_subscriptions (nullable)", () => {
    expect(sql).toMatch(/alter table public\.voice_subscriptions\s+add column monthly_price_gbp numeric\(10,2\)/i);
  });
  it("adds tenants.commercial_model and makes plan_band nullable", () => {
    expect(sql).toMatch(/alter table public\.tenants\s+add column commercial_model text .*check .*chat.*voice.*double_decker/i);
    expect(sql).toMatch(/alter table public\.tenants alter column plan_band drop not null/i);
  });
  it("enables RLS + a tenant select policy on chat_subscriptions", () => {
    expect(sql).toMatch(/alter table public\.chat_subscriptions enable row level security/i);
    expect(sql).toMatch(/chat_subscriptions_select[\s\S]*current_user_tenants\(\)/i);
  });
  it("does not UPDATE existing tenant rows (additive only)", () => {
    expect(sql).not.toMatch(/update public\.tenants set/i);
  });
});
```

- [ ] **Step 2: Run the static test to verify it fails**

Run: `npm test -- tests/new-model-billing-migration.test.ts`
Expected: FAIL — `ENOENT` (file missing).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0040_new_model_billing.sql`:

```sql
-- 0040: New-model billing (Chat / Voice / Double Decker), GBP, rolling-monthly.
--
-- Additive + coexists with the legacy plan_band model: existing tenants are
-- grandfathered (plan_band kept, commercial_model null). New tenants set
-- commercial_model and get chat_subscriptions / voice_subscriptions rows.
-- All new-model charges are in GBP. Bundle = two subscriptions whose
-- monthly_price_gbp components are authored to sum to the advertised total.

-- Chat subscription: operational config + the GBP charge amount.
create table public.chat_subscriptions (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  plan_tier              text not null check (plan_tier in ('ignition','in_motion','full_throttle')),
  channel_mode           text not null check (channel_mode in ('single','bundle')),
  monthly_price_gbp      numeric(10,2) not null check (monthly_price_gbp >= 0),
  status                 text not null default 'active' check (status in ('active','paused','cancelled')),
  current_period_start   date,
  current_period_end     date,
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.chat_subscriptions enable row level security;
create policy chat_subscriptions_select on public.chat_subscriptions
  for select using (tenant_id in (select public.current_user_tenants()));
-- Writes via service_role (provisioning/billing); no tenant write policy.

-- Voice subscription gains its GBP charge amount (R1 had allowance, not price).
alter table public.voice_subscriptions
  add column monthly_price_gbp numeric(10,2) check (monthly_price_gbp is null or monthly_price_gbp >= 0);

-- Tenant commercial model marker; legacy tenants stay null.
alter table public.tenants
  add column commercial_model text check (commercial_model in ('chat','voice','double_decker'));

-- Legacy plan_band no longer mandatory (new tenants leave it null).
alter table public.tenants alter column plan_band drop not null;
```

- [ ] **Step 4: Run the static test + apply the migration**

Run: `npm test -- tests/new-model-billing-migration.test.ts` → Expected: PASS.
Run: `npx supabase db reset` → Expected: migrations 0001→0040 apply cleanly.

- [ ] **Step 5: Write the live behaviour test**

Create `tests/b1-billing-rls.test.ts`:

```ts
// tests/b1-billing-rls.test.ts
// Live RLS + column behaviour for 0040 new-model billing schema.
// Requires the local Supabase stack with migrations through 0040 applied.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withPostgres, asUser } from "./helpers/db";

const TENANT_A = "f1111111-1111-1111-1111-111111111111";
const TENANT_B = "f2222222-2222-2222-2222-222222222222";
const USER_A = "f1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "f2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

beforeAll(async () => {
  await withPostgres(async (c) => {
    await c.query("begin");
    for (const [id, email] of [
      [USER_A, "b1-owner-a@acme-cabs.com"],
      [USER_B, "b1-owner-b@other-cabs.com"],
    ] as const) {
      await c.query(
        `insert into auth.users (instance_id, id, aud, role, email)
         values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2)
         on conflict (id) do nothing`,
        [id, email],
      );
      await c.query(
        `insert into public.users (id, email) values ($1, $2) on conflict (id) do nothing`,
        [id, email],
      );
    }
    // New-model tenant A: plan_band NULL + commercial_model set (proves both alters).
    await c.query(
      `insert into public.tenants (id, name, slug, country, plan_band, currency, commercial_model)
       values ($1, 'B1 Acme Cabs', 'b1-acme-cabs', 'GB', null, 'GBP', 'double_decker')
       on conflict (id) do nothing`,
      [TENANT_A],
    );
    // Legacy-style tenant B: plan_band set, commercial_model null.
    await c.query(
      `insert into public.tenants (id, name, slug, country, plan_band, currency)
       values ($1, 'B1 Other Cabs', 'b1-other-cabs', 'GB', 'A-Single', 'GBP')
       on conflict (id) do nothing`,
      [TENANT_B],
    );
    await c.query(
      `insert into public.tenant_users (tenant_id, user_id, role) values
        ($1,$2,'Owner'), ($3,$4,'Owner') on conflict do nothing`,
      [TENANT_A, USER_A, TENANT_B, USER_B],
    );
    // Chat subscription for tenant A (the chat component of its bundle).
    await c.query(
      `insert into public.chat_subscriptions
        (tenant_id, plan_tier, channel_mode, monthly_price_gbp)
       values ($1, 'ignition', 'single', 400) on conflict (tenant_id) do nothing`,
      [TENANT_A],
    );
    await c.query("commit");
  });
});

afterAll(async () => {
  await withPostgres(async (c) => {
    await c.query("delete from public.chat_subscriptions where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.tenant_users where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.tenants where id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.users where id in ($1,$2)", [USER_A, USER_B]);
    await c.query("delete from auth.users where id in ($1,$2)", [USER_A, USER_B]);
  });
});

describe("0040 new-model billing — columns + RLS", () => {
  it("accepts a tenant with null plan_band + commercial_model set", async () => {
    await withPostgres(async (c) => {
      const r = await c.query(
        "select plan_band, commercial_model from public.tenants where id = $1",
        [TENANT_A],
      );
      expect(r.rows[0].plan_band).toBeNull();
      expect(r.rows[0].commercial_model).toBe("double_decker");
    });
  });

  it("legacy tenant keeps plan_band with null commercial_model", async () => {
    await withPostgres(async (c) => {
      const r = await c.query(
        "select plan_band, commercial_model from public.tenants where id = $1",
        [TENANT_B],
      );
      expect(r.rows[0].plan_band).toBe("A-Single");
      expect(r.rows[0].commercial_model).toBeNull();
    });
  });

  it("tenant A owner sees its chat subscription; tenant B does not", async () => {
    await asUser(USER_A, async (q) => {
      const rows = await q("select tenant_id, monthly_price_gbp from public.chat_subscriptions");
      expect(rows.map((r) => r.tenant_id)).toContain(TENANT_A);
    });
    await asUser(USER_B, async (q) => {
      const rows = await q("select tenant_id from public.chat_subscriptions");
      expect(rows.map((r) => r.tenant_id)).not.toContain(TENANT_A);
    });
  });
});
```

- [ ] **Step 6: Run the live test to verify it passes**

Run: `npm test -- tests/b1-billing-rls.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0040_new_model_billing.sql tests/new-model-billing-migration.test.ts tests/b1-billing-rls.test.ts
git commit -m "feat(db): 0040 new-model billing — chat_subscriptions, commercial_model, nullable plan_band"
```

---

### Task 2: New-model GBP charge figures + price-resolution helpers

**Files:**
- Modify: `src/lib/billing/pricing.ts` (append a new section; keep the existing legacy A/B section untouched)
- Create: `tests/billing-new-model.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/billing-new-model.test.ts`:

```ts
// tests/billing-new-model.test.ts
import { describe, it, expect } from "vitest";
import {
  CHAT_PRICE_GBP,
  VOICE_PRICE_GBP,
  DOUBLE_DECKER_GBP,
  NEW_CHAT_SETUP_GBP,
  NEW_VOICE_SETUP_GBP,
  NEW_BUNDLE_SETUP_GBP,
  chatMonthlyPriceGbp,
  voiceMonthlyPriceGbp,
  type NewTierKey,
  type ChatChannelMode,
} from "@/lib/billing/pricing";

describe("new-model GBP figures", () => {
  it("chat prices", () => {
    expect(CHAT_PRICE_GBP.ignition.single).toBe(499);
    expect(CHAT_PRICE_GBP.ignition.bundle).toBe(899);
    expect(CHAT_PRICE_GBP.in_motion.single).toBe(999);
    expect(CHAT_PRICE_GBP.in_motion.bundle).toBe(1799);
    expect(CHAT_PRICE_GBP.full_throttle.single).toBeNull();
    expect(CHAT_PRICE_GBP.full_throttle.bundle).toBeNull();
  });
  it("voice prices", () => {
    expect(VOICE_PRICE_GBP.ignition).toBe(1199);
    expect(VOICE_PRICE_GBP.in_motion).toBe(1599);
    expect(VOICE_PRICE_GBP.full_throttle).toBe(1999);
  });
  it("setup fees", () => {
    expect(NEW_CHAT_SETUP_GBP).toBe(1000);
    expect(NEW_VOICE_SETUP_GBP).toEqual({ oneAgent: 1000, twoAgents: 1500, secondAgentAddOn: 500 });
    expect(NEW_BUNDLE_SETUP_GBP).toEqual({ oneVoiceAgent: 1500, twoVoiceAgents: 2000 });
  });
});

describe("Double Decker split sums to the advertised total", () => {
  const tiers: NewTierKey[] = ["ignition", "in_motion", "full_throttle"];
  const modes: ChatChannelMode[] = ["single", "bundle"];
  for (const tier of tiers) {
    for (const mode of modes) {
      it(`${tier}/${mode}: chat + voice === total`, () => {
        const s = DOUBLE_DECKER_GBP[tier][mode];
        expect(s.chat + s.voice).toBe(s.total);
      });
    }
  }
  it("matches the spec totals", () => {
    expect(DOUBLE_DECKER_GBP.ignition.single.total).toBe(1599);
    expect(DOUBLE_DECKER_GBP.ignition.bundle.total).toBe(1999);
    expect(DOUBLE_DECKER_GBP.in_motion.single.total).toBe(2499);
    expect(DOUBLE_DECKER_GBP.in_motion.bundle.total).toBe(3199);
    expect(DOUBLE_DECKER_GBP.full_throttle.single.total).toBe(2999);
    expect(DOUBLE_DECKER_GBP.full_throttle.bundle.total).toBe(3799);
  });
});

describe("price-resolution helpers", () => {
  it("chat-only tenant: chat price from standalone, no voice charge", () => {
    expect(chatMonthlyPriceGbp("chat", "in_motion", "bundle")).toBe(1799);
    expect(voiceMonthlyPriceGbp("chat", "in_motion", "bundle")).toBeNull();
  });
  it("voice-only tenant: voice price from standalone, no chat charge", () => {
    expect(voiceMonthlyPriceGbp("voice", "in_motion", "single")).toBe(1599);
    expect(chatMonthlyPriceGbp("voice", "in_motion", "single")).toBeNull();
  });
  it("double_decker tenant: both from the authored split", () => {
    expect(chatMonthlyPriceGbp("double_decker", "in_motion", "bundle")).toBe(1600);
    expect(voiceMonthlyPriceGbp("double_decker", "in_motion", "bundle")).toBe(1599);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/billing-new-model.test.ts`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Append the new-model section to `src/lib/billing/pricing.ts`**

Add to the END of `src/lib/billing/pricing.ts` (do not modify the existing legacy section above it):

```ts

/* ============================================================================
   NEW MODEL (B1): Chat / AI Voice / Double Decker. GBP only, rolling-monthly.

   These are the figures Stripe actually charges. They MUST equal the marketing
   canonical GBP numbers (src/lib/marketing/pricing.ts); the drift-guard test in
   tests/billing-pricing-drift.test.ts enforces that.
   ========================================================================== */

export type NewTierKey = "ignition" | "in_motion" | "full_throttle";
export type ChatChannelMode = "single" | "bundle";
export type CommercialModel = "chat" | "voice" | "double_decker";

/** Chat monthly GBP per tier/mode; null = quoted (Full Throttle). */
export const CHAT_PRICE_GBP: Record<NewTierKey, Record<ChatChannelMode, number | null>> = {
  ignition: { single: 499, bundle: 899 },
  in_motion: { single: 999, bundle: 1799 },
  full_throttle: { single: null, bundle: null },
};

/** Voice monthly GBP per tier. */
export const VOICE_PRICE_GBP: Record<NewTierKey, number> = {
  ignition: 1199,
  in_motion: 1599,
  full_throttle: 1999,
};

/** One authored Double Decker price split: chat + voice === total. */
export interface BundleSplit {
  total: number;
  chat: number;
  voice: number;
}

/**
 * Double Decker GBP, authored so chat + voice === total (no runtime split).
 * Default allocation: voice billed at its standalone price for the bundled call
 * volume; chat absorbs the bundle discount. Confirmed with finance at spec review.
 */
export const DOUBLE_DECKER_GBP: Record<NewTierKey, Record<ChatChannelMode, BundleSplit>> = {
  ignition: {
    single: { total: 1599, chat: 400, voice: 1199 },
    bundle: { total: 1999, chat: 400, voice: 1599 },
  },
  in_motion: {
    single: { total: 2499, chat: 900, voice: 1599 },
    bundle: { total: 3199, chat: 1600, voice: 1599 },
  },
  full_throttle: {
    single: { total: 2999, chat: 1000, voice: 1999 },
    bundle: { total: 3799, chat: 1800, voice: 1999 },
  },
};

/** One-time setup fees (GBP). */
export const NEW_CHAT_SETUP_GBP = 1000;
export const NEW_VOICE_SETUP_GBP = {
  oneAgent: 1000,
  twoAgents: 1500,
  secondAgentAddOn: 500,
} as const;
export const NEW_BUNDLE_SETUP_GBP = {
  oneVoiceAgent: 1500,
  twoVoiceAgents: 2000,
} as const;

/**
 * The chat subscription's monthly GBP charge for a tenant, or null when the
 * tenant has no chat product (voice-only) or the tier is quoted (Full Throttle).
 */
export function chatMonthlyPriceGbp(
  model: CommercialModel,
  tier: NewTierKey,
  mode: ChatChannelMode,
): number | null {
  if (model === "double_decker") return DOUBLE_DECKER_GBP[tier][mode].chat;
  if (model === "chat") return CHAT_PRICE_GBP[tier][mode];
  return null;
}

/**
 * The voice subscription's monthly GBP charge for a tenant, or null when the
 * tenant has no voice product (chat-only). `mode` only affects double_decker
 * (the bundle total differs by chat mode).
 */
export function voiceMonthlyPriceGbp(
  model: CommercialModel,
  tier: NewTierKey,
  mode: ChatChannelMode,
): number | null {
  if (model === "double_decker") return DOUBLE_DECKER_GBP[tier][mode].voice;
  if (model === "voice") return VOICE_PRICE_GBP[tier];
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/billing-new-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

```bash
git add src/lib/billing/pricing.ts tests/billing-new-model.test.ts
git commit -m "feat(billing): new-model GBP charge figures + price-resolution helpers"
```

---

### Task 3: Drift-guard test (billing GBP == marketing canonical GBP)

**Files:**
- Create: `tests/billing-pricing-drift.test.ts`

> **Prerequisite:** `src/lib/marketing/pricing.ts` must export the new model (`CHAT_TIERS`, `VOICE_TIERS`, `BUNDLE_TIERS`). If the marketing pricing plan's Task 1 has not been re-applied yet, this test will not compile — apply it first (see Prerequisites).

- [ ] **Step 1: Write the drift-guard test**

Create `tests/billing-pricing-drift.test.ts`:

```ts
// tests/billing-pricing-drift.test.ts
// Guards that the GBP figures billing charges never drift from the GBP figures
// marketing advertises. If a price changes in one place, it must change in both.
import { describe, it, expect } from "vitest";
import {
  CHAT_TIERS,
  VOICE_TIERS,
  BUNDLE_TIERS,
  type TierKey,
} from "@/lib/marketing/pricing";
import {
  CHAT_PRICE_GBP,
  VOICE_PRICE_GBP,
  DOUBLE_DECKER_GBP,
} from "@/lib/billing/pricing";

describe("billing GBP figures match marketing canonical GBP", () => {
  it("chat single/bundle per tier", () => {
    for (const t of CHAT_TIERS) {
      const key = t.key as TierKey;
      expect(CHAT_PRICE_GBP[key].single).toBe(t.singleGbp);
      expect(CHAT_PRICE_GBP[key].bundle).toBe(t.bundleGbp);
    }
  });

  it("voice per tier", () => {
    for (const t of VOICE_TIERS) {
      expect(VOICE_PRICE_GBP[t.key as TierKey]).toBe(t.priceGbp);
    }
  });

  it("double decker single/bundle totals", () => {
    for (const t of BUNDLE_TIERS) {
      const key = t.key as TierKey;
      expect(DOUBLE_DECKER_GBP[key].single.total).toBe(t.single.priceGbp);
      expect(DOUBLE_DECKER_GBP[key].bundle.total).toBe(t.bundle.priceGbp);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npm test -- tests/billing-pricing-drift.test.ts`
Expected: PASS. (If it FAILS to import `CHAT_TIERS`, the marketing new-model exports are not present — apply the marketing pricing plan's Task 1 first, then re-run.)

- [ ] **Step 3: Commit**

```bash
git add tests/billing-pricing-drift.test.ts
git commit -m "test(billing): guard new-model GBP figures against marketing drift"
```

---

### Task 4: Regenerate TypeScript types + full verification

**Files:**
- Modify: the repo's generated Supabase types file (confirm exact path in Step 1)

- [ ] **Step 1: Locate the generated types file**

Run: `grep -rl "export type Database" src | head`
Expected: a file such as `src/lib/supabase/database.types.ts`. Note its exact path. If none exists, skip Steps 2–3 and note it in the commit.

- [ ] **Step 2: Regenerate types from the local DB**

Using the path from Step 1 (substitute the real path):

```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

Expected: the file now contains `chat_subscriptions` and `voice_subscriptions.monthly_price_gbp` / `tenants.commercial_model`.

- [ ] **Step 3: Confirm the new schema is present**

Run: `grep -E "chat_subscriptions|commercial_model" src/lib/supabase/database.types.ts`
Expected: matches for both.

- [ ] **Step 4: Full verification gate**

Run each and confirm green:

```bash
npx supabase db reset
npm test -- tests/new-model-billing-migration.test.ts tests/b1-billing-rls.test.ts tests/billing-new-model.test.ts tests/billing-pricing-drift.test.ts
npx tsc --noEmit
npm run lint
```

Expected: migrations apply, the four B1 test files pass, typecheck and lint clean.

> Note: the full `npm test` suite contains pre-existing env/integration failures (live n8n, demo-number, local-DB auth role) unrelated to B1. Verify the four B1 files specifically, plus `tsc`/`lint`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(db): regenerate Supabase types for B1 new-model billing"
```

---

## Self-Review

**Spec coverage (B1 design spec → tasks):**
- `chat_subscriptions` mirror + RLS → Task 1 ✓
- `voice_subscriptions.monthly_price_gbp` ALTER → Task 1 ✓
- `tenants.commercial_model` + `plan_band` nullable → Task 1 ✓ (live test proves both, acceptance #4/#5)
- Additive / no existing-row UPDATE → Task 1 static test (`not.toMatch(/update public\.tenants set/)`) + live legacy-tenant assertion ✓
- New-model GBP figures (chat/voice/DD/setup) + resolution helper (acceptance #6) → Task 2 ✓
- Bundle split sums to total (acceptance #8) → Task 2 ✓
- Drift guard vs marketing (acceptance #7) → Task 3 ✓
- Regenerated TS types (acceptance #9) → Task 4 ✓
- Migration applies cleanly (acceptance #1) → Task 1 Step 4 / Task 4 Step 4 ✓

**Placeholder scan:** No "TBD"/"handle errors"/"similar to". Every SQL, TS, and test block is complete. The generated-types path is the one deliberate variable, resolved in Task 4 Step 1 before use. ✓

**Type/name consistency:** `chat_subscriptions`, `CHAT_PRICE_GBP`, `VOICE_PRICE_GBP`, `DOUBLE_DECKER_GBP`, `BundleSplit`, `NewTierKey`, `ChatChannelMode`, `CommercialModel`, `chatMonthlyPriceGbp`, `voiceMonthlyPriceGbp`, `NEW_CHAT_SETUP_GBP`, `NEW_VOICE_SETUP_GBP`, `NEW_BUNDLE_SETUP_GBP` are used identically across Tasks 2–4 and the tests. Marketing imports (`CHAT_TIERS.key/singleGbp/bundleGbp`, `VOICE_TIERS.key/priceGbp`, `BUNDLE_TIERS.key/single.priceGbp/bundle.priceGbp`) match the marketing data model exactly. ✓

> **Dependencies (intentional):** B1 requires R1 (`voice_subscriptions`) applied and the marketing new-model exports present (Task 3). Both are stated in Prerequisites. Execute Tasks 1→4 in order.
