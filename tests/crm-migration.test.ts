// tests/crm-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0021_crm.sql"), "utf8");

describe("0021 crm migration", () => {
  it("creates customers with a unique (tenant_id, customer_handle)", () => {
    expect(sql).toMatch(/create table public\.customers/i);
    expect(sql).toMatch(/unique\s*\(tenant_id, customer_handle\)/i);
  });
  it("creates customer_notes", () => {
    expect(sql).toMatch(/create table public\.customer_notes/i);
  });
  it("adds customer_id to bookings and conversations", () => {
    expect(sql).toMatch(/alter table public\.bookings add column customer_id uuid/i);
    expect(sql).toMatch(/alter table public\.conversations add column customer_id uuid/i);
  });
  it("enables RLS + tenant-scoped policies", () => {
    expect(sql).toMatch(/alter table public\.customers enable row level security/i);
    expect(sql).toMatch(/alter table public\.customer_notes enable row level security/i);
    expect(sql).toMatch(/customers_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/customers_insert/i);
  });
});
