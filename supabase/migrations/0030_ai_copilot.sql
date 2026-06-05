-- 0030: AI copilot.
--
-- Append-only log of copilot Q&A exchanges (mirrors usage_events immutability).
-- tokens/cost_micros feed the ai_copilot metering reconciliation.

create table public.copilot_messages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  question    text not null,
  answer      text not null,
  intent      text,
  tokens      integer not null default 0,
  cost_micros bigint,
  created_at  timestamptz not null default now()
);
create index copilot_messages_tenant_idx on public.copilot_messages (tenant_id, created_at);

alter table public.copilot_messages enable row level security;

create policy copilot_messages_select on public.copilot_messages
  for select using (tenant_id in (select public.current_user_tenants()));

create or replace function public.prevent_copilot_messages_mutation()
returns trigger language plpgsql as $$
begin raise exception 'copilot_messages is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger copilot_messages_immutable
  before update or delete on public.copilot_messages
  for each row execute function public.prevent_copilot_messages_mutation();
