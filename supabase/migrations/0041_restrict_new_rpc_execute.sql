-- 0041: Restrict the new SECURITY DEFINER RPCs to signed-in users.
--
-- credit_balance() and validate_coupon() (added in 0037/0039) are tenant
-- operations: the dashboard reads its own balance, and a tenant validates a
-- coupon at checkout. Both are SECURITY DEFINER. PostgREST exposes functions to
-- the `anon` role by default (EXECUTE granted to PUBLIC); there is no reason to
-- let unauthenticated callers probe them, so restrict EXECUTE to authenticated
-- + service_role. (credit_balance already self-gates via current_user_tenants(),
-- so this is defense-in-depth; validate_coupon should not be anon-probeable.)

revoke execute on function public.credit_balance(uuid) from public, anon;
grant execute on function public.credit_balance(uuid) to authenticated, service_role;

revoke execute on function public.validate_coupon(text) from public, anon;
grant execute on function public.validate_coupon(text) to authenticated, service_role;
