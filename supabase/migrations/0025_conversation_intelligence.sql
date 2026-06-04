-- 0025: Conversation intelligence.
--
-- Additive analysis columns on conversations/messages (existing 0005 RLS covers
-- them), plus a conversation_reviews table for staff QA + training feedback.

alter table public.conversations add column qa_score numeric;
alter table public.conversations add column qa_flags jsonb not null default '[]'::jsonb;
alter table public.conversations add column flagged_for_review boolean not null default false;
alter table public.conversations add column intent_summary text;
alter table public.conversations add column sentiment text;

alter table public.messages add column sentiment text;

create table public.conversation_reviews (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  reviewer_id     uuid references public.users(id) on delete set null,
  rating          integer check (rating between 1 and 5),
  label           text check (label in ('good','bad_understanding','too_slow','wrong_info','other')),
  note            text,
  used_for_training boolean not null default false,
  created_at      timestamptz not null default now()
);
create index conversation_reviews_conversation_idx on public.conversation_reviews (conversation_id);
create index conversations_flagged_idx on public.conversations (tenant_id, flagged_for_review);

-- RLS ----------------------------------------------------------------------
alter table public.conversation_reviews enable row level security;

create policy conversation_reviews_select on public.conversation_reviews
  for select using (tenant_id in (select public.current_user_tenants()));
create policy conversation_reviews_insert on public.conversation_reviews
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy conversation_reviews_delete on public.conversation_reviews
  for delete using (tenant_id in (select public.current_user_tenants()));
