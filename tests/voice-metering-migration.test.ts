// tests/voice-metering-migration.test.ts
// Static structure assertions for 0044 voice call metering. The function's
// runtime behaviour (draw order, idempotency, advisory-lock serialization) was
// verified against the DB at apply time via a self-rolling-back DO block.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0044_voice_call_metering.sql"),
  "utf8",
);

describe("0044 voice call metering", () => {
  it("adds calls.provider_call_id + a partial unique index (idempotency)", () => {
    expect(sql).toMatch(/alter table public\.calls add column provider_call_id text/i);
    expect(sql).toMatch(/create unique index calls_provider_call_id_uniq[\s\S]*where provider_call_id is not null/i);
  });
  it("defines record_voice_call as SECURITY DEFINER", () => {
    expect(sql).toMatch(/create or replace function public\.record_voice_call\(/i);
    expect(sql).toMatch(/security definer/i);
  });
  it("serializes per tenant with a transaction advisory lock", () => {
    expect(sql).toMatch(/pg_advisory_xact_lock\(hashtext\(p_tenant::text\)\)/i);
  });
  it("implements the draw order: plan pool, then top-up, then no_credit", () => {
    expect(sql).toMatch(/update public\.usage_counters[\s\S]*used = used \+ 1[\s\S]*used < coalesce\(limit_amount/i);
    expect(sql).toMatch(/credit_ledger[\s\S]*sum\(delta\)[\s\S]*> 0/i);
    expect(sql).toMatch(/'no_credit'/);
    expect(sql).toMatch(/values \(p_tenant, -1, 'call_consumption'/i);
  });
  it("restricts execute to service_role only", () => {
    expect(sql).toMatch(/revoke execute on function public\.record_voice_call[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.record_voice_call[\s\S]*to service_role/i);
  });
});
