// tests/copilot-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0030_ai_copilot.sql"), "utf8");

describe("0030 ai copilot migration", () => {
  it("creates copilot_messages", () => {
    expect(sql).toMatch(/create table public\.copilot_messages/i);
    expect(sql).toMatch(/question\s+text/i);
    expect(sql).toMatch(/answer\s+text/i);
    expect(sql).toMatch(/tokens\s+integer/i);
  });
  it("makes copilot_messages append-only", () => {
    expect(sql).toMatch(/create trigger copilot_messages_immutable/i);
    expect(sql).toMatch(/before update or delete on public\.copilot_messages/i);
  });
  it("enables RLS + tenant select", () => {
    expect(sql).toMatch(/alter table public\.copilot_messages enable row level security/i);
    expect(sql).toMatch(/copilot_messages_select[\s\S]*current_user_tenants\(\)/i);
  });
});
