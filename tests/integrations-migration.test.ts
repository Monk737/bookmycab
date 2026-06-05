// tests/integrations-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0029_integrations_api.sql"), "utf8");

describe("0029 integrations api migration", () => {
  it("creates api_keys, outbound_webhooks, webhook_deliveries", () => {
    expect(sql).toMatch(/create table public\.api_keys/i);
    expect(sql).toMatch(/create table public\.outbound_webhooks/i);
    expect(sql).toMatch(/create table public\.webhook_deliveries/i);
  });
  it("stores only a key hash + prefix (never raw)", () => {
    expect(sql).toMatch(/key_hash\s+text/i);
    expect(sql).toMatch(/prefix\s+text/i);
  });
  it("makes webhook_deliveries append-only", () => {
    expect(sql).toMatch(/create trigger webhook_deliveries_immutable/i);
    expect(sql).toMatch(/before update or delete on public\.webhook_deliveries/i);
  });
  it("enables RLS + tenant policies", () => {
    expect(sql).toMatch(/alter table public\.api_keys enable row level security/i);
    expect(sql).toMatch(/api_keys_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/outbound_webhooks_insert/i);
  });
});
