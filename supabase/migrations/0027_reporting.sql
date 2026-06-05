-- 0027: Reporting & white-label.
--
-- report_definitions are tenant-editable report configs; report_runs is the
-- append-only history (mirrors usage_events immutability). tenants.branding
-- holds logo + colours for white-labeled output.

create table public.report_definitions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  metrics     jsonb not null default '[]'::jsonb,
  filters     jsonb not null default '{}'::jsonb,
  schedule    text,
  format      text not null default 'json' check (format in ('json','csv','pdf')),
  recipients  jsonb not null default '[]'::jsonb,
  white_label boolean not null default false,
  enabled     boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index report_definitions_tenant_idx on public.report_definitions (tenant_id);

create table public.report_runs (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid references public.report_definitions(id) on delete set null,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  status       text not null check (status in ('success','failed')),
  payload      jsonb,
  file_ref     text,
  error        text,
  generated_at timestamptz not null default now()
);
create index report_runs_tenant_idx on public.report_runs (tenant_id, generated_at);

alter table public.tenants add column branding jsonb not null default '{}'::jsonb;

-- RLS ----------------------------------------------------------------------
alter table public.report_definitions enable row level security;
alter table public.report_runs enable row level security;

create policy report_definitions_select on public.report_definitions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy report_definitions_insert on public.report_definitions
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy report_definitions_update on public.report_definitions
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy report_definitions_delete on public.report_definitions
  for delete using (tenant_id in (select public.current_user_tenants()));

create policy report_runs_select on public.report_runs
  for select using (tenant_id in (select public.current_user_tenants()));

create or replace function public.prevent_report_runs_mutation()
returns trigger language plpgsql as $$
begin raise exception 'report_runs is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger report_runs_immutable
  before update or delete on public.report_runs
  for each row execute function public.prevent_report_runs_mutation();
