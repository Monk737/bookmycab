-- Durable call recordings (Tier 2).
--
-- `calls` is append-only (calls_immutable trigger), so the call row stores the
-- ORIGINAL provider (Vapi) recording URL as immutable history. That URL lives in
-- the provider's storage and is only good for the provider's retention window.
-- This table is the MUTABLE archival layer: one row per call, written 'pending'
-- by the ingest route and updated to 'archived' once the audio is copied into our
-- own private Storage bucket. The dashboard serves our durable copy and falls
-- back to the original URL until (or unless) the archive lands.

create table public.call_artifacts (
  call_id      uuid primary key references public.calls(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  source_url   text,                                   -- provider recording URL, as received
  storage_path text,                                   -- durable copy: path within the bucket
  status       text not null default 'pending'
                 check (status in ('pending', 'archived', 'failed', 'skipped')),
  bytes        bigint,
  content_type text,
  error        text,
  attempts     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Partial index drives the archiver's "what still needs copying?" sweep.
create index call_artifacts_pending_idx on public.call_artifacts (created_at)
  where status in ('pending', 'failed');
create index call_artifacts_tenant_idx on public.call_artifacts (tenant_id);

alter table public.call_artifacts enable row level security;

-- Tenants may read their own artifact rows (mirrors calls_select). All writes are
-- service-role only (the ingest route + archiver), so there is no write policy.
create policy call_artifacts_select on public.call_artifacts
  for select using (tenant_id in (select public.current_user_tenants()));

-- Keep updated_at honest on every archiver write.
create or replace function public.touch_call_artifacts_updated_at()
returns trigger
 language plpgsql
 set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger call_artifacts_touch
  before update on public.call_artifacts
  for each row execute function public.touch_call_artifacts_updated_at();

-- Private bucket that holds the durable audio copies. Never public: the dashboard
-- streams playback through short-lived service-role signed URLs.
insert into storage.buckets (id, name, public)
values ('call-recordings', 'call-recordings', false)
on conflict (id) do nothing;
