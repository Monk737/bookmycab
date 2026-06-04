// tests/alerting-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0020_alerting.sql"), "utf8");

describe("0020 alerting migration", () => {
  it("creates the four tables", () => {
    expect(sql).toMatch(/create table public\.alert_rules/i);
    expect(sql).toMatch(/create table public\.notification_channels/i);
    expect(sql).toMatch(/create table public\.alert_events/i);
    expect(sql).toMatch(/create table public\.notification_log/i);
  });
  it("makes alert_events and notification_log append-only", () => {
    expect(sql).toMatch(/create trigger alert_events_immutable/i);
    expect(sql).toMatch(/create trigger notification_log_immutable/i);
  });
  it("enables RLS + tenant-scoped select on all four", () => {
    for (const t of ["alert_rules", "notification_channels", "alert_events", "notification_log"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    }
    expect(sql).toMatch(/alert_rules_select[\s\S]*current_user_tenants\(\)/i);
  });
  it("scopes tenant writes on alert_rules + notification_channels", () => {
    expect(sql).toMatch(/alert_rules_insert/i);
    expect(sql).toMatch(/notification_channels_insert/i);
  });
});
