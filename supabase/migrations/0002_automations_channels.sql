-- Automations (one or more per tenant)
create table public.automations (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  name               text not null,
  type               text not null check (type in ('Booking','Support','Driver','Custom')),
  engine_workflow_id text,   -- internal engine reference id (never surfaced)
  engine_project_id  text,   -- internal engine project id (never surfaced)
  status             text not null default 'building' check (status in ('building','uat','live','stopped','error')),
  dispatch_adapter   text check (dispatch_adapter in ('autocab','icabbi','cordic')),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index automations_tenant_idx on public.automations (tenant_id);

-- Channels (each bound to exactly one automation)
create table public.channels (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  automation_id    uuid not null references public.automations(id) on delete cascade,
  type             text not null check (type in ('whatsapp','telegram','messenger','instagram','widget')),
  external_id      text,
  webhook_path     text not null,
  credentials_ref  text,            -- vault reference; never the credential itself
  status           text not null default 'active' check (status in ('active','error','disconnected')),
  token_expires_at timestamptz,
  last_message_at  timestamptz,
  created_at       timestamptz default now()
);
create index channels_automation_idx on public.channels (automation_id);
create index channels_tenant_idx on public.channels (tenant_id);
