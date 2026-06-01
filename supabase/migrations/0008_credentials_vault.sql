-- Channel credentials vault.
-- Raw channel secrets (API keys, tokens) are stored ENCRYPTED via pgcrypto
-- symmetric PGP. The plaintext never lives in a readable column and never
-- appears in any list/SELECT response. Read/write goes exclusively through the
-- security-definer helper functions below; the app (service_role) calls those
-- functions and never handles the encryption key directly.
create extension if not exists pgcrypto with schema extensions;

create table public.channel_credentials (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  channel_id       uuid references public.channels(id) on delete cascade,
  credential_type  text not null
    check (credential_type in ('whatsapp_token','telegram_token','messenger_token','instagram_token','widget_secret')),
  secret_encrypted bytea not null,            -- pgp_sym_encrypt ciphertext; never plaintext
  created_by       uuid references public.users(id) on delete set null,
  created_at       timestamptz default now(),
  last_accessed_at timestamptz,
  last_accessed_by uuid references public.users(id) on delete set null
);
create index channel_credentials_tenant_idx on public.channel_credentials (tenant_id);
create index channel_credentials_channel_idx on public.channel_credentials (channel_id);

-- Hard-deny for tenant users (mirrors the audit_log pattern in 0005):
-- RLS enabled with NO permissive policy, and table privileges revoked from
-- anon/authenticated so any access raises "permission denied". service_role
-- bypasses RLS and retains access via the helper functions.
alter table public.channel_credentials enable row level security;
revoke all on public.channel_credentials from anon, authenticated;

-- Encryption key source: supplied at the DB session/role level via the
-- `app.vault_key` GUC (e.g. ALTER ROLE service_role SET app.vault_key = '<key>'
-- sourced from the platform's secret manager / Supabase Vault). It is NOT a
-- literal baked into this migration. Tests set it with `set app.vault_key = '...'`
-- before calling these functions.
create or replace function public.vault_store_credential(
  p_tenant_id uuid,
  p_channel_id uuid,
  p_credential_type text,
  p_secret text,
  p_created_by uuid
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := current_setting('app.vault_key', true);
  v_id uuid;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'access denied: vault functions are service-role only';
  end if;
  if v_key is null or v_key = '' then
    raise exception 'vault encryption key (app.vault_key) is not configured';
  end if;
  insert into public.channel_credentials
    (tenant_id, channel_id, credential_type, secret_encrypted, created_by)
  values
    (p_tenant_id, p_channel_id, p_credential_type,
     pgp_sym_encrypt(p_secret, v_key), p_created_by)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.vault_read_credential(
  p_id uuid,
  p_accessed_by uuid
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text := current_setting('app.vault_key', true);
  v_plain text;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'access denied: vault functions are service-role only';
  end if;
  if v_key is null or v_key = '' then
    raise exception 'vault encryption key (app.vault_key) is not configured';
  end if;
  update public.channel_credentials
    set last_accessed_at = now(),
        last_accessed_by = p_accessed_by
  where id = p_id
  returning pgp_sym_decrypt(secret_encrypted, v_key) into v_plain;
  if not found then
    raise exception 'credential % not found', p_id;
  end if;
  return v_plain;
end;
$$;

-- Helper functions are owner-only (service_role / admin). Postgres grants EXECUTE
-- to PUBLIC by default, so the per-role revokes below are not sufficient on their
-- own; we must first revoke EXECUTE from PUBLIC, then also revoke from tenant roles.
revoke execute on function public.vault_store_credential(uuid, uuid, text, text, uuid) from public;
revoke execute on function public.vault_read_credential(uuid, uuid) from public;
revoke all on function public.vault_store_credential(uuid, uuid, text, text, uuid) from anon, authenticated;
revoke all on function public.vault_read_credential(uuid, uuid) from anon, authenticated;
