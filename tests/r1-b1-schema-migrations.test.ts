// tests/r1-b1-schema-migrations.test.ts
//
// Static structure assertions for the R1 two-product schema (0035–0039),
// the B1 new-model billing schema (0040), and the RPC-grant hardening (0041).
// These guard the migration FILES; the actual remote DB state was verified
// separately via the Supabase MCP (execute_sql) at apply time.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (f: string) =>
  readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8");

describe("0035 voice agents", () => {
  const sql = read("0035_voice_agents.sql");
  it("widens automations.type to include Voice", () => {
    expect(sql).toMatch(/drop constraint if exists automations_type_check/i);
    expect(sql).toMatch(/check \(type in \([^)]*'Voice'[^)]*\)\)/i);
  });
  it("creates voice_subscriptions (shared pool) + voice_agents", () => {
    expect(sql).toMatch(/create table public\.voice_subscriptions/i);
    expect(sql).toMatch(/monthly_call_allowance\s+integer not null/i);
    expect(sql).toMatch(/included_agents\s+integer not null/i);
    expect(sql).toMatch(/create table public\.voice_agents/i);
    expect(sql).toMatch(/automation_id\s+uuid primary key references public\.automations\(id\)/i);
  });
  it("enables RLS + tenant select policies", () => {
    expect(sql).toMatch(/voice_subscriptions_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/voice_agents_select[\s\S]*current_user_tenants\(\)/i);
  });
});

describe("0036 calls", () => {
  const sql = read("0036_calls.sql");
  it("creates calls with outcome + credit_source + agent attribution", () => {
    expect(sql).toMatch(/create table public\.calls/i);
    expect(sql).toMatch(/automation_id\s+uuid not null references public\.automations\(id\)/i);
    expect(sql).toMatch(/outcome[\s\S]*check[\s\S]*booked[\s\S]*no_credit/i);
    expect(sql).toMatch(/credit_source[\s\S]*check[\s\S]*'plan'[\s\S]*'topup'[\s\S]*'none'/i);
  });
  it("is append-only via a trigger", () => {
    expect(sql).toMatch(/create trigger calls_immutable[\s\S]*before update or delete on public\.calls/i);
    expect(sql).toMatch(/calls is append-only/i);
  });
  it("has RLS select policy", () => {
    expect(sql).toMatch(/calls_select[\s\S]*current_user_tenants\(\)/i);
  });
});

describe("0037 credit ledger", () => {
  const sql = read("0037_credit_ledger.sql");
  it("creates credit_ledger with delta + reason", () => {
    expect(sql).toMatch(/create table public\.credit_ledger/i);
    expect(sql).toMatch(/delta\s+integer not null/i);
    expect(sql).toMatch(/reason[\s\S]*check[\s\S]*topup_purchase[\s\S]*call_consumption/i);
  });
  it("is append-only via a trigger", () => {
    expect(sql).toMatch(/create trigger credit_ledger_immutable[\s\S]*before update or delete on public\.credit_ledger/i);
  });
  it("defines credit_balance() as security definer scoped to the caller", () => {
    expect(sql).toMatch(/create or replace function public\.credit_balance\(p_tenant uuid\)/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/current_user_tenants\(\)/i);
  });
});

describe("0038 voice_calls feature", () => {
  const sql = read("0038_voice_calls_feature.sql");
  it("inserts a metered voice_calls feature, idempotently", () => {
    expect(sql).toMatch(/insert into public\.features/i);
    expect(sql).toMatch(/'voice_calls'/);
    expect(sql).toMatch(/true,\s*'call'/i);
    expect(sql).toMatch(/on conflict \(key\) do nothing/i);
  });
});

describe("0039 coupons tenant-redeem", () => {
  const sql = read("0039_coupons_tenant_redeem.sql");
  it("adds tenant_redeemable + widens applies_to to include credit", () => {
    expect(sql).toMatch(/add column tenant_redeemable boolean not null default false/i);
    expect(sql).toMatch(/check \(applies_to in \([^)]*'credit'[^)]*\)\)/i);
  });
  it("creates coupon_redemptions with RLS select", () => {
    expect(sql).toMatch(/create table public\.coupon_redemptions/i);
    expect(sql).toMatch(/coupon_redemptions_select[\s\S]*current_user_tenants\(\)/i);
  });
  it("defines validate_coupon() honouring eligibility", () => {
    expect(sql).toMatch(/create or replace function public\.validate_coupon\(p_code text\)/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/c\.tenant_redeemable/i);
    expect(sql).toMatch(/times_redeemed < c\.max_redemptions/i);
  });
});

describe("0040 new-model billing", () => {
  const sql = read("0040_new_model_billing.sql");
  it("creates chat_subscriptions with RLS", () => {
    expect(sql).toMatch(/create table public\.chat_subscriptions/i);
    expect(sql).toMatch(/channel_mode[\s\S]*check[\s\S]*single[\s\S]*bundle/i);
    expect(sql).toMatch(/monthly_price_gbp\s+numeric\(10,2\) not null/i);
    expect(sql).toMatch(/chat_subscriptions_select[\s\S]*current_user_tenants\(\)/i);
  });
  it("adds monthly_price_gbp to voice_subscriptions", () => {
    expect(sql).toMatch(/alter table public\.voice_subscriptions\s+add column monthly_price_gbp numeric\(10,2\)/i);
  });
  it("adds tenants.commercial_model and makes plan_band nullable (additive)", () => {
    expect(sql).toMatch(/add column commercial_model text .*check .*chat.*voice.*double_decker/i);
    expect(sql).toMatch(/alter table public\.tenants alter column plan_band drop not null/i);
    expect(sql).not.toMatch(/update public\.tenants set/i);
  });
});

describe("0041 RPC execute hardening", () => {
  const sql = read("0041_restrict_new_rpc_execute.sql");
  it("revokes anon/public execute on the new RPCs, grants authenticated + service_role", () => {
    expect(sql).toMatch(/revoke execute on function public\.credit_balance\(uuid\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.credit_balance\(uuid\) to authenticated, service_role/i);
    expect(sql).toMatch(/revoke execute on function public\.validate_coupon\(text\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.validate_coupon\(text\) to authenticated, service_role/i);
  });
});
