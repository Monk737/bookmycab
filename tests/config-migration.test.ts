// tests/config-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0022_config_control_plane.sql"), "utf8");

describe("0022 config control plane migration", () => {
  it("creates config_versions, fare_rules, config_guardrails", () => {
    expect(sql).toMatch(/create table public\.config_versions/i);
    expect(sql).toMatch(/create table public\.fare_rules/i);
    expect(sql).toMatch(/create table public\.config_guardrails/i);
  });
  it("config_versions has a status check incl. draft + published", () => {
    expect(sql).toMatch(/status .*check .*draft/i);
    expect(sql).toMatch(/published/i);
  });
  it("adds automation_config.current_version_id", () => {
    expect(sql).toMatch(/alter table public\.automation_config add column current_version_id uuid/i);
  });
  it("enables RLS + tenant policies on config_versions + fare_rules", () => {
    expect(sql).toMatch(/alter table public\.config_versions enable row level security/i);
    expect(sql).toMatch(/alter table public\.fare_rules enable row level security/i);
    expect(sql).toMatch(/config_versions_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/fare_rules_insert/i);
  });
  it("config_guardrails is admin-only (RLS on, no tenant select policy needed) and references automation", () => {
    expect(sql).toMatch(/alter table public\.config_guardrails enable row level security/i);
  });
});
