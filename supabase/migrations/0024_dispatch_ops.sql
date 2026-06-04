-- 0024: Dispatch & fulfilment ops.
--
-- dispatch_attempts is the append-only record of every call to a dispatch
-- adapter (mirrors usage_events immutability from 0018). adapter_status is a
-- global health cache. dispatch_mode lets an automation run sandbox vs live.

create table public.dispatch_attempts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  booking_id    uuid references public.bookings(id) on delete set null,
  adapter       text not null,
  operation     text not null default 'create',
  status        text not null check (status in ('success','failed','retrying')),
  latency_ms    integer,
  attempt_no    integer not null default 1,
  request       jsonb,
  response      jsonb,
  error         text,
  created_at    timestamptz not null default now()
);
create index dispatch_attempts_tenant_idx on public.dispatch_attempts (tenant_id, created_at);
create index dispatch_attempts_booking_idx on public.dispatch_attempts (booking_id);

create table public.adapter_status (
  adapter       text primary key,
  healthy       boolean not null default true,
  latency_p95_ms integer,
  last_check    timestamptz not null default now()
);

alter table public.automations add column dispatch_mode text not null default 'live' check (dispatch_mode in ('sandbox','live'));
alter table public.bookings add column quoted_fare numeric(10,2);

-- RLS ----------------------------------------------------------------------
alter table public.dispatch_attempts enable row level security;
alter table public.adapter_status enable row level security;

create policy dispatch_attempts_select on public.dispatch_attempts
  for select using (tenant_id in (select public.current_user_tenants()));

-- adapter_status is global platform health: authenticated read, service_role write.
create policy adapter_status_select on public.adapter_status
  for select using (auth.uid() is not null);

-- dispatch_attempts is append-only (block UPDATE/DELETE for everyone incl. service_role).
create or replace function public.prevent_dispatch_attempts_mutation()
returns trigger language plpgsql as $$
begin raise exception 'dispatch_attempts is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger dispatch_attempts_immutable
  before update or delete on public.dispatch_attempts
  for each row execute function public.prevent_dispatch_attempts_mutation();
