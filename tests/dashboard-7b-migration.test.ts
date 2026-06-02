import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0015_dashboard_config_support.sql"), "utf8");

describe("0015 migration", () => {
  it("creates automation_config (one row per automation) with tenant_id + automation_id", () => {
    expect(sql).toMatch(/create table public\.automation_config/i);
    expect(sql).toMatch(/automation_id\s+uuid\s+not null/i);
    expect(sql).toMatch(/tenant_id\s+uuid\s+not null/i);
    expect(sql).toMatch(/unique\s*\(automation_id\)|automation_id\s+uuid\s+not null\s+unique/i);
  });
  it("creates support_tickets with status + category checks", () => {
    expect(sql).toMatch(/create table public\.support_tickets/i);
    expect(sql).toMatch(/category .*check .*build_request/i);
    expect(sql).toMatch(/status .*check .*open/i);
  });
  it("enables RLS on both tables", () => {
    expect(sql).toMatch(/alter table public\.automation_config enable row level security/i);
    expect(sql).toMatch(/alter table public\.support_tickets enable row level security/i);
  });
  it("has tenant-isolation policies referencing tenant_users", () => {
    expect(sql).toMatch(/tenant_users/i);
  });
});
