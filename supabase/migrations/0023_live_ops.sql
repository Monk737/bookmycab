-- 0023: Live ops & human takeover.
--
-- Additive columns only — existing 0005 RLS policies on conversations/messages
-- already scope these tables by tenant, so no new policies are required.

alter table public.conversations add column takeover_status text not null default 'bot' check (takeover_status in ('bot','requested','human'));
alter table public.conversations add column assigned_to uuid references public.users(id) on delete set null;
alter table public.conversations add column takeover_at timestamptz;
alter table public.conversations add column last_human_reply_at timestamptz;

alter table public.messages add column source text not null default 'bot' check (source in ('bot','human','customer'));
alter table public.messages add column sent_by_user_id uuid references public.users(id) on delete set null;

create index conversations_takeover_idx on public.conversations (tenant_id, takeover_status);
