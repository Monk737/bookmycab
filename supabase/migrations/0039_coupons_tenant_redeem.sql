-- 0039: Tenant-redeemable coupons (D6).
--
-- Existing coupons (0033) are admin-provisioning percent-off. This lets an admin
-- opt a coupon in for tenant self-serve (tenant_redeemable) and lets a coupon
-- discount a credit top-up (applies_to='credit'). Tenants validate a code via the
-- validate_coupon() RPC (never a blanket SELECT). coupon_redemptions is the audit.

alter table public.coupons add column tenant_redeemable boolean not null default false;
alter table public.coupons drop constraint if exists coupons_applies_to_check;
alter table public.coupons add constraint coupons_applies_to_check
  check (applies_to in ('both','setup','subscription','credit'));

create table public.coupon_redemptions (
  id                       uuid primary key default gen_random_uuid(),
  coupon_id                uuid not null references public.coupons(id) on delete cascade,
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  applied_to               text not null check (applied_to in ('subscription','setup','credit_topup')),
  amount_discounted_micros bigint,
  currency                 text check (currency in ('GBP','EUR','USD')),
  stripe_ref               text,
  redeemed_at              timestamptz not null default now()
);
create index coupon_redemptions_tenant_idx on public.coupon_redemptions (tenant_id, redeemed_at);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);

alter table public.coupon_redemptions enable row level security;
create policy coupon_redemptions_select on public.coupon_redemptions
  for select using (tenant_id in (select public.current_user_tenants()));
-- INSERT via the checkout server action (service_role); no tenant insert policy.

-- Validate a code WITHOUT exposing the coupons table. Returns the usable
-- percent_off, or NULL if the coupon is missing/inactive/not tenant-redeemable/
-- expired/over its redemption cap.
create or replace function public.validate_coupon(p_code text)
returns integer language sql stable security definer set search_path = public as $$
  select c.percent_off
  from public.coupons c
  where upper(c.code) = upper(p_code)
    and c.active
    and c.tenant_redeemable
    and (c.expires_at is null or c.expires_at > now())
    and (c.max_redemptions is null or c.times_redeemed < c.max_redemptions)
  limit 1;
$$;
