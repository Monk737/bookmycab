-- Vault RPC wrappers — make the locked-down vault callable through PostgREST.
--
-- The Task-1 vault functions (vault_store_credential / vault_read_credential,
-- migration 0008) read the encryption key from the `app.vault_key` GUC via
-- current_setting('app.vault_key', true). That works when the caller sets the
-- GUC on the SAME session before calling (as the pg-harness tests do).
--
-- The app, however, calls these via the Supabase JS service-role client, i.e.
-- PostgREST `.rpc(...)`. PostgREST runs every request on its own pooled
-- connection inside its own transaction, so a separate `set_config(...)` call
-- cannot reliably share a session with a following `.rpc(...)`. A role-level
-- `ALTER ROLE ... SET app.vault_key` would work but bakes the secret into DB
-- config (and reduces key-rotation to a migration).
--
-- These wrapper functions take the key as a parameter and `set_config(..., true)`
-- (transaction-local) in the SAME function body, immediately before delegating
-- to the inner vault function. Because it's one PostgREST call = one
-- transaction, the inner current_setting() sees the key. The app holds the key
-- in a server-only env var (SUPABASE_VAULT_KEY) and passes it per call; it is
-- never logged and never returned. The key stays out of the schema/DB config.
--
-- Security: the wrappers are SECURITY INVOKER (default) and delegate to the
-- SECURITY DEFINER inner functions, which already enforce
--   current_user in ('postgres','service_role','supabase_admin')
-- So even though we grant EXECUTE narrowly here, the inner caller-role guard is
-- the real gate — anon/authenticated calling a wrapper still hits that raise.
-- We additionally revoke EXECUTE from PUBLIC and from anon/authenticated, and
-- set_config(..., true) keeps the key transaction-local (auto-reset at commit).

create or replace function public.vault_store_credential_rpc(
  p_tenant_id uuid,
  p_channel_id uuid,
  p_credential_type text,
  p_secret text,
  p_created_by uuid,
  p_key text
) returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  -- transaction-local: shares this PostgREST request's transaction with the
  -- delegate call below, then auto-resets at commit. Never persisted.
  perform set_config('app.vault_key', p_key, true);
  return public.vault_store_credential(
    p_tenant_id, p_channel_id, p_credential_type, p_secret, p_created_by
  );
end;
$$;

create or replace function public.vault_read_credential_rpc(
  p_id uuid,
  p_accessed_by uuid,
  p_key text
) returns text
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  perform set_config('app.vault_key', p_key, true);
  return public.vault_read_credential(p_id, p_accessed_by);
end;
$$;

-- Rotate: re-encrypt a NEW secret onto an EXISTING credential row, preserving
-- the row id / created_at / credential_type. The Task-1 vault has no in-place
-- update function and pgcrypto is only reachable here, so this wrapper performs
-- the same caller-role + key guard as the inner vault functions and updates the
-- ciphertext directly. SECURITY DEFINER (it writes the bytea column itself), with
-- the explicit current_user guard so it stays service-role-only like its peers.
create or replace function public.vault_rotate_credential_rpc(
  p_id uuid,
  p_secret text,
  p_key text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'access denied: vault functions are service-role only';
  end if;
  if p_key is null or p_key = '' then
    raise exception 'vault encryption key is not provided';
  end if;
  update public.channel_credentials
    set secret_encrypted = pgp_sym_encrypt(p_secret, p_key)
  where id = p_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'credential % not found', p_id;
  end if;
  return true;
end;
$$;

-- Lock down EXECUTE: revoke the default PUBLIC grant, then revoke from tenant
-- roles. service_role / postgres / supabase_admin retain it (and the inner
-- functions re-check current_user regardless).
revoke execute on function public.vault_store_credential_rpc(uuid, uuid, text, text, uuid, text) from public;
revoke execute on function public.vault_read_credential_rpc(uuid, uuid, text) from public;
revoke execute on function public.vault_rotate_credential_rpc(uuid, text, text) from public;
revoke all on function public.vault_store_credential_rpc(uuid, uuid, text, text, uuid, text) from anon, authenticated;
revoke all on function public.vault_read_credential_rpc(uuid, uuid, text) from anon, authenticated;
revoke all on function public.vault_rotate_credential_rpc(uuid, text, text) from anon, authenticated;
