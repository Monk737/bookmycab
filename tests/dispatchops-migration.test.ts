// tests/dispatchops-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0024_dispatch_ops.sql"), "utf8");

describe("0024 dispatch ops migration", () => {
  it("creates dispatch_attempts and adapter_status", () => {
    expect(sql).toMatch(/create table public\.dispatch_attempts/i);
    expect(sql).toMatch(/create table public\.adapter_status/i);
  });
  it("makes dispatch_attempts append-only", () => {
    expect(sql).toMatch(/create trigger dispatch_attempts_immutable/i);
    expect(sql).toMatch(/before update or delete on public\.dispatch_attempts/i);
  });
  it("adds automations.dispatch_mode and bookings.quoted_fare", () => {
    expect(sql).toMatch(/alter table public\.automations add column dispatch_mode text/i);
    expect(sql).toMatch(/alter table public\.bookings add column quoted_fare numeric/i);
  });
  it("enables RLS + tenant select on dispatch_attempts", () => {
    expect(sql).toMatch(/alter table public\.dispatch_attempts enable row level security/i);
    expect(sql).toMatch(/dispatch_attempts_select[\s\S]*current_user_tenants\(\)/i);
  });
});
