# Epic 16: Bot Config Control Plane — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single live `automation_config` row into a governed control plane: tenants edit a **draft**, publish it to a **versioned** history (with rollback), bounded by admin-set **guardrails**, plus a **fare-rules** engine that prices journeys. Gated by `config_versioning` and `fare_rules` entitlements.

**Architecture:** Migration 0022 adds `config_versions` (immutable-after-publish snapshots of the config jsonb, with draft/published status), `fare_rules` (per-vehicle pricing), and `config_guardrails` (admin-set locked fields + numeric bounds). The existing `automation_config` (0015) remains the *current live* config the engine reads; publishing a version copies its snapshot into `automation_config` and stamps `synced_to_engine_at`. A pure layer computes fares (`computeFare`) and validates a candidate config against guardrails (`validateConfig`). Tenant API routes (gated by `requireFeature` + `blockIfDemo`) manage drafts/publish/rollback and fare rules; an admin surface sets guardrails (gated by `requireStaff`). Tenant dashboard pages expose version history + a fare-rule editor, shown only when entitled.

**Tech Stack:** Supabase Postgres (RLS), TypeScript, Next.js App Router, Vitest. Builds on Epic 13 (`requireFeature`), Epic 9 (`blockIfDemo`), Epic 7b (`automation_config` from 0015), admin guard (`requireStaff`).

**Dependencies:** Epic 13 (`config_versioning` + `fare_rules` features in catalog), Epic 9 (`blockIfDemo`), Epic 3/7 (`automation_config`, admin shell). Mirrors the established epic structure (migration → pure logic → queries → gated routes → admin + tenant UI).

---

## File Map

### New — Database
- `supabase/migrations/0022_config_control_plane.sql` — `config_versions`, `fare_rules`, `config_guardrails` (+ `automation_config.current_version_id`) + RLS

### New — Core library (`src/lib/config/`)
- `src/lib/config/fare.ts` — pure `computeFare(distanceMiles, durationMin, rule)` + `FareRule` type
- `src/lib/config/guardrails.ts` — pure `validateConfig(candidate, guardrails)` → `{ ok, violations }`
- `src/lib/config/versions.ts` — service: `getLiveConfig`, `createDraft`, `listVersions`, `publishVersion`, `rollbackTo`
- `src/lib/config/fare-queries.ts` — service: `listFareRules`, `upsertFareRule`, `deleteFareRule`
- `src/lib/config/guardrail-queries.ts` — service: `listGuardrails`, `setGuardrail` (admin)

### New — Tenant API
- `src/app/api/orgs/[orgId]/automations/[automationId]/config/versions/route.ts` — GET list, POST create draft
- `src/app/api/orgs/[orgId]/automations/[automationId]/config/versions/[versionId]/route.ts` — POST publish, DELETE (drop draft)
- `src/app/api/orgs/[orgId]/automations/[automationId]/config/rollback/route.ts` — POST rollback to a version
- `src/app/api/orgs/[orgId]/automations/[automationId]/fares/route.ts` — GET list, POST upsert
- `src/app/api/orgs/[orgId]/automations/[automationId]/fares/[ruleId]/route.ts` — DELETE

### New — Admin
- `src/app/admin/guardrails/page.tsx` — list automations + their guardrails
- `src/app/admin/guardrails/actions.ts` — server action `setGuardrailAction` (requireStaff)

### New — Tenant UI
- `src/app/dashboard/automations/[automationId]/versions/page.tsx` — version history + publish/rollback (gated)
- `src/app/dashboard/automations/[automationId]/versions/versions-client.tsx`
- `src/app/dashboard/automations/[automationId]/fares/page.tsx` — fare-rule editor (gated)
- `src/app/dashboard/automations/[automationId]/fares/fares-client.tsx`

### Modified
- `src/components/admin/admin-shell.tsx` — add "Guardrails" nav

### Test files
- `tests/config-migration.test.ts` — 0022 structure
- `tests/config-fare.test.ts` — pure fare computation
- `tests/config-guardrails.test.ts` — pure guardrail validation
- `tests/config-routes.test.ts` — publish route gating (demo + entitlement)

---

## Task 1: Migration 0022 — versions, fares, guardrails

**Files:** Create `supabase/migrations/0022_config_control_plane.sql`; Test `tests/config-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/config-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0022_config_control_plane.sql"), "utf8");

describe("0022 config control plane migration", () => {
  it("creates config_versions, fare_rules, config_guardrails", () => {
    expect(sql).toMatch(/create table public\.config_versions/i);
    expect(sql).toMatch(/create table public\.fare_rules/i);
    expect(sql).toMatch(/create table public\.config_guardrails/i);
  });
  it("config_versions has a status check incl. draft + published", () => {
    expect(sql).toMatch(/status .*check .*draft/i);
    expect(sql).toMatch(/published/i);
  });
  it("adds automation_config.current_version_id", () => {
    expect(sql).toMatch(/alter table public\.automation_config add column current_version_id uuid/i);
  });
  it("enables RLS + tenant policies on config_versions + fare_rules", () => {
    expect(sql).toMatch(/alter table public\.config_versions enable row level security/i);
    expect(sql).toMatch(/alter table public\.fare_rules enable row level security/i);
    expect(sql).toMatch(/config_versions_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/fare_rules_insert/i);
  });
  it("config_guardrails is admin-only (RLS on, no tenant select policy needed) and references automation", () => {
    expect(sql).toMatch(/alter table public\.config_guardrails enable row level security/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/config-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0022_config_control_plane.sql`** (single spaces on lines tests match)

```sql
-- 0022: Bot config control plane — versioning, fare rules, guardrails.
--
-- automation_config (0015) stays the CURRENT LIVE config the engine reads.
-- config_versions are snapshots (draft → published); publishing copies the
-- snapshot into automation_config. fare_rules price journeys per vehicle.
-- config_guardrails are admin-set bounds enforced at publish time.

create table public.config_versions (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  version       integer not null,
  config        jsonb not null,
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  change_note   text,
  created_by    uuid references public.users(id) on delete set null,
  published_by  uuid references public.users(id) on delete set null,
  published_at  timestamptz,
  synced_to_engine_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (automation_id, version)
);
create index config_versions_automation_idx on public.config_versions (automation_id, version);

create table public.fare_rules (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  automation_id    uuid not null references public.automations(id) on delete cascade,
  vehicle_type     text not null,
  base_fare        numeric(10,2) not null default 0,
  per_mile         numeric(10,2) not null default 0,
  per_min          numeric(10,2) not null default 0,
  min_fare         numeric(10,2) not null default 0,
  airport_surcharge numeric(10,2) not null default 0,
  currency         text not null default 'GBP',
  updated_at       timestamptz not null default now(),
  unique (automation_id, vehicle_type)
);
create index fare_rules_automation_idx on public.fare_rules (automation_id);

create table public.config_guardrails (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  field         text not null,
  locked        boolean not null default false,
  min_value     numeric,
  max_value     numeric,
  updated_at    timestamptz not null default now(),
  unique (automation_id, field)
);
create index config_guardrails_automation_idx on public.config_guardrails (automation_id);

alter table public.automation_config add column current_version_id uuid references public.config_versions(id) on delete set null;

-- RLS ----------------------------------------------------------------------
alter table public.config_versions enable row level security;
alter table public.fare_rules enable row level security;
alter table public.config_guardrails enable row level security;

-- config_versions: tenant read + draft writes; publish/archive via service_role.
create policy config_versions_select on public.config_versions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy config_versions_insert on public.config_versions
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy config_versions_update on public.config_versions
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy config_versions_delete on public.config_versions
  for delete using (tenant_id in (select public.current_user_tenants()));

-- fare_rules: tenant-editable config.
create policy fare_rules_select on public.fare_rules
  for select using (tenant_id in (select public.current_user_tenants()));
create policy fare_rules_insert on public.fare_rules
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy fare_rules_update on public.fare_rules
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy fare_rules_delete on public.fare_rules
  for delete using (tenant_id in (select public.current_user_tenants()));

-- config_guardrails: admin-managed (service_role writes). Tenants may READ their
-- own automations' guardrails (UI greys out locked fields).
create policy config_guardrails_select on public.config_guardrails
  for select using (
    exists (
      select 1 from public.automations a
      where a.id = config_guardrails.automation_id
        and a.tenant_id in (select public.current_user_tenants())
    )
  );
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/config-migration.test.ts`
Expected: applied; 5 tests PASS. (If `db push` times out, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0022_config_control_plane.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0022_config_control_plane.sql tests/config-migration.test.ts
git commit -m "feat(config): migration 0022 — config versions, fare rules, guardrails"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure fare computation + guardrail validation

**Files:** Create `src/lib/config/fare.ts`, `src/lib/config/guardrails.ts`; Tests `tests/config-fare.test.ts`, `tests/config-guardrails.test.ts`

- [ ] **Step 1: Write failing fare test**

```typescript
// tests/config-fare.test.ts
import { describe, it, expect } from "vitest";
import { computeFare, type FareRule } from "@/lib/config/fare";

const rule: FareRule = { base_fare: 3, per_mile: 2, per_min: 0.25, min_fare: 8, airport_surcharge: 5 };

describe("computeFare", () => {
  it("sums base + distance + time", () => {
    // 3 + (4 * 2) + (10 * 0.25) = 3 + 8 + 2.5 = 13.5
    expect(computeFare(4, 10, rule, false)).toBe(13.5);
  });
  it("applies the minimum fare floor", () => {
    // 3 + (0.5*2) + (2*0.25) = 4.5 → floored to 8
    expect(computeFare(0.5, 2, rule, false)).toBe(8);
  });
  it("adds the airport surcharge when flagged", () => {
    // 13.5 + 5 = 18.5
    expect(computeFare(4, 10, rule, true)).toBe(18.5);
  });
  it("rounds to 2dp", () => {
    expect(computeFare(1.111, 3.333, rule, false)).toBe(Math.round((3 + 1.111 * 2 + 3.333 * 0.25) * 100) / 100);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/config-fare.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/config/fare.ts`**

```typescript
export interface FareRule {
  base_fare: number;
  per_mile: number;
  per_min: number;
  min_fare: number;
  airport_surcharge: number;
}

/** Pure: price a journey. Applies the min-fare floor, then airport surcharge. */
export function computeFare(
  distanceMiles: number,
  durationMin: number,
  rule: FareRule,
  isAirport: boolean,
): number {
  const raw = rule.base_fare + distanceMiles * rule.per_mile + durationMin * rule.per_min;
  const floored = Math.max(raw, rule.min_fare);
  const total = floored + (isAirport ? rule.airport_surcharge : 0);
  return Math.round(total * 100) / 100;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/config-fare.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Write failing guardrails test**

```typescript
// tests/config-guardrails.test.ts
import { describe, it, expect } from "vitest";
import { validateConfig, type Guardrail } from "@/lib/config/guardrails";

const guards: Guardrail[] = [
  { field: "service_area", locked: true, min_value: null, max_value: null },
  { field: "min_fare", locked: false, min_value: 5, max_value: 20 },
];

describe("validateConfig", () => {
  it("passes when nothing violates guardrails", () => {
    const r = validateConfig({ min_fare: 10 }, guards, { service_area: "London" }, { service_area: "London" });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
  it("flags a change to a locked field", () => {
    const r = validateConfig({}, guards, { service_area: "Manchester" }, { service_area: "London" });
    expect(r.ok).toBe(false);
    expect(r.violations).toContainEqual({ field: "service_area", reason: "locked" });
  });
  it("allows a locked field if unchanged", () => {
    const r = validateConfig({}, guards, { service_area: "London" }, { service_area: "London" });
    expect(r.ok).toBe(true);
  });
  it("flags a numeric value below min or above max", () => {
    expect(validateConfig({ min_fare: 2 }, guards, {}, {}).violations).toContainEqual({ field: "min_fare", reason: "below_min" });
    expect(validateConfig({ min_fare: 25 }, guards, {}, {}).violations).toContainEqual({ field: "min_fare", reason: "above_max" });
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run tests/config-guardrails.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 7: Create `src/lib/config/guardrails.ts`**

```typescript
export interface Guardrail {
  field: string;
  locked: boolean;
  min_value: number | null;
  max_value: number | null;
}

export interface Violation {
  field: string;
  reason: "locked" | "below_min" | "above_max";
}

/**
 * Pure: validate a candidate config against guardrails.
 * - `numericValues`: candidate numeric fields keyed by guardrail field (e.g. min_fare).
 * - `candidateConfig` / `liveConfig`: the full config objects, to detect changes to LOCKED fields.
 * A locked field violates only if its value differs from the live config.
 */
export function validateConfig(
  numericValues: Record<string, number>,
  guardrails: Guardrail[],
  candidateConfig: Record<string, unknown>,
  liveConfig: Record<string, unknown>,
): { ok: boolean; violations: Violation[] } {
  const violations: Violation[] = [];
  for (const g of guardrails) {
    if (g.locked) {
      const before = JSON.stringify(liveConfig[g.field] ?? null);
      const after = JSON.stringify(candidateConfig[g.field] ?? null);
      if (before !== after) violations.push({ field: g.field, reason: "locked" });
    }
    const v = numericValues[g.field];
    if (typeof v === "number") {
      if (g.min_value !== null && v < g.min_value) violations.push({ field: g.field, reason: "below_min" });
      if (g.max_value !== null && v > g.max_value) violations.push({ field: g.field, reason: "above_max" });
    }
  }
  return { ok: violations.length === 0, violations };
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npx vitest run tests/config-guardrails.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/config/fare.ts src/lib/config/guardrails.ts tests/config-fare.test.ts tests/config-guardrails.test.ts
git commit -m "feat(config): pure fare computation + guardrail validation"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Version + fare + guardrail services

**Files:** Create `src/lib/config/versions.ts`, `src/lib/config/fare-queries.ts`, `src/lib/config/guardrail-queries.ts`

- [ ] **Step 1: Create `src/lib/config/guardrail-queries.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { Guardrail } from "./guardrails";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function listGuardrails(automationId: string): Promise<Guardrail[]> {
  const { data } = await svc().from("config_guardrails").select("field, locked, min_value, max_value").eq("automation_id", automationId);
  return (data ?? []) as Guardrail[];
}

export async function setGuardrail(args: { automationId: string; field: string; locked: boolean; minValue: number | null; maxValue: number | null }): Promise<void> {
  await svc().from("config_guardrails").upsert(
    { automation_id: args.automationId, field: args.field, locked: args.locked, min_value: args.minValue, max_value: args.maxValue, updated_at: new Date().toISOString() },
    { onConflict: "automation_id,field" },
  );
}
```

- [ ] **Step 2: Create `src/lib/config/fare-queries.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface FareRuleRow {
  id: string; vehicle_type: string; base_fare: number; per_mile: number; per_min: number;
  min_fare: number; airport_surcharge: number; currency: string;
}

export async function listFareRules(tenantId: string, automationId: string): Promise<FareRuleRow[]> {
  const { data } = await svc().from("fare_rules").select("id, vehicle_type, base_fare, per_mile, per_min, min_fare, airport_surcharge, currency").eq("tenant_id", tenantId).eq("automation_id", automationId).order("vehicle_type");
  return (data ?? []) as FareRuleRow[];
}

export async function upsertFareRule(tenantId: string, automationId: string, rule: Omit<FareRuleRow, "id">): Promise<void> {
  await svc().from("fare_rules").upsert(
    {
      tenant_id: tenantId, automation_id: automationId, vehicle_type: rule.vehicle_type,
      base_fare: rule.base_fare, per_mile: rule.per_mile, per_min: rule.per_min,
      min_fare: rule.min_fare, airport_surcharge: rule.airport_surcharge, currency: rule.currency,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "automation_id,vehicle_type" },
  );
}

export async function deleteFareRule(tenantId: string, ruleId: string): Promise<void> {
  await svc().from("fare_rules").delete().eq("tenant_id", tenantId).eq("id", ruleId);
}
```

- [ ] **Step 3: Create `src/lib/config/versions.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { listGuardrails } from "./guardrail-queries";
import { validateConfig, type Violation } from "./guardrails";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface VersionRow {
  id: string; version: number; status: string; change_note: string | null;
  published_at: string | null; created_at: string;
}

/** Reads the current live config row from automation_config. */
export async function getLiveConfig(automationId: string): Promise<Record<string, unknown> | null> {
  const { data } = await svc().from("automation_config").select("*").eq("automation_id", automationId).maybeSingle();
  return (data as Record<string, unknown>) ?? null;
}

export async function listVersions(automationId: string): Promise<VersionRow[]> {
  const { data } = await svc().from("config_versions").select("id, version, status, change_note, published_at, created_at").eq("automation_id", automationId).order("version", { ascending: false });
  return (data ?? []) as VersionRow[];
}

/** Create a draft snapshot of `config` as the next version number. */
export async function createDraft(args: { tenantId: string; automationId: string; config: Record<string, unknown>; changeNote?: string; createdBy: string }): Promise<{ id: string; version: number }> {
  const sb = svc();
  const { data: maxRow } = await sb.from("config_versions").select("version").eq("automation_id", args.automationId).order("version", { ascending: false }).limit(1).maybeSingle();
  const nextVersion = ((maxRow?.version as number) ?? 0) + 1;
  const { data } = await sb.from("config_versions").insert({
    automation_id: args.automationId, tenant_id: args.tenantId, version: nextVersion,
    config: args.config, status: "draft", change_note: args.changeNote ?? null, created_by: args.createdBy,
  }).select("id, version").single();
  return { id: data?.id as string, version: data?.version as number };
}

/**
 * Publish a draft: validate its config against guardrails, copy the snapshot
 * into automation_config (the live config the engine reads), mark the version
 * published + synced. Returns violations on failure (nothing is published).
 */
export async function publishVersion(args: { tenantId: string; automationId: string; versionId: string; publishedBy: string }): Promise<{ ok: boolean; violations?: Violation[] }> {
  const sb = svc();
  const { data: version } = await sb.from("config_versions").select("*").eq("id", args.versionId).eq("automation_id", args.automationId).maybeSingle();
  if (!version) return { ok: false };
  const candidate = (version.config as Record<string, unknown>) ?? {};

  const live = (await getLiveConfig(args.automationId)) ?? {};
  const guardrails = await listGuardrails(args.automationId);
  // numeric fields we currently bound: min_fare lives in fare_rules, not config,
  // so the numericValues map is built from any numeric top-level config fields.
  const numericValues: Record<string, number> = {};
  for (const [k, v] of Object.entries(candidate)) if (typeof v === "number") numericValues[k] = v;
  const check = validateConfig(numericValues, guardrails, candidate, live);
  if (!check.ok) return { ok: false, violations: check.violations };

  const now = new Date().toISOString();
  // Copy snapshot into the live automation_config (only known editable columns).
  await sb.from("automation_config").update({
    welcome_messages: candidate.welcome_messages ?? {},
    vehicle_types: candidate.vehicle_types ?? [],
    service_area: candidate.service_area ?? null,
    opening_hours: candidate.opening_hours ?? {},
    brand_colours: candidate.brand_colours ?? {},
    languages: candidate.languages ?? ["en"],
    ask_driver_note: candidate.ask_driver_note ?? false,
    current_version_id: args.versionId,
    updated_by: args.publishedBy,
    updated_at: now,
  }).eq("automation_id", args.automationId);

  // Mark previously-published versions archived, then this one published.
  await sb.from("config_versions").update({ status: "archived" }).eq("automation_id", args.automationId).eq("status", "published");
  await sb.from("config_versions").update({ status: "published", published_by: args.publishedBy, published_at: now, synced_to_engine_at: now }).eq("id", args.versionId);
  return { ok: true };
}

/** Roll back: create a new draft from an old version's config, then publish it. */
export async function rollbackTo(args: { tenantId: string; automationId: string; versionId: string; userId: string }): Promise<{ ok: boolean; violations?: Violation[] }> {
  const sb = svc();
  const { data: old } = await sb.from("config_versions").select("config").eq("id", args.versionId).eq("automation_id", args.automationId).maybeSingle();
  if (!old) return { ok: false };
  const draft = await createDraft({ tenantId: args.tenantId, automationId: args.automationId, config: old.config as Record<string, unknown>, changeNote: `Rollback to version`, createdBy: args.userId });
  return publishVersion({ tenantId: args.tenantId, automationId: args.automationId, versionId: draft.id, publishedBy: args.userId });
}

export async function deleteDraft(tenantId: string, versionId: string): Promise<void> {
  await svc().from("config_versions").delete().eq("tenant_id", tenantId).eq("id", versionId).eq("status", "draft");
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/config/versions.ts src/lib/config/fare-queries.ts src/lib/config/guardrail-queries.ts
git commit -m "feat(config): version publish/rollback + fare + guardrail services"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Tenant API routes (gated)

**Files:** Create the five route files; Test `tests/config-routes.test.ts`

- [ ] **Step 1: Write the failing test (publish route gating)**

```typescript
// tests/config-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/config/versions", () => ({ publishVersion: vi.fn(async () => ({ ok: true })) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { publishVersion } from "@/lib/config/versions";
import { POST } from "@/app/api/orgs/[orgId]/automations/[automationId]/config/versions/[versionId]/route";

const ctx = { params: Promise.resolve({ orgId: "t1", automationId: "a1", versionId: "v1" }) };
function req() { return new Request("http://x", { method: "POST" }); }

describe("POST publish version", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes when entitled + not demo", async () => {
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(publishVersion).toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(publishVersion).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(publishVersion).not.toHaveBeenCalled();
  });
  it("returns 422 with violations when publish is blocked by guardrails", async () => {
    vi.mocked(publishVersion).mockResolvedValueOnce({ ok: false, violations: [{ field: "service_area", reason: "locked" }] });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/config-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/automations/[automationId]/config/versions/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listVersions, createDraft, getLiveConfig } from "@/lib/config/versions";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  return NextResponse.json({ versions: await listVersions(automationId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const config = (body.config as Record<string, unknown>) ?? (await getLiveConfig(automationId)) ?? {};
  const draft = await createDraft({ tenantId: orgId, automationId, config, changeNote: typeof body.changeNote === "string" ? body.changeNote : undefined, createdBy: gate.claims.sub });
  return NextResponse.json({ ok: true, ...draft });
}
```

- [ ] **Step 4: Create `src/app/api/orgs/[orgId]/automations/[automationId]/config/versions/[versionId]/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { publishVersion, deleteDraft } from "@/lib/config/versions";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string; versionId: string }> }) {
  const { orgId, automationId, versionId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  const result = await publishVersion({ tenantId: orgId, automationId, versionId, publishedBy: gate.claims.sub });
  if (!result.ok) return NextResponse.json({ ok: false, violations: result.violations ?? [] }, { status: 422 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string; versionId: string }> }) {
  const { orgId, automationId, versionId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  await deleteDraft(orgId, versionId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create `src/app/api/orgs/[orgId]/automations/[automationId]/config/rollback/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { rollbackTo } from "@/lib/config/versions";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "config_versioning");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const versionId = String(body.versionId ?? "");
  if (!versionId) return NextResponse.json({ error: "versionId is required." }, { status: 400 });
  const result = await rollbackTo({ tenantId: orgId, automationId, versionId, userId: gate.claims.sub });
  if (!result.ok) return NextResponse.json({ ok: false, violations: result.violations ?? [] }, { status: 422 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create `src/app/api/orgs/[orgId]/automations/[automationId]/fares/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listFareRules, upsertFareRule } from "@/lib/config/fare-queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "fare_rules");
  if (feat) return feat;
  return NextResponse.json({ rules: await listFareRules(orgId, automationId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "fare_rules");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const vehicle_type = String(b.vehicle_type ?? "").trim();
  if (!vehicle_type) return NextResponse.json({ error: "vehicle_type is required." }, { status: 400 });
  const num = (k: string) => { const n = Number(b[k]); return Number.isFinite(n) ? n : 0; };
  await upsertFareRule(orgId, automationId, {
    vehicle_type, base_fare: num("base_fare"), per_mile: num("per_mile"), per_min: num("per_min"),
    min_fare: num("min_fare"), airport_surcharge: num("airport_surcharge"), currency: String(b.currency ?? "GBP"),
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Create `src/app/api/orgs/[orgId]/automations/[automationId]/fares/[ruleId]/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { deleteFareRule } from "@/lib/config/fare-queries";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; automationId: string; ruleId: string }> }) {
  const { orgId, automationId, ruleId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "fare_rules");
  if (feat) return feat;
  void automationId;
  await deleteFareRule(orgId, ruleId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Run routes test + typecheck**

Run: `npx vitest run tests/config-routes.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests); no type errors.

- [ ] **Step 9: Commit**

```bash
git add "src/app/api/orgs/[orgId]/automations/[automationId]/config/versions" "src/app/api/orgs/[orgId]/automations/[automationId]/config/rollback" "src/app/api/orgs/[orgId]/automations/[automationId]/fares" tests/config-routes.test.ts
git commit -m "feat(config): tenant API — versions publish/rollback + fare rules (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Admin guardrails surface

**Files:** Create `src/app/admin/guardrails/page.tsx`, `src/app/admin/guardrails/actions.ts`; Modify `src/components/admin/admin-shell.tsx`

- [ ] **Step 1: Create `src/app/admin/guardrails/actions.ts`**

```typescript
"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setGuardrail } from "@/lib/config/guardrail-queries";
import { revalidatePath } from "next/cache";

export async function setGuardrailAction(formData: FormData): Promise<void> {
  await requireStaff();
  const automationId = String(formData.get("automationId"));
  const field = String(formData.get("field"));
  const locked = String(formData.get("locked")) === "true";
  const minRaw = String(formData.get("minValue") ?? "");
  const maxRaw = String(formData.get("maxValue") ?? "");
  await setGuardrail({
    automationId, field, locked,
    minValue: minRaw === "" ? null : Number(minRaw),
    maxValue: maxRaw === "" ? null : Number(maxRaw),
  });
  revalidatePath("/admin/guardrails");
}
```

- [ ] **Step 2: Create `src/app/admin/guardrails/page.tsx`**

```tsx
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { listGuardrails } from "@/lib/config/guardrail-queries";
import { setGuardrailAction } from "./actions";

export const metadata = { title: "Guardrails — Admin" };

const FIELDS = ["service_area", "vehicle_types", "opening_hours", "languages", "ask_driver_note"];

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function GuardrailsPage() {
  await requireStaff();
  const { data: automations } = await svc().from("automations").select("id, name, tenant_id").order("created_at", { ascending: false }).limit(50);
  const rows = automations ?? [];
  const guardrailSets = await Promise.all(rows.map((a) => listGuardrails(a.id as string)));

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Config guardrails</h1>
      <p className="mb-4 text-sm text-slate-500">Lock fields or bound numeric values. Enforced when a tenant publishes a config version.</p>
      <div className="space-y-6">
        {rows.map((a, i) => {
          const gMap = new Map(guardrailSets[i].map((g) => [g.field, g]));
          return (
            <section key={a.id as string} className="rounded-lg border border-slate-200 p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">{a.name as string}</h2>
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {FIELDS.map((field) => {
                    const g = gMap.get(field);
                    return (
                      <tr key={field}>
                        <td className="py-2 pr-4 text-slate-700">{field}</td>
                        <td className="py-2">
                          <form action={setGuardrailAction} className="flex items-center gap-2">
                            <input type="hidden" name="automationId" value={a.id as string} />
                            <input type="hidden" name="field" value={field} />
                            <label className="flex items-center gap-1 text-xs text-slate-600">
                              <input type="hidden" name="locked" value="false" />
                              <input type="checkbox" name="locked" value="true" defaultChecked={g?.locked ?? false} /> locked
                            </label>
                            <input name="minValue" placeholder="min" defaultValue={g?.min_value ?? ""} className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs" />
                            <input name="maxValue" placeholder="max" defaultValue={g?.max_value ?? ""} className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs" />
                            <button type="submit" className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white">Save</button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>
    </div>
  );
}
```

> NOTE: the `locked` checkbox uses a hidden `false` input before the checkbox so an unchecked box submits `"false"` and a checked box submits `"true"` (last value wins in FormData.get only returns the first — so in the action, read it as: `formData.getAll("locked").includes("true")`). Adjust the action's `locked` line to: `const locked = formData.getAll("locked").includes("true");`

- [ ] **Step 3: Fix the action's `locked` parsing**

Update `src/app/admin/guardrails/actions.ts` `locked` line to:
```typescript
  const locked = formData.getAll("locked").includes("true");
```

- [ ] **Step 4: Add "Guardrails" to admin nav**

In `src/components/admin/admin-shell.tsx`, add `{ label: "Guardrails", href: "/admin/guardrails" }` to the `NAV_ITEMS` array after "Plans", matching the exact existing shape.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/admin/guardrails`.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/guardrails src/components/admin/admin-shell.tsx
git commit -m "feat(config): admin guardrails surface — lock fields + numeric bounds"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Tenant UI — versions + fares pages (gated)

**Files:** Create the four page/client files; Modify nothing else (these are sub-routes under the existing automation dashboard).

- [ ] **Step 1: Create `src/app/dashboard/automations/[automationId]/versions/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listVersions } from "@/lib/config/versions";
import { VersionsClient } from "./versions-client";

export const metadata = { title: "Config versions — CabbyBot" };

export default async function VersionsPage({ params }: { params: Promise<{ automationId: string }> }) {
  const { automationId } = await params;
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "config_versioning"))) redirect(`/dashboard/automations/${automationId}`);
  const versions = await listVersions(automationId);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Config versions</h1>
      <p className="mb-4 text-sm text-slate-500">Snapshot the live config, publish changes, or roll back.</p>
      <VersionsClient orgId={claims.tenant_id} automationId={automationId} versions={versions} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/automations/[automationId]/versions/versions-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Version { id: string; version: number; status: string; change_note: string | null; published_at: string | null; created_at: string }

export function VersionsClient(props: { orgId: string; automationId: string; versions: Version[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const base = `/api/orgs/${props.orgId}/automations/${props.automationId}`;

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 422 && Array.isArray(b.violations)) setMsg(`Blocked by guardrails: ${b.violations.map((v: { field: string; reason: string }) => `${v.field} (${v.reason})`).join(", ")}`);
        else setMsg(typeof b.error === "string" ? b.error : `Failed (${res.status})`);
      } else router.refresh();
    } catch { setMsg("Network error."); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {!props.isDemo && (
          <button disabled={busy} onClick={() => call(`${base}/config/versions`, "POST", {})} className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Snapshot live config as draft
          </button>
        )}
        {msg && <span className="text-sm text-red-600" role="alert">{msg}</span>}
      </div>
      <table className="min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>{["Version", "Status", "Note", "Published", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {props.versions.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No versions yet.</td></tr>}
          {props.versions.map((v) => (
            <tr key={v.id}>
              <td className="px-3 py-2 text-slate-800">v{v.version}</td>
              <td className="px-3 py-2"><span className={v.status === "published" ? "text-emerald-600" : v.status === "draft" ? "text-amber-600" : "text-slate-400"}>{v.status}</span></td>
              <td className="px-3 py-2 text-slate-500">{v.change_note ?? "—"}</td>
              <td className="px-3 py-2 text-slate-400">{v.published_at ? new Date(v.published_at).toLocaleString("en-GB") : "—"}</td>
              <td className="px-3 py-2 text-right">
                {!props.isDemo && (
                  <span className="flex justify-end gap-1">
                    {v.status === "draft" && <button disabled={busy} onClick={() => call(`${base}/config/versions/${v.id}`, "POST")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Publish</button>}
                    {v.status !== "draft" && <button disabled={busy} onClick={() => call(`${base}/config/rollback`, "POST", { versionId: v.id })} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Roll back to this</button>}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/dashboard/automations/[automationId]/fares/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listFareRules } from "@/lib/config/fare-queries";
import { FaresClient } from "./fares-client";

export const metadata = { title: "Fares — CabbyBot" };

export default async function FaresPage({ params }: { params: Promise<{ automationId: string }> }) {
  const { automationId } = await params;
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "fare_rules"))) redirect(`/dashboard/automations/${automationId}`);
  const rules = await listFareRules(claims.tenant_id, automationId);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Fare rules</h1>
      <p className="mb-4 text-sm text-slate-500">Per-vehicle pricing the bot quotes.</p>
      <FaresClient orgId={claims.tenant_id} automationId={automationId} rules={rules} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 4: Create `src/app/dashboard/automations/[automationId]/fares/fares-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Rule { id: string; vehicle_type: string; base_fare: number; per_mile: number; per_min: number; min_fare: number; airport_surcharge: number; currency: string }

export function FaresClient(props: { orgId: string; automationId: string; rules: Rule[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const base = `/api/orgs/${props.orgId}/automations/${props.automationId}/fares`;

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`); }
      else router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <div>
      <table className="mb-4 min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{["Vehicle", "Base", "/mile", "/min", "Min", "Airport", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {props.rules.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">No fare rules yet.</td></tr>}
          {props.rules.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 text-slate-800">{r.vehicle_type}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.base_fare).toFixed(2)}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.per_mile).toFixed(2)}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.per_min).toFixed(2)}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.min_fare).toFixed(2)}</td>
              <td className="px-3 py-2 text-slate-600">£{Number(r.airport_surcharge).toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{!props.isDemo && <button disabled={busy} onClick={() => call(`${base}/${r.id}`, "DELETE")} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Delete</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
      {!props.isDemo && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void call(base, "POST", {
              vehicle_type: f.get("vehicle_type"), base_fare: Number(f.get("base_fare")), per_mile: Number(f.get("per_mile")),
              per_min: Number(f.get("per_min")), min_fare: Number(f.get("min_fare")), airport_surcharge: Number(f.get("airport_surcharge")),
            });
            e.currentTarget.reset();
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <input name="vehicle_type" required placeholder="saloon" className="w-28 rounded border border-slate-300 px-2 py-1 text-sm" />
          {["base_fare", "per_mile", "per_min", "min_fare", "airport_surcharge"].map((n) => (
            <input key={n} name={n} type="number" step="0.01" defaultValue="0" placeholder={n} className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
          ))}
          <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Save rule</button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles the new pages.

- [ ] **Step 6: Commit**

```bash
git add "src/app/dashboard/automations/[automationId]/versions" "src/app/dashboard/automations/[automationId]/fares"
git commit -m "feat(config): tenant versions + fares dashboard pages (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 7: Integration gate

- [ ] **Step 1: Run the config test set**

Run: `npx vitest run tests/config-migration.test.ts tests/config-fare.test.ts tests/config-guardrails.test.ts tests/config-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(config): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Config versioning (draft → publish → archive) | Tasks 1, 3, 4, 6 |
| Rollback to a prior version | Tasks 3, 4, 6 |
| Publish writes to live `automation_config` + stamps sync | Task 3 |
| Guardrails (locked fields + numeric bounds), admin-set | Tasks 1, 2, 5 |
| Guardrails enforced at publish | Tasks 3 (publishVersion), 4 (422 on violations) |
| Fare-rules engine (pure compute + CRUD) | Tasks 2, 3, 4, 6 |
| Entitlement gates (`config_versioning`, `fare_rules`) on every surface | Tasks 4, 6 |
| Demo write-block | Tasks 4, 6 |
| Admin guardrails surface (`requireStaff`) | Task 5 |

**Placeholder scan:** none.

**Type consistency:** `FareRule` (fare.ts) vs `FareRuleRow` (fare-queries.ts) are distinct by design (compute shape vs DB row). `Guardrail`/`Violation` in guardrails.ts used by versions.ts + guardrail-queries.ts. `publishVersion`/`rollbackTo` return `{ ok, violations? }` consistently; routes map `!ok` → 422.

**Known limitations (documented):** the engine "reads" the published config by virtue of the publish step writing `automation_config` (the same row Epic 7b exposes) — there is no separate n8n push in this epic (a `synced_to_engine_at` stamp is set; an actual engine webhook call is a later integration); fare rules are stored + computable but the bot wiring to quote from them lives in the automation engine (out of scope here); guardrail numeric bounds apply to numeric top-level config fields (fare min/max bounding is a fast-follow once fares feed config).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-epic-16-config-control-plane.md`.

**7 tasks. Task 1 (schema) gates all; Task 2 (pure) independent; Task 3 depends on 1–2; Task 4 depends on 3; Task 5 depends on 3; Task 6 depends on 3–4; Task 7 last.**
