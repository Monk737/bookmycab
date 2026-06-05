// tests/platform-senders-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0031_platform_senders.sql"), "utf8");

describe("0031 platform_senders migration", () => {
  it("creates platform_senders with a type check", () => {
    expect(sql).toMatch(/create table public\.platform_senders/i);
    expect(sql).toMatch(/type text not null check \(type in \('email','sms','slack'\)\)/i);
  });
  it("enables RLS (global / service-role only — no tenant policy)", () => {
    expect(sql).toMatch(/alter table public\.platform_senders enable row level security/i);
  });
});
