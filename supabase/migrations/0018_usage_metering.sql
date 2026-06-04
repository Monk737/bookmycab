-- 0018: Usage metering & quota counters.
--
-- usage_events is the append-only source of truth (one row per metered action);
-- usage_counters is a per-tenant/feature/period rollup for fast quota checks.
-- Mirrors the audit_log immutability approach from 0011.

create table public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  feature_key   text not null references public.features(key) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  quantity      bigint not null default 1,
  unit          text,
  cost_micros   bigint,
  metadata      jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);
create index usage_events_tenant_feature_idx on public.usage_events (tenant_id, feature_key, occurred_at);

create table public.usage_counters (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  feature_key  text not null references public.features(key) on delete cascade,
  period_start date not null,
  period_end   date not null,
  used         bigint not null default 0,
  limit_amount bigint,
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, feature_key, period_start)
);

alter table public.usage_events enable row level security;
alter table public.usage_counters enable row level security;

create policy usage_events_select on public.usage_events
  for select using (tenant_id in (select public.current_user_tenants()));
create policy usage_counters_select on public.usage_counters
  for select using (tenant_id in (select public.current_user_tenants()));

-- usage_events is append-only: block UPDATE/DELETE for everyone (incl.
-- service_role / table owners — triggers fire regardless of RLS bypass),
-- mirroring 0011's audit_log immutability.
create or replace function public.prevent_usage_events_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'usage_events is append-only; UPDATE/DELETE is not permitted';
end;
$$;

create trigger usage_events_immutable
  before update or delete on public.usage_events
  for each row execute function public.prevent_usage_events_mutation();
