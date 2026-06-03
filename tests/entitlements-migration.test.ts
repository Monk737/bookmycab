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
