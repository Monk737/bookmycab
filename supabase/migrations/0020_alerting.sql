-- 0020: Alerting & notifications.
--
-- alert_rules + notification_channels are tenant-editable config (tenant RLS
-- write policies, like automations in 0005). alert_events + notification_log
-- are append-only history (immutability trigger like usage_events in 0018).

create table public.alert_rules (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete cascade,
  name          text not null,
  metric        text not null,                              -- key in ALERT_METRICS
  operator      text not null check (operator in ('gt','gte','lt','lte')),
  threshold     numeric not null,
  window_hours  int not null default 24 check (window_hours between 1 and 168),
  severity      text not null default 'warning' check (severity in ('info','warning','critical')),
  enabled       boolean not null default true,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index alert_rules_tenant_idx on public.alert_rules (tenant_id);

create table public.notification_channels (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  type            text not null check (type in ('email','slack','webhook')),
  destination     text not null,                            -- email address / webhook url
  enabled         boolean not null default true,
  verified        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index notification_channels_tenant_idx on public.notification_channels (tenant_id);

create table public.alert_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  rule_id     uuid not null references public.alert_rules(id) on delete cascade,
  value       numeric not null,
  status      text not null default 'firing' check (status in ('firing','acked','resolved')),
  fired_at    timestamptz not null default now()
);
create index alert_events_tenant_idx on public.alert_events (tenant_id, fired_at);

create table public.notification_log (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  channel_id      uuid references public.notification_channels(id) on delete set null,
  alert_event_id  uuid references public.alert_events(id) on delete set null,
  type            text not null,
  status          text not null check (status in ('sent','failed','skipped')),
  error           text,
  sent_at         timestamptz not null default now()
);
create index notification_log_tenant_idx on public.notification_log (tenant_id, sent_at);

-- RLS ----------------------------------------------------------------------
alter table public.alert_rules enable row level security;
alter table public.notification_channels enable row level security;
alter table public.alert_events enable row level security;
alter table public.notification_log enable row level security;

-- Tenant-editable config (select + write), mirroring automations in 0005.
create policy alert_rules_select on public.alert_rules
  for select using (tenant_id in (select public.current_user_tenants()));
create policy alert_rules_insert on public.alert_rules
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy alert_rules_update on public.alert_rules
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy alert_rules_delete on public.alert_rules
  for delete using (tenant_id in (select public.current_user_tenants()));

create policy notification_channels_select on public.notification_channels
  for select using (tenant_id in (select public.current_user_tenants()));
create policy notification_channels_insert on public.notification_channels
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy notification_channels_update on public.notification_channels
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy notification_channels_delete on public.notification_channels
  for delete using (tenant_id in (select public.current_user_tenants()));

-- Append-only history: tenant read only; writes via service_role.
create policy alert_events_select on public.alert_events
  for select using (tenant_id in (select public.current_user_tenants()));
create policy notification_log_select on public.notification_log
  for select using (tenant_id in (select public.current_user_tenants()));

create or replace function public.prevent_alert_events_mutation()
returns trigger language plpgsql as $$
begin raise exception 'alert_events is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger alert_events_immutable
  before update or delete on public.alert_events
  for each row execute function public.prevent_alert_events_mutation();

create or replace function public.prevent_notification_log_mutation()
returns trigger language plpgsql as $$
begin raise exception 'notification_log is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger notification_log_immutable
  before update or delete on public.notification_log
  for each row execute function public.prevent_notification_log_mutation();
