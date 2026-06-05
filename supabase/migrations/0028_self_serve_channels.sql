-- 0028: Self-serve channels.
--
-- Additive provisioning state on channels (existing 0005 RLS covers reads/writes
-- by tenant). Existing channels default to 'approved' so nothing breaks.
-- platform_apps is a global FlowMo-owned table (WhatsApp BSP / Meta app config).

alter table public.channels add column created_by uuid references public.users(id) on delete set null;
alter table public.channels add column provisioning_status text not null default 'approved' check (provisioning_status in ('pending_review','approved','rejected'));
alter table public.channels add column is_self_serve boolean not null default false;
create index channels_provisioning_idx on public.channels (provisioning_status);

create table public.platform_apps (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  identifier    text not null,
  credentials_ref text,
  status        text not null default 'active' check (status in ('active','disabled')),
  created_at    timestamptz not null default now()
);

-- platform_apps is global FlowMo config: service_role only (RLS on, no policy).
alter table public.platform_apps enable row level security;
