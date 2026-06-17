// tests/prompt-tuning-migration.test.ts
// Structural assertions for 0067 prompt-tuning tables. Runtime behaviour is
// verified out-of-band at apply time; this guards the contract the app code
// relies on (column names, statuses, RLS shape).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0067_prompt_tuning.sql"),
  "utf8",
);

describe("0067 prompt tuning", () => {
  it("creates prompt_suggestions with the handoff lifecycle", () => {
    expect(sql).toMatch(/create table public\.prompt_suggestions/i);
    expect(sql).toMatch(/status\s+text not null default 'draft'/i);
    expect(sql).toMatch(/check \(status in \('draft','requested','applied','dismissed','superseded'\)\)/i);
    expect(sql).toMatch(/evidence_call_ids\s+uuid\[\]/i);
    expect(sql).toMatch(/old_prompt\s+text not null/i);
    expect(sql).toMatch(/new_prompt\s+text not null/i);
    expect(sql).toMatch(/operator_note\s+text/i);
    expect(sql).toMatch(/requested_by\s+uuid/i);
  });

  it("keeps only one open suggestion per agent + reason", () => {
    expect(sql).toMatch(/create unique index prompt_suggestions_open_uniq[\s\S]*\(automation_id, reason\)[\s\S]*where status in \('draft','requested'\)/i);
  });

  it("creates prompt_revisions as a versioned, reversible trail", () => {
    expect(sql).toMatch(/create table public\.prompt_revisions/i);
    expect(sql).toMatch(/revision\s+integer not null/i);
    expect(sql).toMatch(/kind\s+text not null default 'apply'[\s\S]*check \(kind in \('apply','rollback'\)\)/i);
    expect(sql).toMatch(/status\s+text not null default 'active'[\s\S]*check \(status in \('active','superseded','rolled_back'\)\)/i);
    expect(sql).toMatch(/parent_revision_id\s+uuid references public\.prompt_revisions/i);
    expect(sql).toMatch(/baseline_flagged_rate\s+numeric/i);
    expect(sql).toMatch(/measured_flagged_rate\s+numeric/i);
    expect(sql).toMatch(/create unique index prompt_revisions_assistant_rev_uniq on public\.prompt_revisions \(vapi_assistant_id, revision\)/i);
  });

  it("enables RLS with tenant select + no write policy on both tables", () => {
    expect(sql).toMatch(/alter table public\.prompt_suggestions enable row level security/i);
    expect(sql).toMatch(/alter table public\.prompt_revisions enable row level security/i);
    expect(sql).toMatch(/create policy prompt_suggestions_select on public\.prompt_suggestions[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/create policy prompt_revisions_select on public\.prompt_revisions[\s\S]*current_user_tenants\(\)/i);
    // No write policies → writes are service-role only.
    expect(sql).not.toMatch(/create policy[\s\S]*?for (insert|update|delete)/i);
  });
});
