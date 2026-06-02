-- Epic 6 — Dispatch adapter layer config.
--
-- (a) AutoCab base URL: the per-tenant AutoCab instance endpoint (PRD §7.6.1).
--     Non-secret, so a plain column on tenants (the subscription KEY is the
--     secret and lives in the vault — see below).
alter table public.tenants
  add column if not exists dispatch_base_url text;

-- (b) Store the AutoCab subscription key in the EXISTING channel_credentials
--     vault. Dispatch credentials are tenant-scoped, not channel-scoped, and
--     channel_credentials.channel_id is nullable — so a dispatch key is stored
--     with channel_id = NULL and credential_type = 'autocab_subscription_key',
--     reusing vault_store_credential_rpc / vault_read_credential_rpc (no new
--     table or RPC). Extend the allow-list by dropping + re-adding the CHECK
--     (same pattern as migration 0013).
alter table public.channel_credentials
  drop constraint if exists channel_credentials_credential_type_check;

alter table public.channel_credentials
  add constraint channel_credentials_credential_type_check
  check (credential_type in (
    -- send tokens (0008)
    'whatsapp_token','telegram_token','messenger_token','instagram_token','widget_secret',
    -- inbound verify secrets (0013)
    'meta_app_secret','telegram_webhook_secret','widget_signing_key','meta_verify_token',
    -- dispatch secrets (Epic 6)
    'autocab_subscription_key'
  ));
