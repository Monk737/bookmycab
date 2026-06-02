-- Epic 7b — bot configuration + support tickets.

-- Bot configuration: one row per automation (editable by Owner/Admin in the
-- dashboard; the engine reads it on its next run). JSON columns hold the
-- per-channel/array shaped settings from PRD section 9.3.6.
create table public.automation_config (
  automation_id     uuid not null unique references public.automations(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  welcome_messages  jsonb not null default '{}'::jsonb,
  vehicle_types     jsonb not null default '[]'::jsonb,
  service_area      text,
  opening_hours     jsonb not null default '{}'::jsonb,
  brand_colours     jsonb not null default '{}'::jsonb,
  languages         jsonb not null default '["en"]'::jsonb,
  ask_driver_note   boolean not null default false,
  updated_by        uuid references public.users(id) on delete set null,
  updated_at        timestamptz not null default now(),
  primary key (automation_id)
);
create index automation_config_tenant_idx on public.automation_config (tenant_id);

-- Support tickets (tenant-facing). "Request a new automation" uses category
-- build_request and is mirrored to the internal build queue out-of-band.
create table public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  created_by    uuid references public.users(id) on delete set null,
  subject       text not null,
  category      text not null check (category in ('technical','billing','build_request','other')),
  description   text not null,
  status        text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index support_tickets_tenant_idx on public.support_tickets (tenant_id);

alter table public.automation_config enable row level security;
alter table public.support_tickets enable row level security;

-- Tenant isolation: a member of the tenant may read/write its config + tickets.
create policy automation_config_tenant on public.automation_config
  for all using (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()));

create policy support_tickets_tenant on public.support_tickets
  for all using (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()));
