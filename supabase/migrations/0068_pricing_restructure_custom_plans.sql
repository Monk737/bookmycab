-- 0068: Pricing restructure — three offerings (WhatsApp Suite, Voice Ignition,
-- Custom) + admin-configurable custom plans. Additive + backward-compatible:
-- legacy 'double_decker' and tier values stay valid for grandfathered rows.

-- 1. Widen tenants.commercial_model to allow 'custom' (keep legacy values).
alter table public.tenants drop constraint if exists tenants_commercial_model_check;
alter table public.tenants add constraint tenants_commercial_model_check
  check (commercial_model in ('chat','voice','double_decker','custom'));

-- 2. Plan-type marker (which of the three offerings). Null for legacy tenants.
alter table public.tenants
  add column if not exists plan_type text
  check (plan_type is null or plan_type in ('whatsapp_suite','voice_ignition','custom'));

-- 3. Allow 'custom' as a plan_tier on both subscription tables.
alter table public.voice_subscriptions drop constraint if exists voice_subscriptions_plan_tier_check;
alter table public.voice_subscriptions add constraint voice_subscriptions_plan_tier_check
  check (plan_tier in ('ignition','in_motion','full_throttle','custom'));
alter table public.chat_subscriptions drop constraint if exists chat_subscriptions_plan_tier_check;
alter table public.chat_subscriptions add constraint chat_subscriptions_plan_tier_check
  check (plan_tier in ('ignition','in_motion','full_throttle','custom'));

-- 4. Store the activation invoice's hosted pay link on the setup_fees row
--    (the activation invoice == setup + first period).
alter table public.setup_fees add column if not exists hosted_invoice_url text;

-- 5. Custom plan detail (one row per custom-plan tenant).
create table if not exists public.custom_plans (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  plan_name              text not null,
  billing_mode           text not null check (billing_mode in ('recurring','one_time')),
  includes_chat          boolean not null default false,
  includes_voice         boolean not null default true,
  monthly_call_allowance integer not null default 0 check (monthly_call_allowance >= 0),
  included_agents        integer not null default 1 check (included_agents >= 0),
  price_per_call_gbp     numeric(10,4),
  plan_price_gbp         numeric(10,2) not null check (plan_price_gbp >= 0),
  chat_monthly_gbp       numeric(10,2) check (chat_monthly_gbp is null or chat_monthly_gbp >= 0),
  setup_fee_gbp          numeric(10,2) not null default 0 check (setup_fee_gbp >= 0),
  validity_days          integer not null default 30 check (validity_days > 0),
  extra_credit_price_gbp numeric(10,4) not null default 0.90 check (extra_credit_price_gbp >= 0),
  starts_at              date,
  expires_at             date,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.custom_plans enable row level security;
-- Tenant may read its own custom plan; all writes go via service_role.
create policy custom_plans_select on public.custom_plans
  for select using (tenant_id in (select public.current_user_tenants()));
