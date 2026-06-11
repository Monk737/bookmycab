-- 0036: Calls (AI Voice analytics detail, append-only).
--
-- One row per completed call, attributed to a Voice agent (automation_id).
-- This is the analytics source for per-agent + aggregate charts (D7). Billing
-- truth lives in usage_events (plan pool) and credit_ledger (top-ups).

create table public.calls (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  automation_id   uuid not null references public.automations(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  caller_number   text,
  agent_number    text,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_s      integer check (duration_s is null or duration_s >= 0),
  outcome         text not null default 'unknown'
                    check (outcome in ('booked','quoted','abandoned','transferred','failed','no_credit','unknown')),
  credit_source   text not null default 'plan' check (credit_source in ('plan','topup','none')),
  credit_charged  integer not null default 1 check (credit_charged >= 0),
  raw_engine_json jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index calls_tenant_started_idx on public.calls (tenant_id, started_at);
create index calls_automation_idx     on public.calls (automation_id, started_at);

alter table public.calls enable row level security;
create policy calls_select on public.calls
  for select using (tenant_id in (select public.current_user_tenants()));

-- Append-only: a completed call is immutable history.
create or replace function public.prevent_calls_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'calls is append-only; UPDATE/DELETE is not permitted';
end;
$$;
create trigger calls_immutable
  before update or delete on public.calls
  for each row execute function public.prevent_calls_mutation();
