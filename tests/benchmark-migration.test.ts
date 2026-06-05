// tests/benchmark-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0032_benchmark_snapshots.sql"), "utf8");

describe("0032 benchmark snapshots migration", () => {
  it("creates benchmark_snapshots with percentile columns", () => {
    expect(sql).toMatch(/create table public\.benchmark_snapshots/i);
    expect(sql).toMatch(/p25\s+numeric/i);
    expect(sql).toMatch(/p50\s+numeric/i);
    expect(sql).toMatch(/p75\s+numeric/i);
    expect(sql).toMatch(/sample_size\s+integer/i);
  });
  it("adds tenants.benchmark_opt_in", () => {
    expect(sql).toMatch(/alter table public\.tenants add column benchmark_opt_in boolean/i);
  });
  it("enables RLS (global / service-role only)", () => {
    expect(sql).toMatch(/alter table public\.benchmark_snapshots enable row level security/i);
  });
});
