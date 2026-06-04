# Epic 13: Entitlements & Metering Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the feature-entitlement + usage-metering control plane that every advanced tenant/admin feature gates on — so capabilities can be packaged into plans, overridden per tenant, metered, quota-enforced, and rolled out behind kill-switches.

**Architecture:** Two migrations add a global plan/feature catalog (`plans`, `features`, `plan_features`, `feature_rollouts`), a per-tenant override table (`tenant_entitlements`), and append-only metering (`usage_events` immutable + `usage_counters` rollup). A server-side resolver merges plan → overrides → rollout into an effective entitlement set (short-TTL cached, never in the JWT). A `requireFeature`/`requireQuota` guard mirrors the existing `blockIfDemo` pattern so any route or server action can gate in one line. An admin UI packages plans and sets per-tenant overrides. A seed script populates the canonical feature catalog + default plans.

**Tech Stack:** Supabase Postgres (RLS + immutability triggers, mirroring migrations 0005/0011), TypeScript, Next.js App Router (server components + server actions), Vitest. Entitlements resolved server-side (NOT in JWT) to avoid token bloat/staleness across dozens of flags.

**Why not the JWT:** the `custom_access_token_hook` (0006/0016) already injects `tenant_id`, `role`, `is_flowmo_staff`, `is_demo`. Adding dozens of feature flags would bloat every token and go stale the moment an admin changes a plan. The resolver reads from the DB with a short cache instead.

---

## File Map

### New files — Database
- `supabase/migrations/0017_entitlements.sql` — plans, features, plan_features, tenant_entitlements, feature_rollouts + RLS + `tenants.plan_id`
- `supabase/migrations/0018_usage_metering.sql` — usage_events (append-only), usage_counters + RLS + immutability trigger

### New files — Core library (`src/lib/entitlements/`)
- `src/lib/entitlements/catalog.ts` — canonical `FeatureKey` union + `FEATURE_CATALOG` (pure, no I/O)
- `src/lib/entitlements/merge.ts` — pure `mergeEntitlements(planFeatures, overrides, rollouts, tenantId)` → effective map
- `src/lib/entitlements/resolve.ts` — `resolveEntitlements(tenantId)`, `hasFeature(tenantId, key)`, `getQuota(tenantId, key)` (DB + cache)
- `src/lib/entitlements/meter.ts` — `withinQuota` (pure), `recordUsage`, `getUsage`, `checkQuota` (DB)
- `src/lib/entitlements/guard.ts` — `requireFeature`, `requireQuota` (return 403 `NextResponse | null`, mirror `blockIfDemo`)

### New files — Admin
- `src/lib/admin/entitlements.ts` — service-role read/write for plans, plan_features, tenant_entitlements
- `src/app/admin/plans/page.tsx` — plan packaging viewer/editor
- `src/app/admin/plans/actions.ts` — server actions: setPlanFeature
- `src/app/admin/tenants/[tenantId]/entitlements-section.tsx` — per-tenant override UI (client)
- `src/app/admin/tenants/[tenantId]/entitlement-actions.ts` — server action: setTenantEntitlement

### New files — Seed
- `scripts/seed-entitlements.ts` — upsert feature catalog + default plans + plan_features (idempotent)

### Modified files
- `src/components/admin/admin-shell.tsx` — add "Plans" nav item
- `src/app/admin/tenants/[tenantId]/page.tsx` — render `EntitlementsSection`

### Test files
- `tests/entitlements-migration.test.ts` — 0017/0018 SQL structure (regex, mirrors `dashboard-7b-migration.test.ts`)
- `tests/entitlements-catalog.test.ts` — catalog integrity
- `tests/entitlements-merge.test.ts` — pure merge precedence
- `tests/entitlements-meter.test.ts` — `withinQuota` logic
- `tests/entitlements-guard.test.ts` — `requireFeature`/`requireQuota` 403 behaviour

---

## Task 1: Migration 0017 — entitlement catalog + overrides

**Files:**
- Create: `supabase/migrations/0017_entitlements.sql`
- Test: `tests/entitlements-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/entitlements-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql0017 = readFileSync(
  join(process.cwd(), "supabase/migrations/0017_entitlements.sql"),
  "utf8",
);

describe("0017 entitlements migration", () => {
  it("creates the five catalog/override tables", () => {
    expect(sql0017).toMatch(/create table public\.plans/i);
    expect(sql0017).toMatch(/create table public\.features/i);
    expect(sql0017).toMatch(/create table public\.plan_features/i);
    expect(sql0017).toMatch(/create table public\.tenant_entitlements/i);
    expect(sql0017).toMatch(/create table public\.feature_rollouts/i);
  });

  it("adds tenants.plan_id FK", () => {
    expect(sql0017).toMatch(/alter table public\.tenants\s+add column plan_id uuid references public\.plans/i);
  });

  it("enables RLS on all five tables", () => {
    for (const t of ["plans", "features", "plan_features", "tenant_entitlements", "feature_rollouts"]) {
      expect(sql0017).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    }
  });

  it("scopes tenant_entitlements reads via current_user_tenants()", () => {
    expect(sql0017).toMatch(/tenant_entitlements_select[\s\S]*current_user_tenants\(\)/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/entitlements-migration.test.ts`
Expected: FAIL — `ENOENT` (migration file does not exist yet).

- [ ] **Step 3: Create `supabase/migrations/0017_entitlements.sql`**

```sql
-- 0017: Feature entitlements & plan packaging.
--
-- Control plane for advanced features. A tenant's effective entitlements are
-- resolved server-side as: plan_features (by tenants.plan_id) → overlaid with
-- tenant_entitlements → gated by feature_rollouts (kill-switch/percentage).
-- Resolution lives in src/lib/entitlements, NOT in the JWT (avoids token bloat
-- and staleness when an admin changes a plan).

-- Plan catalog (global; FlowMo-managed). Coexists with the legacy
-- tenants.plan_band string; plan_id is the forward-looking pointer.
create table public.plans (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  name             text not null,
  description      text,
  base_price       numeric(10,2),
  currency         text not null default 'GBP' check (currency in ('GBP','EUR','USD')),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly','annual')),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Feature catalog (global). One row per gateable capability. `key` matches the
-- FeatureKey union in src/lib/entitlements/catalog.ts.
create table public.features (
  key         text primary key,
  name        text not null,
  description text,
  category    text not null,
  metered     boolean not null default false,
  unit        text,
  created_at  timestamptz not null default now()
);

-- Which features each plan includes + default quota.
create table public.plan_features (
  plan_id      uuid not null references public.plans(id) on delete cascade,
  feature_key  text not null references public.features(key) on delete cascade,
  enabled      boolean not null default true,
  quota_limit  bigint,                                   -- null = unlimited
  quota_period text check (quota_period in ('day','month')),
  primary key (plan_id, feature_key)
);

-- Per-tenant overrides (admin-managed). Overlaid on top of the plan.
create table public.tenant_entitlements (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  feature_key  text not null references public.features(key) on delete cascade,
  enabled      boolean not null,
  quota_limit  bigint,
  quota_period text check (quota_period in ('day','month')),
  expires_at   timestamptz,
  set_by       uuid references public.users(id) on delete set null,
  note         text,
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, feature_key)
);

-- Staged rollout / kill-switch (global).
create table public.feature_rollouts (
  feature_key text primary key references public.features(key) on delete cascade,
  strategy    text not null default 'all' check (strategy in ('all','percentage','allowlist','off')),
  percentage  int not null default 100 check (percentage between 0 and 100),
  allowlist   uuid[] not null default '{}',
  kill_switch boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.tenants add column plan_id uuid references public.plans(id);

-- Indexes
create index tenant_entitlements_tenant_idx on public.tenant_entitlements (tenant_id);
create index plan_features_plan_idx on public.plan_features (plan_id);

-- RLS ----------------------------------------------------------------------
alter table public.plans               enable row level security;
alter table public.features            enable row level security;
alter table public.plan_features       enable row level security;
alter table public.tenant_entitlements enable row level security;
alter table public.feature_rollouts    enable row level security;

-- Global catalog tables hold no tenant data; any authenticated user may read
-- (the dashboard shows "your plan includes …"). Writes go through service_role,
-- which bypasses RLS, so no write policy is defined (default-deny for tenants).
create policy plans_select            on public.plans            for select using (true);
create policy features_select         on public.features         for select using (true);
create policy plan_features_select    on public.plan_features    for select using (true);
create policy feature_rollouts_select on public.feature_rollouts for select using (true);

-- A tenant may read its own overrides; only service_role writes.
create policy tenant_entitlements_select on public.tenant_entitlements
  for select using (tenant_id in (select public.current_user_tenants()));
```

- [ ] **Step 4: Apply the migration locally**

Run: `npx supabase db push --local`
Expected: `Applied migration 0017_entitlements.sql` with no errors. (If `supabase` is not running locally, start it with `npx supabase start` first.)

- [ ] **Step 5: Run the migration test — expect pass**

Run: `npx vitest run tests/entitlements-migration.test.ts`
Expected: the 0017 describe block passes (the 0018 file does not exist yet, so a separate file-read at module top would throw — that is added in Task 2; for now this file only reads 0017).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0017_entitlements.sql tests/entitlements-migration.test.ts
git commit -m "feat(entitlements): migration 0017 — plan/feature catalog + tenant overrides"
```

---

## Task 2: Migration 0018 — usage metering (append-only)

**Files:**
- Create: `supabase/migrations/0018_usage_metering.sql`
- Modify: `tests/entitlements-migration.test.ts` (add 0018 block)

- [ ] **Step 1: Add the failing 0018 assertions to the migration test**

Append to `tests/entitlements-migration.test.ts` (after the existing 0017 block; add the file read near the top imports):

```typescript
const sql0018 = readFileSync(
  join(process.cwd(), "supabase/migrations/0018_usage_metering.sql"),
  "utf8",
);

describe("0018 usage metering migration", () => {
  it("creates usage_events and usage_counters", () => {
    expect(sql0018).toMatch(/create table public\.usage_events/i);
    expect(sql0018).toMatch(/create table public\.usage_counters/i);
  });

  it("makes usage_events append-only via a before update/delete trigger", () => {
    expect(sql0018).toMatch(/create trigger usage_events_immutable/i);
    expect(sql0018).toMatch(/before update or delete on public\.usage_events/i);
  });

  it("indexes usage_events on (tenant_id, feature_key, occurred_at)", () => {
    expect(sql0018).toMatch(/on public\.usage_events \(tenant_id, feature_key, occurred_at\)/i);
  });

  it("enables RLS + tenant-scoped select on both tables", () => {
    expect(sql0018).toMatch(/alter table public\.usage_events enable row level security/i);
    expect(sql0018).toMatch(/alter table public\.usage_counters enable row level security/i);
    expect(sql0018).toMatch(/usage_events_select[\s\S]*current_user_tenants\(\)/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/entitlements-migration.test.ts`
Expected: FAIL — `ENOENT` for `0018_usage_metering.sql`.

- [ ] **Step 3: Create `supabase/migrations/0018_usage_metering.sql`**

```sql
-- 0018: Usage metering & quota counters.
--
-- usage_events is the append-only source of truth (one row per metered action);
-- usage_counters is a per-tenant/feature/period rollup for fast quota checks.
-- Mirrors the audit_log immutability approach from 0011.

create table public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  feature_key   text not null references public.features(key) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  quantity      bigint not null default 1,
  unit          text,
  cost_micros   bigint,                                   -- optional cost, millionths of a currency unit
  metadata      jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);
create index usage_events_tenant_feature_idx
  on public.usage_events (tenant_id, feature_key, occurred_at);

create table public.usage_counters (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  feature_key  text not null references public.features(key) on delete cascade,
  period_start date not null,
  period_end   date not null,
  used         bigint not null default 0,
  limit_amount bigint,                                    -- snapshot of quota (null = unlimited)
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, feature_key, period_start)
);

-- RLS ----------------------------------------------------------------------
alter table public.usage_events   enable row level security;
alter table public.usage_counters enable row level security;

create policy usage_events_select on public.usage_events
  for select using (tenant_id in (select public.current_user_tenants()));
create policy usage_counters_select on public.usage_counters
  for select using (tenant_id in (select public.current_user_tenants()));

-- usage_events is append-only: block UPDATE/DELETE for everyone (incl.
-- service_role / table owners — triggers fire regardless of RLS bypass),
-- mirroring 0011's audit_log immutability.
create or replace function public.prevent_usage_events_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'usage_events is append-only; UPDATE/DELETE is not permitted';
end;
$$;

create trigger usage_events_immutable
  before update or delete on public.usage_events
  for each row execute function public.prevent_usage_events_mutation();
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/entitlements-migration.test.ts`
Expected: migration applied; all 0017 + 0018 assertions PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0018_usage_metering.sql tests/entitlements-migration.test.ts
git commit -m "feat(entitlements): migration 0018 — append-only usage metering + counters"
```

---

## Task 3: Feature catalog (pure TypeScript)

The canonical list of gateable features. The `key` strings must match the `features` table rows seeded in Task 8.

**Files:**
- Create: `src/lib/entitlements/catalog.ts`
- Test: `tests/entitlements-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/entitlements-catalog.test.ts
import { describe, it, expect } from "vitest";
import { FEATURE_KEYS, FEATURE_CATALOG, type FeatureKey } from "@/lib/entitlements/catalog";

describe("feature catalog", () => {
  it("every key has a catalog entry whose key matches", () => {
    for (const k of FEATURE_KEYS) {
      expect(FEATURE_CATALOG[k]).toBeDefined();
      expect(FEATURE_CATALOG[k].key).toBe(k);
    }
  });

  it("metered features declare a unit", () => {
    for (const k of FEATURE_KEYS) {
      const f = FEATURE_CATALOG[k];
      if (f.metered) expect(typeof f.unit).toBe("string");
    }
  });

  it("includes the foundational gateable features", () => {
    const keys = FEATURE_KEYS as readonly string[];
    expect(keys).toContain("alerting");
    expect(keys).toContain("ai_copilot");
    expect(keys).toContain("live_takeover");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/entitlements-catalog.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/entitlements/catalog.ts`**

```typescript
// Pure, no I/O. The canonical set of gateable features. Each `key` MUST have a
// matching row in public.features (seeded by scripts/seed-entitlements.ts).
export const FEATURE_KEYS = [
  "live_takeover",
  "alerting",
  "crm",
  "config_versioning",
  "fare_rules",
  "dispatch_retry",
  "conversation_intelligence",
  "account_invoicing",
  "scheduled_reports",
  "white_label",
  "self_serve_channels",
  "benchmarking",
  "custom_roles",
  "api_access",
  "outbound_webhooks",
  "ai_copilot",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureCategory =
  | "operations"
  | "intelligence"
  | "revenue"
  | "platform"
  | "growth";

export interface FeatureDef {
  key: FeatureKey;
  name: string;
  category: FeatureCategory;
  metered: boolean;
  /** Required when `metered` is true. */
  unit?: string;
}

export const FEATURE_CATALOG: Record<FeatureKey, FeatureDef> = {
  live_takeover: { key: "live_takeover", name: "Live ops & human takeover", category: "operations", metered: false },
  alerting: { key: "alerting", name: "Alerting & notifications", category: "operations", metered: true, unit: "notifications" },
  crm: { key: "crm", name: "Customer CRM", category: "operations", metered: false },
  config_versioning: { key: "config_versioning", name: "Bot config versioning", category: "operations", metered: false },
  fare_rules: { key: "fare_rules", name: "Fare & pricing rules", category: "operations", metered: false },
  dispatch_retry: { key: "dispatch_retry", name: "Dispatch retry queue", category: "operations", metered: false },
  conversation_intelligence: { key: "conversation_intelligence", name: "Conversation intelligence", category: "intelligence", metered: true, unit: "tokens" },
  account_invoicing: { key: "account_invoicing", name: "Account-customer invoicing", category: "revenue", metered: false },
  scheduled_reports: { key: "scheduled_reports", name: "Scheduled reports", category: "revenue", metered: true, unit: "reports" },
  white_label: { key: "white_label", name: "White-label branding", category: "revenue", metered: false },
  self_serve_channels: { key: "self_serve_channels", name: "Self-serve channels", category: "growth", metered: false },
  benchmarking: { key: "benchmarking", name: "Network benchmarking", category: "growth", metered: false },
  custom_roles: { key: "custom_roles", name: "Custom roles & permissions", category: "platform", metered: false },
  api_access: { key: "api_access", name: "API access", category: "platform", metered: true, unit: "calls" },
  outbound_webhooks: { key: "outbound_webhooks", name: "Outbound webhooks", category: "platform", metered: false },
  ai_copilot: { key: "ai_copilot", name: "AI copilot", category: "intelligence", metered: true, unit: "tokens" },
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/entitlements-catalog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/entitlements/catalog.ts tests/entitlements-catalog.test.ts
git commit -m "feat(entitlements): canonical feature catalog"
```

---

## Task 4: Pure entitlement merge

Precedence: plan default → tenant override (wins) → rollout kill-switch/off (forces disabled). An expired override is ignored.

**Files:**
- Create: `src/lib/entitlements/merge.ts`
- Test: `tests/entitlements-merge.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/entitlements-merge.test.ts
import { describe, it, expect } from "vitest";
import { mergeEntitlements, type Effective } from "@/lib/entitlements/merge";

const NOW = new Date("2026-06-03T00:00:00Z");

describe("mergeEntitlements", () => {
  it("uses the plan default when there is no override", () => {
    const eff = mergeEntitlements({
      planFeatures: [{ feature_key: "alerting", enabled: true, quota_limit: 100, quota_period: "month" }],
      overrides: [],
      rollouts: [],
      tenantId: "t1",
      now: NOW,
    });
    expect(eff.get("alerting")).toEqual<Effective>({ enabled: true, quotaLimit: 100, quotaPeriod: "month" });
  });

  it("override wins over the plan default", () => {
    const eff = mergeEntitlements({
      planFeatures: [{ feature_key: "alerting", enabled: false, quota_limit: null, quota_period: null }],
      overrides: [{ feature_key: "alerting", enabled: true, quota_limit: 500, quota_period: "month", expires_at: null }],
      rollouts: [],
      tenantId: "t1",
      now: NOW,
    });
    expect(eff.get("alerting")?.enabled).toBe(true);
    expect(eff.get("alerting")?.quotaLimit).toBe(500);
  });

  it("ignores an expired override", () => {
    const eff = mergeEntitlements({
      planFeatures: [{ feature_key: "alerting", enabled: false, quota_limit: null, quota_period: null }],
      overrides: [{ feature_key: "alerting", enabled: true, quota_limit: 500, quota_period: "month", expires_at: "2026-06-01T00:00:00Z" }],
      rollouts: [],
      tenantId: "t1",
      now: NOW,
    });
    expect(eff.get("alerting")?.enabled).toBe(false);
  });

  it("a kill-switch / off rollout forces the feature disabled regardless of plan/override", () => {
    const eff = mergeEntitlements({
      planFeatures: [{ feature_key: "ai_copilot", enabled: true, quota_limit: null, quota_period: null }],
      overrides: [{ feature_key: "ai_copilot", enabled: true, quota_limit: null, quota_period: null, expires_at: null }],
      rollouts: [{ feature_key: "ai_copilot", strategy: "off", percentage: 100, allowlist: [], kill_switch: false }],
      tenantId: "t1",
      now: NOW,
    });
    expect(eff.get("ai_copilot")?.enabled).toBe(false);
  });

  it("allowlist rollout enables only listed tenants", () => {
    const base = {
      planFeatures: [{ feature_key: "ai_copilot", enabled: true, quota_limit: null, quota_period: null }],
      overrides: [],
      rollouts: [{ feature_key: "ai_copilot", strategy: "allowlist", percentage: 100, allowlist: ["t-allowed"], kill_switch: false }],
      now: NOW,
    } as const;
    expect(mergeEntitlements({ ...base, tenantId: "t-allowed" }).get("ai_copilot")?.enabled).toBe(true);
    expect(mergeEntitlements({ ...base, tenantId: "t-other" }).get("ai_copilot")?.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/entitlements-merge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/entitlements/merge.ts`**

```typescript
import type { FeatureKey } from "./catalog";

export type QuotaPeriod = "day" | "month" | null;

export interface PlanFeatureRow {
  feature_key: string;
  enabled: boolean;
  quota_limit: number | null;
  quota_period: QuotaPeriod;
}

export interface OverrideRow {
  feature_key: string;
  enabled: boolean;
  quota_limit: number | null;
  quota_period: QuotaPeriod;
  expires_at: string | null;
}

export interface RolloutRow {
  feature_key: string;
  strategy: "all" | "percentage" | "allowlist" | "off";
  percentage: number;
  allowlist: string[];
  kill_switch: boolean;
}

export interface Effective {
  enabled: boolean;
  quotaLimit: number | null;
  quotaPeriod: QuotaPeriod;
}

/** Deterministic 0–99 bucket for percentage rollouts (FNV-1a over tenantId+key). */
function bucket(tenantId: string, featureKey: string): number {
  let h = 0x811c9dc5;
  const s = `${tenantId}:${featureKey}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 100;
}

/** Returns true when the rollout permits the feature for this tenant. */
function rolloutAllows(r: RolloutRow | undefined, tenantId: string, featureKey: string): boolean {
  if (!r) return true; // no rollout row = fully on
  if (r.kill_switch || r.strategy === "off") return false;
  if (r.strategy === "all") return true;
  if (r.strategy === "allowlist") return r.allowlist.includes(tenantId);
  if (r.strategy === "percentage") return bucket(tenantId, featureKey) < r.percentage;
  return true;
}

/**
 * Merge plan defaults, tenant overrides, and rollouts into the effective
 * entitlement map. Precedence: rollout(off/kill) > override > plan default.
 */
export function mergeEntitlements(args: {
  planFeatures: PlanFeatureRow[];
  overrides: OverrideRow[];
  rollouts: RolloutRow[];
  tenantId: string;
  now: Date;
}): Map<FeatureKey, Effective> {
  const { planFeatures, overrides, rollouts, tenantId, now } = args;
  const out = new Map<FeatureKey, Effective>();
  const rolloutByKey = new Map(rollouts.map((r) => [r.feature_key, r]));
  const overrideByKey = new Map(
    overrides
      .filter((o) => !o.expires_at || new Date(o.expires_at) > now)
      .map((o) => [o.feature_key, o]),
  );

  for (const pf of planFeatures) {
    const ov = overrideByKey.get(pf.feature_key);
    const base = ov ?? pf;
    const allowed = rolloutAllows(rolloutByKey.get(pf.feature_key), tenantId, pf.feature_key);
    out.set(pf.feature_key as FeatureKey, {
      enabled: allowed && base.enabled,
      quotaLimit: base.quota_limit,
      quotaPeriod: base.quota_period,
    });
  }

  // Overrides may enable a feature the plan doesn't list at all.
  for (const ov of overrideByKey.values()) {
    if (out.has(ov.feature_key as FeatureKey)) continue;
    const allowed = rolloutAllows(rolloutByKey.get(ov.feature_key), tenantId, ov.feature_key);
    out.set(ov.feature_key as FeatureKey, {
      enabled: allowed && ov.enabled,
      quotaLimit: ov.quota_limit,
      quotaPeriod: ov.quota_period,
    });
  }

  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/entitlements-merge.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/entitlements/merge.ts tests/entitlements-merge.test.ts
git commit -m "feat(entitlements): pure merge — plan → override → rollout precedence"
```

---

## Task 5: Resolver (DB + cache)

**Files:**
- Create: `src/lib/entitlements/resolve.ts`

- [ ] **Step 1: Create `src/lib/entitlements/resolve.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { FeatureKey } from "./catalog";
import {
  mergeEntitlements,
  type Effective,
  type PlanFeatureRow,
  type OverrideRow,
  type RolloutRow,
} from "./merge";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// Short-TTL in-process cache. Entitlements change rarely (admin action); a few
// seconds of staleness is acceptable and spares a 3-query round-trip per request.
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; map: Map<FeatureKey, Effective> }>();

/** Clears the resolver cache (call after an admin entitlement write). */
export function invalidateEntitlements(tenantId?: string): void {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

/** Resolves the effective entitlement map for a tenant (cached). */
export async function resolveEntitlements(tenantId: string): Promise<Map<FeatureKey, Effective>> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.map;

  const sb = svc();
  const { data: tenant } = await sb.from("tenants").select("plan_id").eq("id", tenantId).maybeSingle();
  const planId = (tenant?.plan_id as string | null) ?? null;

  const [planFeatures, overrides, rollouts] = await Promise.all([
    planId
      ? sb.from("plan_features").select("feature_key, enabled, quota_limit, quota_period").eq("plan_id", planId)
      : Promise.resolve({ data: [] as PlanFeatureRow[] }),
    sb.from("tenant_entitlements")
      .select("feature_key, enabled, quota_limit, quota_period, expires_at")
      .eq("tenant_id", tenantId),
    sb.from("feature_rollouts").select("feature_key, strategy, percentage, allowlist, kill_switch"),
  ]);

  const map = mergeEntitlements({
    planFeatures: (planFeatures.data ?? []) as PlanFeatureRow[],
    overrides: (overrides.data ?? []) as OverrideRow[],
    rollouts: (rollouts.data ?? []) as RolloutRow[],
    tenantId,
    now: new Date(),
  });

  cache.set(tenantId, { at: Date.now(), map });
  return map;
}

/** True when the tenant currently has the feature enabled. */
export async function hasFeature(tenantId: string | null, key: FeatureKey): Promise<boolean> {
  if (!tenantId) return false;
  const map = await resolveEntitlements(tenantId);
  return map.get(key)?.enabled === true;
}

/** Returns the effective quota for a feature, or null when unlimited/absent. */
export async function getQuota(
  tenantId: string,
  key: FeatureKey,
): Promise<{ limit: number | null; period: "day" | "month" | null }> {
  const map = await resolveEntitlements(tenantId);
  const e = map.get(key);
  return { limit: e?.quotaLimit ?? null, period: e?.quotaPeriod ?? null };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/entitlements/resolve.ts
git commit -m "feat(entitlements): resolver with short-TTL cache + hasFeature/getQuota"
```

---

## Task 6: Metering service + pure quota check

**Files:**
- Create: `src/lib/entitlements/meter.ts`
- Test: `tests/entitlements-meter.test.ts`

- [ ] **Step 1: Write the failing test (pure `withinQuota` + period boundaries)**

```typescript
// tests/entitlements-meter.test.ts
import { describe, it, expect } from "vitest";
import { withinQuota, periodBounds } from "@/lib/entitlements/meter";

describe("withinQuota", () => {
  it("allows when under an explicit limit", () => {
    expect(withinQuota(5, 10)).toBe(true);
  });
  it("blocks when at or over the limit", () => {
    expect(withinQuota(10, 10)).toBe(false);
    expect(withinQuota(11, 10)).toBe(false);
  });
  it("always allows when the limit is null (unlimited)", () => {
    expect(withinQuota(9_999_999, null)).toBe(true);
  });
});

describe("periodBounds", () => {
  it("month period spans the calendar month", () => {
    const { start, end } = periodBounds("month", new Date("2026-06-15T12:00:00Z"));
    expect(start).toBe("2026-06-01");
    expect(end).toBe("2026-06-30");
  });
  it("day period is a single day", () => {
    const { start, end } = periodBounds("day", new Date("2026-06-15T12:00:00Z"));
    expect(start).toBe("2026-06-15");
    expect(end).toBe("2026-06-15");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/entitlements-meter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/entitlements/meter.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { FeatureKey } from "./catalog";
import { getQuota } from "./resolve";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Pure: is `used` strictly under `limit`? null limit = unlimited. */
export function withinQuota(used: number, limit: number | null): boolean {
  if (limit === null) return true;
  return used < limit;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Pure: the [start, end] calendar period (YYYY-MM-DD) containing `at`. */
export function periodBounds(
  period: "day" | "month",
  at: Date,
): { start: string; end: string } {
  if (period === "day") {
    const s = iso(at);
    return { start: s, end: s };
  }
  const start = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const end = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0));
  return { start: iso(start), end: iso(end) };
}

/**
 * Record a metered action: append to usage_events and bump usage_counters for
 * the current period. Best-effort; never throws into the caller's hot path.
 */
export async function recordUsage(args: {
  tenantId: string;
  featureKey: FeatureKey;
  quantity?: number;
  automationId?: string;
  unit?: string;
  costMicros?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { tenantId, featureKey, quantity = 1, automationId, unit, costMicros, metadata } = args;
  const sb = svc();
  await sb.from("usage_events").insert({
    tenant_id: tenantId,
    feature_key: featureKey,
    automation_id: automationId ?? null,
    quantity,
    unit: unit ?? null,
    cost_micros: costMicros ?? null,
    metadata: metadata ?? {},
  });

  const { period } = await getQuota(tenantId, featureKey);
  const p = period ?? "month";
  const { start, end } = periodBounds(p, new Date());
  // Upsert + increment via RPC-free read-modify-write (counters are low-contention
  // per tenant/feature/period; a race at worst under-counts by a small amount,
  // which usage_events remains the source of truth to reconcile).
  const { data: existing } = await sb
    .from("usage_counters")
    .select("used")
    .eq("tenant_id", tenantId)
    .eq("feature_key", featureKey)
    .eq("period_start", start)
    .maybeSingle();
  const used = ((existing?.used as number) ?? 0) + quantity;
  await sb.from("usage_counters").upsert(
    { tenant_id: tenantId, feature_key: featureKey, period_start: start, period_end: end, used, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,feature_key,period_start" },
  );
}

/** Current period usage for a feature. */
export async function getUsage(tenantId: string, featureKey: FeatureKey): Promise<number> {
  const { period } = await getQuota(tenantId, featureKey);
  const { start } = periodBounds(period ?? "month", new Date());
  const { data } = await svc()
    .from("usage_counters")
    .select("used")
    .eq("tenant_id", tenantId)
    .eq("feature_key", featureKey)
    .eq("period_start", start)
    .maybeSingle();
  return (data?.used as number) ?? 0;
}

/** Quota check: { allowed, used, limit }. */
export async function checkQuota(
  tenantId: string,
  featureKey: FeatureKey,
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const { limit } = await getQuota(tenantId, featureKey);
  const used = await getUsage(tenantId, featureKey);
  return { allowed: withinQuota(used, limit), used, limit };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/entitlements-meter.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/entitlements/meter.ts tests/entitlements-meter.test.ts
git commit -m "feat(entitlements): metering service + pure withinQuota/periodBounds"
```

---

## Task 7: `requireFeature` / `requireQuota` guard

Mirrors `src/lib/demo/session.ts` `blockIfDemo`: returns a 403 `NextResponse` or `null`.

**Files:**
- Create: `src/lib/entitlements/guard.ts`
- Test: `tests/entitlements-guard.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/entitlements-guard.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/entitlements/resolve", () => ({ hasFeature: vi.fn() }));
vi.mock("@/lib/entitlements/meter", () => ({ checkQuota: vi.fn() }));

import { hasFeature } from "@/lib/entitlements/resolve";
import { checkQuota } from "@/lib/entitlements/meter";
import { requireFeature, requireQuota } from "@/lib/entitlements/guard";

describe("requireFeature", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns null when the tenant has the feature", async () => {
    vi.mocked(hasFeature).mockResolvedValue(true);
    expect(await requireFeature("t1", "alerting")).toBeNull();
  });

  it("returns a 403 when the tenant lacks the feature", async () => {
    vi.mocked(hasFeature).mockResolvedValue(false);
    const res = await requireFeature("t1", "alerting");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toMatch(/not available on your plan/i);
    expect(body.feature).toBe("alerting");
  });
});

describe("requireQuota", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns null when the feature is on and under quota", async () => {
    vi.mocked(hasFeature).mockResolvedValue(true);
    vi.mocked(checkQuota).mockResolvedValue({ allowed: true, used: 1, limit: 100 });
    expect(await requireQuota("t1", "alerting")).toBeNull();
  });

  it("returns 429 when over quota", async () => {
    vi.mocked(hasFeature).mockResolvedValue(true);
    vi.mocked(checkQuota).mockResolvedValue({ allowed: false, used: 100, limit: 100 });
    const res = await requireQuota("t1", "alerting");
    expect(res!.status).toBe(429);
  });

  it("returns 403 when the feature is off (checked before quota)", async () => {
    vi.mocked(hasFeature).mockResolvedValue(false);
    const res = await requireQuota("t1", "alerting");
    expect(res!.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/entitlements-guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/entitlements/guard.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import type { FeatureKey } from "./catalog";
import { hasFeature } from "./resolve";
import { checkQuota } from "./meter";

/**
 * Returns a 403 NextResponse when the tenant is NOT entitled to `key`, else null.
 * Mirrors blockIfDemo — call at the top of a mutating route/server action:
 *
 *   const block = await requireFeature(claims.tenant_id, "alerting");
 *   if (block) return block;
 */
export async function requireFeature(
  tenantId: string | null,
  key: FeatureKey,
): Promise<NextResponse | null> {
  if (await hasFeature(tenantId, key)) return null;
  return NextResponse.json(
    { error: "This feature is not available on your plan.", feature: key },
    { status: 403 },
  );
}

/**
 * Like requireFeature, but also enforces the metered quota: 403 if the feature
 * is off, 429 if it is on but over quota, null otherwise.
 */
export async function requireQuota(
  tenantId: string | null,
  key: FeatureKey,
): Promise<NextResponse | null> {
  const featureBlock = await requireFeature(tenantId, key);
  if (featureBlock) return featureBlock;
  const { allowed, used, limit } = await checkQuota(tenantId as string, key);
  if (allowed) return null;
  return NextResponse.json(
    { error: "You have reached your plan limit for this feature.", feature: key, used, limit },
    { status: 429 },
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/entitlements-guard.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/entitlements/guard.ts tests/entitlements-guard.test.ts
git commit -m "feat(entitlements): requireFeature (403) + requireQuota (429) guards"
```

---

## Task 8: Seed the catalog + default plans

**Files:**
- Create: `scripts/seed-entitlements.ts`

- [ ] **Step 1: Create `scripts/seed-entitlements.ts`**

```typescript
#!/usr/bin/env node
/**
 * scripts/seed-entitlements.ts — idempotent.
 *
 * Upserts the feature catalog (from src/lib/entitlements/catalog.ts) into
 * public.features, three default plans (Starter / Pro / Enterprise) into
 * public.plans, and their plan_features mapping. Safe to re-run.
 *
 * Usage: npx tsx scripts/seed-entitlements.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { FEATURE_KEYS, FEATURE_CATALOG, type FeatureKey } from "../src/lib/entitlements/catalog";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const PLANS = [
  { id: "p0000000-0000-0000-0000-000000000001", code: "starter", name: "Starter", base_price: 149 },
  { id: "p0000000-0000-0000-0000-000000000002", code: "pro", name: "Pro", base_price: 349 },
  { id: "p0000000-0000-0000-0000-000000000003", code: "enterprise", name: "Enterprise", base_price: 749 },
];

// Which features each plan includes (+ quota where metered).
const PLAN_FEATURES: Record<string, Partial<Record<FeatureKey, { quota_limit: number | null; quota_period: "day" | "month" | null }>>> = {
  starter: {
    alerting: { quota_limit: 200, quota_period: "month" },
    crm: { quota_limit: null, quota_period: null },
    config_versioning: { quota_limit: null, quota_period: null },
  },
  pro: {
    live_takeover: { quota_limit: null, quota_period: null },
    alerting: { quota_limit: 2000, quota_period: "month" },
    crm: { quota_limit: null, quota_period: null },
    config_versioning: { quota_limit: null, quota_period: null },
    fare_rules: { quota_limit: null, quota_period: null },
    dispatch_retry: { quota_limit: null, quota_period: null },
    conversation_intelligence: { quota_limit: 500_000, quota_period: "month" },
    scheduled_reports: { quota_limit: 50, quota_period: "month" },
    self_serve_channels: { quota_limit: null, quota_period: null },
  },
  enterprise: Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, { quota_limit: null, quota_period: null }]),
  ) as Partial<Record<FeatureKey, { quota_limit: number | null; quota_period: "day" | "month" | null }>>,
};

async function main() {
  console.log("🌱 Seeding entitlements…");

  // 1. Features
  for (const k of FEATURE_KEYS) {
    const f = FEATURE_CATALOG[k];
    const { error } = await sb.from("features").upsert(
      { key: f.key, name: f.name, category: f.category, metered: f.metered, unit: f.unit ?? null },
      { onConflict: "key" },
    );
    if (error) throw new Error(`features upsert ${k}: ${error.message}`);
  }
  console.log(`  ✓ features (${FEATURE_KEYS.length})`);

  // 2. Plans
  for (const p of PLANS) {
    const { error } = await sb.from("plans").upsert(
      { id: p.id, code: p.code, name: p.name, base_price: p.base_price, currency: "GBP", is_active: true },
      { onConflict: "id" },
    );
    if (error) throw new Error(`plans upsert ${p.code}: ${error.message}`);
  }
  console.log(`  ✓ plans (${PLANS.length})`);

  // 3. plan_features
  for (const p of PLANS) {
    const feats = PLAN_FEATURES[p.code] ?? {};
    for (const [fk, q] of Object.entries(feats)) {
      const { error } = await sb.from("plan_features").upsert(
        { plan_id: p.id, feature_key: fk, enabled: true, quota_limit: q!.quota_limit, quota_period: q!.quota_period },
        { onConflict: "plan_id,feature_key" },
      );
      if (error) throw new Error(`plan_features upsert ${p.code}/${fk}: ${error.message}`);
    }
  }
  console.log("  ✓ plan_features");
  console.log("✅ Entitlements seed complete");
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
```

- [ ] **Step 2: Run the seed**

Run: `npx tsx scripts/seed-entitlements.ts`
Expected: `✅ Entitlements seed complete` (features 16, plans 3, plan_features).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-entitlements.ts
git commit -m "feat(entitlements): seed feature catalog + Starter/Pro/Enterprise plans"
```

---

## Task 9: Admin — plan packaging + per-tenant overrides UI

**Files:**
- Create: `src/lib/admin/entitlements.ts`
- Create: `src/app/admin/plans/page.tsx`
- Create: `src/app/admin/plans/actions.ts`
- Create: `src/app/admin/tenants/[tenantId]/entitlements-section.tsx`
- Create: `src/app/admin/tenants/[tenantId]/entitlement-actions.ts`
- Modify: `src/components/admin/admin-shell.tsx` (add "Plans" nav)
- Modify: `src/app/admin/tenants/[tenantId]/page.tsx` (render section)

- [ ] **Step 1: Create `src/lib/admin/entitlements.ts` (service-role read/write)**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { invalidateEntitlements } from "@/lib/entitlements/resolve";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface PlanRow { id: string; code: string; name: string; base_price: number | null }
export interface FeatureRow { key: string; name: string; category: string; metered: boolean; unit: string | null }

export async function listPlans(): Promise<PlanRow[]> {
  const { data } = await svc().from("plans").select("id, code, name, base_price").order("base_price");
  return (data ?? []) as PlanRow[];
}

export async function listFeatures(): Promise<FeatureRow[]> {
  const { data } = await svc().from("features").select("key, name, category, metered, unit").order("category");
  return (data ?? []) as FeatureRow[];
}

export async function listPlanFeatures(planId: string): Promise<{ feature_key: string; enabled: boolean }[]> {
  const { data } = await svc().from("plan_features").select("feature_key, enabled").eq("plan_id", planId);
  return (data ?? []) as { feature_key: string; enabled: boolean }[];
}

export async function setPlanFeature(planId: string, featureKey: string, enabled: boolean): Promise<void> {
  await svc().from("plan_features").upsert(
    { plan_id: planId, feature_key: featureKey, enabled },
    { onConflict: "plan_id,feature_key" },
  );
  invalidateEntitlements(); // plan change affects all tenants on it
}

export async function listTenantEntitlements(tenantId: string): Promise<{ feature_key: string; enabled: boolean }[]> {
  const { data } = await svc().from("tenant_entitlements").select("feature_key, enabled").eq("tenant_id", tenantId);
  return (data ?? []) as { feature_key: string; enabled: boolean }[];
}

export async function setTenantEntitlement(args: {
  tenantId: string;
  featureKey: string;
  enabled: boolean;
  setBy: string;
  note?: string;
}): Promise<void> {
  const { tenantId, featureKey, enabled, setBy, note } = args;
  await svc().from("tenant_entitlements").upsert(
    { tenant_id: tenantId, feature_key: featureKey, enabled, set_by: setBy, note: note ?? null, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,feature_key" },
  );
  invalidateEntitlements(tenantId);
}
```

- [ ] **Step 2: Create `src/app/admin/plans/actions.ts`**

```typescript
"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setPlanFeature } from "@/lib/admin/entitlements";
import { revalidatePath } from "next/cache";

export async function togglePlanFeature(formData: FormData): Promise<void> {
  await requireStaff();
  const planId = String(formData.get("planId"));
  const featureKey = String(formData.get("featureKey"));
  const enabled = String(formData.get("enabled")) === "true";
  await setPlanFeature(planId, featureKey, enabled);
  revalidatePath("/admin/plans");
}
```

- [ ] **Step 3: Create `src/app/admin/plans/page.tsx`**

```tsx
import { requireStaff } from "@/lib/admin/guard";
import { listPlans, listFeatures, listPlanFeatures } from "@/lib/admin/entitlements";
import { togglePlanFeature } from "./actions";

export const metadata = { title: "Plans — Admin" };

export default async function PlansPage() {
  await requireStaff();
  const [plans, features] = await Promise.all([listPlans(), listFeatures()]);
  const planFeatures = await Promise.all(plans.map((p) => listPlanFeatures(p.id)));
  const enabledSet = plans.map((_, i) => new Set(planFeatures[i].filter((f) => f.enabled).map((f) => f.feature_key)));

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Plans &amp; feature packaging</h1>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className="px-3 py-2 text-center font-semibold text-slate-700">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {features.map((f) => (
              <tr key={f.key}>
                <td className="px-3 py-2 text-slate-800">{f.name}{f.metered ? <span className="ml-1 text-[11px] text-amber-600">metered</span> : null}</td>
                {plans.map((p, i) => {
                  const on = enabledSet[i].has(f.key);
                  return (
                    <td key={p.id} className="px-3 py-2 text-center">
                      <form action={togglePlanFeature} className="inline">
                        <input type="hidden" name="planId" value={p.id} />
                        <input type="hidden" name="featureKey" value={f.key} />
                        <input type="hidden" name="enabled" value={(!on).toString()} />
                        <button type="submit" className={on ? "rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700" : "rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-400"}>
                          {on ? "On" : "Off"}
                        </button>
                      </form>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/admin/tenants/[tenantId]/entitlement-actions.ts`**

```typescript
"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setTenantEntitlement } from "@/lib/admin/entitlements";
import { revalidatePath } from "next/cache";

export async function toggleTenantEntitlement(formData: FormData): Promise<void> {
  const claims = await requireStaff();
  const tenantId = String(formData.get("tenantId"));
  const featureKey = String(formData.get("featureKey"));
  const enabled = String(formData.get("enabled")) === "true";
  await setTenantEntitlement({ tenantId, featureKey, enabled, setBy: claims.sub });
  revalidatePath(`/admin/tenants/${tenantId}`);
}
```

- [ ] **Step 5: Create `src/app/admin/tenants/[tenantId]/entitlements-section.tsx`**

```tsx
import { listFeatures, listTenantEntitlements } from "@/lib/admin/entitlements";
import { toggleTenantEntitlement } from "./entitlement-actions";

/** Per-tenant entitlement overrides. Server component; renders a toggle per feature. */
export async function EntitlementsSection({ tenantId }: { tenantId: string }) {
  const [features, overrides] = await Promise.all([listFeatures(), listTenantEntitlements(tenantId)]);
  const overrideMap = new Map(overrides.map((o) => [o.feature_key, o.enabled]));

  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Entitlement overrides</h2>
      <p className="mb-3 text-xs text-slate-500">Overrides win over the tenant&apos;s plan. Unset = inherit plan.</p>
      <ul className="divide-y divide-slate-100">
        {features.map((f) => {
          const ov = overrideMap.get(f.key);
          const label = ov === undefined ? "Inherit" : ov ? "Forced on" : "Forced off";
          return (
            <li key={f.key} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-800">{f.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{label}</span>
                <form action={toggleTenantEntitlement} className="inline">
                  <input type="hidden" name="tenantId" value={tenantId} />
                  <input type="hidden" name="featureKey" value={f.key} />
                  <input type="hidden" name="enabled" value={(ov ? false : true).toString()} />
                  <button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    {ov ? "Disable" : "Enable"}
                  </button>
                </form>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: Add "Plans" to the admin nav**

In `src/components/admin/admin-shell.tsx`, find the nav items array (the entries rendering "Tenants", "Automations", etc.) and add an entry `{ href: "/admin/plans", label: "Plans" }` after "Tenants". Match the exact object shape already used in that array.

- [ ] **Step 7: Render `EntitlementsSection` on the tenant detail page**

In `src/app/admin/tenants/[tenantId]/page.tsx`, add the import `import { EntitlementsSection } from "./entitlements-section";` and render `<EntitlementsSection tenantId={tenantId} />` inside the existing sections grid (next to "Automations" / "Users"). Use the `tenantId` already resolved from `params` in that page.

- [ ] **Step 8: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -5`
Expected: no type errors; build compiles `/admin/plans`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/admin/entitlements.ts \
  src/app/admin/plans/page.tsx src/app/admin/plans/actions.ts \
  "src/app/admin/tenants/[tenantId]/entitlements-section.tsx" \
  "src/app/admin/tenants/[tenantId]/entitlement-actions.ts" \
  src/components/admin/admin-shell.tsx \
  "src/app/admin/tenants/[tenantId]/page.tsx"
git commit -m "feat(admin): plan packaging editor + per-tenant entitlement overrides"
```

---

## Task 10: Integration gate — full suite + typecheck

**Files:** none (verification only)

- [ ] **Step 1: Run the full entitlements test set**

Run: `npx vitest run tests/entitlements-migration.test.ts tests/entitlements-catalog.test.ts tests/entitlements-merge.test.ts tests/entitlements-meter.test.ts tests/entitlements-guard.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full suite (pre-existing live-n8n integration failures expected)**

Run: `npm test`
Expected: all pass except the known `engine-client.integration.test.ts` timeouts (no local n8n).

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(entitlements): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement (from DB design discussion) | Task |
|---|---|
| `plans`, `features`, `plan_features`, `tenant_entitlements`, `feature_rollouts` + `tenants.plan_id` | Task 1 |
| `usage_events` (append-only) + `usage_counters` | Task 2 |
| Canonical feature catalog (typed) | Task 3 |
| Merge precedence plan→override→rollout, percentage/allowlist/kill-switch | Task 4 |
| Server-side resolver (NOT JWT) with cache | Task 5 |
| Metering + quota enforcement | Task 6 |
| One-line gate (`requireFeature`/`requireQuota`) mirroring `blockIfDemo` | Task 7 |
| Seed catalog + default plans | Task 8 |
| Admin packaging UI + per-tenant overrides | Task 9 |
| Green gate | Task 10 |

**Placeholder scan:** none — every step has complete code.

**Type consistency:** `FeatureKey` (catalog) is used by `merge.ts`, `resolve.ts`, `meter.ts`, `guard.ts`. `Effective`/`PlanFeatureRow`/`OverrideRow`/`RolloutRow` defined in `merge.ts` and imported by `resolve.ts`. `invalidateEntitlements` defined in `resolve.ts`, called by `admin/entitlements.ts`. `requireFeature` signature `(string|null, FeatureKey) => Promise<NextResponse|null>` consistent across guard + tests.

**Dependency note:** This epic is the foundation. Subsequent epics (alerting, CRM, AI copilot, …) add `await requireFeature(claims.tenant_id, "<key>")` at the top of their mutating routes and `recordUsage(...)` after metered actions — both already exist after this epic.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-03-epic-13-entitlements-metering.md`.

**10 tasks. Tasks 1–2 (migrations) gate everything; Tasks 3–4 (pure catalog/merge) can be parallelised; Tasks 5–7 depend on 3–4; Task 8 depends on 1+3; Task 9 depends on 1+8; Task 10 last.**
