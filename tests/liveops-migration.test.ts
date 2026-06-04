// tests/liveops-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0023_live_ops.sql"), "utf8");

describe("0023 live ops migration", () => {
  it("adds takeover columns to conversations", () => {
    expect(sql).toMatch(/alter table public\.conversations add column takeover_status text/i);
    expect(sql).toMatch(/alter table public\.conversations add column assigned_to uuid/i);
    expect(sql).toMatch(/alter table public\.conversations add column takeover_at timestamptz/i);
    expect(sql).toMatch(/alter table public\.conversations add column last_human_reply_at timestamptz/i);
  });
  it("adds provenance columns to messages", () => {
    expect(sql).toMatch(/alter table public\.messages add column source text/i);
    expect(sql).toMatch(/alter table public\.messages add column sent_by_user_id uuid/i);
  });
  it("defaults takeover_status to bot with a check constraint", () => {
    expect(sql).toMatch(/takeover_status text .*default 'bot'/i);
    expect(sql).toMatch(/check .*'bot'.*'requested'.*'human'/i);
  });
});
