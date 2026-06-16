-- Weekly AI briefing (Tier 3).
--
-- One LLM-written narrative per tenant per week, generated on a cron over the
-- week's voice aggregates. The narrative fields (headline / narrative /
-- recommendation) come from the model; `metrics` stores the deterministic
-- aggregates the briefing was grounded in, so the dashboard renders real figures
-- alongside the prose (never hallucinated numbers). Tenant-readable; writes are
-- service-role only (the generate route).

create table public.voice_briefings (
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

-- Newest-first lookup for "the latest briefing".
create index voice_briefings_tenant_idx on public.voice_briefings (tenant_id, created_at desc);
-- One briefing per tenant per week — regeneration upserts rather than duplicates.
create unique index voice_briefings_period_uniq on public.voice_briefings (tenant_id, period_start);

alter table public.voice_briefings enable row level security;
create policy voice_briefings_select on public.voice_briefings
  for select using (tenant_id in (select public.current_user_tenants()));
