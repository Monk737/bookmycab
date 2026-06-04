// tests/convintel-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0025_conversation_intelligence.sql"), "utf8");

describe("0025 conversation intelligence migration", () => {
  it("adds analysis columns to conversations", () => {
    expect(sql).toMatch(/alter table public\.conversations add column qa_score numeric/i);
    expect(sql).toMatch(/alter table public\.conversations add column qa_flags jsonb/i);
    expect(sql).toMatch(/alter table public\.conversations add column flagged_for_review boolean/i);
    expect(sql).toMatch(/alter table public\.conversations add column intent_summary text/i);
    expect(sql).toMatch(/alter table public\.conversations add column sentiment text/i);
  });
  it("adds sentiment to messages", () => {
    expect(sql).toMatch(/alter table public\.messages add column sentiment text/i);
  });
  it("creates conversation_reviews with RLS + tenant policies", () => {
    expect(sql).toMatch(/create table public\.conversation_reviews/i);
    expect(sql).toMatch(/alter table public\.conversation_reviews enable row level security/i);
    expect(sql).toMatch(/conversation_reviews_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/conversation_reviews_insert/i);
  });
});
