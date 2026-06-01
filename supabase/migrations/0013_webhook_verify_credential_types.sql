-- Inbound webhook verification secrets live in the same vault as send tokens.
-- Extend the credential_type allow-list (Epic 3 migration 0008/0009 set the
-- original send-token set). Drop + re-add the CHECK constraint.
alter table public.channel_credentials
  drop constraint if exists channel_credentials_credential_type_check;

alter table public.channel_credentials
  add constraint channel_credentials_credential_type_check
  check (credential_type in (
    -- send tokens (existing)
    'whatsapp_token','telegram_token','messenger_token','instagram_token','widget_secret',
    -- inbound verify secrets (new in Epic 5)
    'meta_app_secret','telegram_webhook_secret','widget_signing_key','meta_verify_token'
  ));
