-- 0048: service-side credit balance for the voice pre-call gate.
--
-- public.credit_balance(p_tenant) is session-scoped: it filters by
-- current_user_tenants(), so it returns 0 when called with the service-role key
-- (no user JWT). The /api/voice/calls/authorize gate runs server-to-server, so
-- it needs an unfiltered read — same semantics record_voice_call already uses
-- internally. Locked to service_role only.

create or replace function public.service_credit_balance(p_tenant uuid)
returns bigint
language sql stable security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::bigint
  from public.credit_ledger
  where tenant_id = p_tenant;
$$;

revoke execute on function public.service_credit_balance(uuid) from public, anon, authenticated;
grant execute on function public.service_credit_balance(uuid) to service_role;
