// tests/entitlements-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql0017 = readFileSync(
  join(process.cwd(), "supabase/migrations/0017_entitlements.sql"),
  "utf8",
);

const sql0018 = readFileSync(
  join(process.cwd(), "supabase/migrations/0018_usage_metering.sql"),
  "utf8",
);

const sql0019 = readFileSync(
  join(process.cwd(), "supabase/migrations/0019_entitlements_rls_hardening.sql"),
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

describe("0019 entitlements RLS hardening", () => {
  it("drops the permissive public-read policies", () => {
    expect(sql0019).toMatch(/drop policy if exists plans_select on public\.plans/i);
    expect(sql0019).toMatch(/drop policy if exists feature_rollouts_select on public\.feature_rollouts/i);
  });
  it("revokes anon select on the catalog tables", () => {
    expect(sql0019).toMatch(/revoke select on public\.plans from anon/i);
    expect(sql0019).toMatch(/revoke select on public\.feature_rollouts from anon, authenticated/i);
  });
  it("re-creates authenticated-only read policies (rollouts left service-role only)", () => {
    expect(sql0019).toMatch(/create policy plans_select on public\.plans\s+for select using \(auth\.uid\(\) is not null\)/i);
    expect(sql0019).not.toMatch(/create policy feature_rollouts_select/i);
  });
});
