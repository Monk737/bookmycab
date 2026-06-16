-- 0066_chat_briefings.sql
--
-- Weekly AI Chat briefing — one LLM-written narrative per tenant per week over
-- the week's WhatsApp Chatbot aggregates (conversations + bookings). Mirrors
-- voice_briefings: narrative fields come from the model, `metrics` stores the
-- deterministic figures the prose was grounded in (so the dashboard never shows
-- hallucinated numbers). Tenant-readable; writes are service-role only.

create table public.chat_briefings (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  period_start   date not null,
  period_end     date not null,
  headline       text not null,
  narrative      text not null,
  recommendation text,
  metrics        jsonb not null default '{}'::jsonb,
  model          text,
  created_at     timestamptz not null default now()
);

create index chat_briefings_tenant_idx on public.chat_briefings (tenant_id, created_at desc);
create unique index chat_briefings_period_uniq on public.chat_briefings (tenant_id, period_start);

alter table public.chat_briefings enable row level security;
create policy chat_briefings_select on public.chat_briefings
  for select using (tenant_id in (select public.current_user_tenants()));
