-- 0043: Make validate_coupon honour applies_to.
--
-- The tenant-facing validator (0039) returned a percent for ANY active,
-- tenant_redeemable coupon, ignoring applies_to — so a subscription-only coupon
-- could be applied to a credit top-up. Add an optional applies_to context: when
-- supplied, the coupon must target that context (or be 'both'). The credit
-- checkout passes 'credit'. Default null preserves the old context-free behaviour
-- for any 1-arg caller.

drop function if exists public.validate_coupon(text);

create or replace function public.validate_coupon(p_code text, p_applies_to text default null)
returns integer language sql stable security definer set search_path = public as $$
  select c.percent_off
  from public.coupons c
  where upper(c.code) = upper(p_code)
    and c.active
    and c.tenant_redeemable
    and (c.expires_at is null or c.expires_at > now())
    and (c.max_redemptions is null or c.times_redeemed < c.max_redemptions)
    and (p_applies_to is null or c.applies_to in (p_applies_to, 'both'))
  limit 1;
$$;

-- Re-apply the 0041 hardening to the new signature (the 1-arg grant is gone).
revoke execute on function public.validate_coupon(text, text) from public, anon;
grant execute on function public.validate_coupon(text, text) to authenticated, service_role;
