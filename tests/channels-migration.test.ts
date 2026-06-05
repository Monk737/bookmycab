// tests/channels-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0028_self_serve_channels.sql"), "utf8");

describe("0028 self-serve channels migration", () => {
  it("adds provisioning columns to channels", () => {
    expect(sql).toMatch(/alter table public\.channels add column created_by uuid/i);
    expect(sql).toMatch(/alter table public\.channels add column provisioning_status text/i);
    expect(sql).toMatch(/alter table public\.channels add column is_self_serve boolean/i);
  });
  it("provisioning_status defaults to approved with a check constraint", () => {
    expect(sql).toMatch(/provisioning_status text .*default 'approved'/i);
    expect(sql).toMatch(/check .*'pending_review'.*'approved'.*'rejected'/i);
  });
  it("creates platform_apps (global)", () => {
    expect(sql).toMatch(/create table public\.platform_apps/i);
    expect(sql).toMatch(/alter table public\.platform_apps enable row level security/i);
  });
});
