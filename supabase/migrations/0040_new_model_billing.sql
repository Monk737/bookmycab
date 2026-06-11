-- 0040: New-model billing (Chat / Voice / Double Decker), GBP, rolling-monthly.
--
-- Additive + coexists with the legacy plan_band model: existing tenants are
-- grandfathered (plan_band kept, commercial_model null). New tenants set
-- commercial_model and get chat_subscriptions / voice_subscriptions rows.
-- All new-model charges are in GBP. Bundle = two subscriptions whose
-- monthly_price_gbp components are authored to sum to the advertised total.

-- Chat subscription: operational config + the GBP charge amount.
create table public.chat_subscriptions (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  plan_tier              text not null check (plan_tier in ('ignition','in_motion','full_throttle')),
  channel_mode           text not null check (channel_mode in ('single','bundle')),
  monthly_price_gbp      numeric(10,2) not null check (monthly_price_gbp >= 0),
  status                 text not null default 'active' check (status in ('active','paused','cancelled')),
  current_period_start   date,
  current_period_end     date,
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.chat_subscriptions enable row level security;
create policy chat_subscriptions_select on public.chat_subscriptions
  for select using (tenant_id in (select public.current_user_tenants()));
-- Writes via service_role (provisioning/billing); no tenant write policy.

-- Voice subscription gains its GBP charge amount (R1 had allowance, not price).
alter table public.voice_subscriptions
  add column monthly_price_gbp numeric(10,2) check (monthly_price_gbp is null or monthly_price_gbp >= 0);

-- Tenant commercial model marker; legacy tenants stay null.
alter table public.tenants
  add column commercial_model text check (commercial_model in ('chat','voice','double_decker'));

-- Legacy plan_band no longer mandatory (new tenants leave it null).
alter table public.tenants alter column plan_band drop not null;
