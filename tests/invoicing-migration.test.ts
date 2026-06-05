// tests/invoicing-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0026_account_invoicing.sql"), "utf8");

describe("0026 account invoicing migration", () => {
  it("creates account_customers, tenant_invoices, commission_rates", () => {
    expect(sql).toMatch(/create table public\.account_customers/i);
    expect(sql).toMatch(/create table public\.tenant_invoices/i);
    expect(sql).toMatch(/create table public\.commission_rates/i);
  });
  it("adds account_customer_id + payment_status to bookings", () => {
    expect(sql).toMatch(/alter table public\.bookings add column account_customer_id uuid/i);
    expect(sql).toMatch(/alter table public\.bookings add column payment_status text/i);
  });
  it("tenant_invoices has a status check incl. draft + paid", () => {
    expect(sql).toMatch(/status .*check .*draft/i);
    expect(sql).toMatch(/paid/i);
  });
  it("enables RLS + tenant policies on accounts + invoices", () => {
    expect(sql).toMatch(/alter table public\.account_customers enable row level security/i);
    expect(sql).toMatch(/alter table public\.tenant_invoices enable row level security/i);
    expect(sql).toMatch(/account_customers_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/tenant_invoices_insert/i);
  });
});
