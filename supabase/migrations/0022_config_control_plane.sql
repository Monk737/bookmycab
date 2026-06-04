-- 0022: Bot config control plane — versioning, fare rules, guardrails.
--
-- automation_config (0015) stays the CURRENT LIVE config the engine reads.
-- config_versions are snapshots (draft → published); publishing copies the
-- snapshot into automation_config. fare_rules price journeys per vehicle.
-- config_guardrails are admin-set bounds enforced at publish time.

create table public.config_versions (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  version       integer not null,
  config        jsonb not null,
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  change_note   text,
  created_by    uuid references public.users(id) on delete set null,
  published_by  uuid references public.users(id) on delete set null,
  published_at  timestamptz,
  synced_to_engine_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (automation_id, version)
);
create index config_versions_automation_idx on public.config_versions (automation_id, version);

create table public.fare_rules (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  automation_id    uuid not null references public.automations(id) on delete cascade,
  vehicle_type     text not null,
  base_fare        numeric(10,2) not null default 0,
  per_mile         numeric(10,2) not null default 0,
  per_min          numeric(10,2) not null default 0,
  min_fare         numeric(10,2) not null default 0,
  airport_surcharge numeric(10,2) not null default 0,
  currency         text not null default 'GBP',
  updated_at       timestamptz not null default now(),
  unique (automation_id, vehicle_type)
);
create index fare_rules_automation_idx on public.fare_rules (automation_id);

create table public.config_guardrails (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  field         text not null,
  locked        boolean not null default false,
  min_value     numeric,
  max_value     numeric,
  updated_at    timestamptz not null default now(),
  unique (automation_id, field)
);
create index config_guardrails_automation_idx on public.config_guardrails (automation_id);

alter table public.automation_config add column current_version_id uuid references public.config_versions(id) on delete set null;

-- RLS ----------------------------------------------------------------------
alter table public.config_versions enable row level security;
alter table public.fare_rules enable row level security;
alter table public.config_guardrails enable row level security;

-- config_versions: tenant read + draft writes; publish/archive via service_role.
create policy config_versions_select on public.config_versions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy config_versions_insert on public.config_versions
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy config_versions_update on public.config_versions
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy config_versions_delete on public.config_versions
  for delete using (tenant_id in (select public.current_user_tenants()));

-- fare_rules: tenant-editable config.
create policy fare_rules_select on public.fare_rules
  for select using (tenant_id in (select public.current_user_tenants()));
create policy fare_rules_insert on public.fare_rules
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy fare_rules_update on public.fare_rules
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy fare_rules_delete on public.fare_rules
  for delete using (tenant_id in (select public.current_user_tenants()));

-- config_guardrails: admin-managed (service_role writes). Tenants may READ their
-- own automations' guardrails (UI greys out locked fields).
create policy config_guardrails_select on public.config_guardrails
  for select using (
    exists (
      select 1 from public.automations a
      where a.id = config_guardrails.automation_id
        and a.tenant_id in (select public.current_user_tenants())
    )
  );
