// tests/reporting-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0027_reporting.sql"), "utf8");

describe("0027 reporting migration", () => {
  it("creates report_definitions and report_runs", () => {
    expect(sql).toMatch(/create table public\.report_definitions/i);
    expect(sql).toMatch(/create table public\.report_runs/i);
  });
  it("makes report_runs append-only", () => {
    expect(sql).toMatch(/create trigger report_runs_immutable/i);
    expect(sql).toMatch(/before update or delete on public\.report_runs/i);
  });
  it("adds tenants.branding jsonb", () => {
    expect(sql).toMatch(/alter table public\.tenants add column branding jsonb/i);
  });
  it("enables RLS + tenant policies", () => {
    expect(sql).toMatch(/alter table public\.report_definitions enable row level security/i);
    expect(sql).toMatch(/alter table public\.report_runs enable row level security/i);
    expect(sql).toMatch(/report_definitions_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/report_definitions_insert/i);
  });
});
