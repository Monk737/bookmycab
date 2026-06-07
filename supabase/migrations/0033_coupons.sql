-- 0033: Discount coupons for tenant provisioning.
--
-- Admin-applied percentage discounts used when provisioning a tenant. A coupon
-- reduces the setup fee and/or monthly subscription by `percent_off`. A 100%-off
-- coupon fully comps the tenant: the createTenant flow marks it active, records a
-- paid (zero) setup fee + a comp subscription, sets tenants.billing_bypass, and
-- the Stripe actions (setup-fee invoice / start-subscription) refuse to run.
--
-- Global, FlowMo-admin-only table: RLS enabled with NO policy (default-deny),
-- mirroring platform_apps (0028) / platform_senders (0031). All access is via the
-- service-role client in admin server actions, which bypasses RLS.

create table public.coupons (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,                 -- stored upper-cased by the app
  description     text,
  percent_off     integer not null check (percent_off between 1 and 100),
  applies_to      text not null default 'both' check (applies_to in ('both','setup','subscription')),
  max_redemptions integer check (max_redemptions is null or max_redemptions > 0),
  times_redeemed  integer not null default 0,
  active          boolean not null default true,
  expires_at      timestamptz,
  created_by      uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.coupons enable row level security;

-- Tenant-level discount linkage (set at provisioning time).
alter table public.tenants add column coupon_code text;
alter table public.tenants add column discount_percent integer not null default 0
  check (discount_percent between 0 and 100);
-- True only for a 100%-off comp: signals the Stripe billing actions to no-op.
alter table public.tenants add column billing_bypass boolean not null default false;
