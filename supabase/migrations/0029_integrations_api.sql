-- 0029: Integrations & API.
--
-- api_keys store ONLY a SHA-256 hash + a short display prefix — the raw key is
-- shown once at issue time and never persisted. outbound_webhooks subscribe to
-- events; webhook_deliveries is the append-only delivery log.

create table public.api_keys (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  prefix          text not null,
  key_hash        text not null,
  scopes          jsonb not null default '[]'::jsonb,
  rate_limit_tier text not null default 'standard',
  last_used_at    timestamptz,
  created_by      uuid references public.users(id) on delete set null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index api_keys_tenant_idx on public.api_keys (tenant_id);
create index api_keys_hash_idx on public.api_keys (key_hash);

create table public.outbound_webhooks (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  url           text not null,
  events        jsonb not null default '[]'::jsonb,
  secret        text not null,
  enabled       boolean not null default true,
  failure_count integer not null default 0,
  created_at    timestamptz not null default now()
);
create index outbound_webhooks_tenant_idx on public.outbound_webhooks (tenant_id);

create table public.webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  webhook_id    uuid references public.outbound_webhooks(id) on delete set null,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  event         text not null,
  status        text not null check (status in ('delivered','failed')),
  response_code integer,
  attempts      integer not null default 1,
  delivered_at  timestamptz not null default now()
);
create index webhook_deliveries_tenant_idx on public.webhook_deliveries (tenant_id, delivered_at);

-- RLS ----------------------------------------------------------------------
alter table public.api_keys enable row level security;
alter table public.outbound_webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy api_keys_select on public.api_keys
  for select using (tenant_id in (select public.current_user_tenants()));
create policy outbound_webhooks_select on public.outbound_webhooks
  for select using (tenant_id in (select public.current_user_tenants()));
create policy outbound_webhooks_insert on public.outbound_webhooks
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy webhook_deliveries_select on public.webhook_deliveries
  for select using (tenant_id in (select public.current_user_tenants()));

create or replace function public.prevent_webhook_deliveries_mutation()
returns trigger language plpgsql as $$
begin raise exception 'webhook_deliveries is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger webhook_deliveries_immutable
  before update or delete on public.webhook_deliveries
  for each row execute function public.prevent_webhook_deliveries_mutation();
