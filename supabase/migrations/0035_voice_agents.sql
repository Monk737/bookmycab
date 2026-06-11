-- 0035: Voice agents (two-product model).
--
-- A Voice agent IS an automation (type='Voice'), reusing engine controls,
-- status, and usage_events.automation_id. voice_subscriptions holds the
-- per-tenant SHARED monthly call pool (D3); voice_agents holds per-agent detail.

-- Widen automations.type to include 'Voice' (additive; existing rows unaffected).
alter table public.automations drop constraint if exists automations_type_check;
alter table public.automations add constraint automations_type_check
  check (type in ('Booking','Support','Driver','Custom','Voice'));

-- Per-tenant Voice subscription = the shared monthly call allowance pool.
create table public.voice_subscriptions (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  plan_tier              text not null check (plan_tier in ('ignition','in_motion','full_throttle')),
  monthly_call_allowance integer not null check (monthly_call_allowance >= 0),
  included_agents        integer not null check (included_agents >= 0),
  status                 text not null default 'active' check (status in ('active','paused','cancelled')),
  current_period_start   date,
  current_period_end     date,
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Per-agent Voice detail (1:1 with a type='Voice' automation).
create table public.voice_agents (
  automation_id    uuid primary key references public.automations(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  display_name     text not null,
  phone_number     text,
  phone_number_ref text,
  created_at       timestamptz not null default now()
);
create index voice_agents_tenant_idx on public.voice_agents (tenant_id);

-- RLS: tenant may read its own rows; writes go through service_role (no write policy).
alter table public.voice_subscriptions enable row level security;
alter table public.voice_agents enable row level security;

create policy voice_subscriptions_select on public.voice_subscriptions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy voice_agents_select on public.voice_agents
  for select using (tenant_id in (select public.current_user_tenants()));
