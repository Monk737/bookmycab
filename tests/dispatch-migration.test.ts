import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0014_dispatch_config.sql"),
  "utf8",
);

describe("0014_dispatch_config migration", () => {
  it("adds the dispatch_base_url column to tenants", () => {
    expect(sql).toMatch(/alter table public\.tenants\s+add column if not exists dispatch_base_url text/i);
  });
  it("re-adds the credential_type CHECK including autocab_subscription_key", () => {
    expect(sql).toMatch(/drop constraint if exists channel_credentials_credential_type_check/i);
    expect(sql).toMatch(/autocab_subscription_key/);
  });
  it("preserves the existing credential types in the new CHECK", () => {
    for (const t of [
      "whatsapp_token",
      "telegram_token",
      "messenger_token",
      "instagram_token",
      "widget_secret",
      "meta_app_secret",
      "telegram_webhook_secret",
      "widget_signing_key",
      "meta_verify_token",
    ]) {
      expect(sql).toContain(t);
    }
  });
});
