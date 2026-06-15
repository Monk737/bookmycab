-- Operator triage state for the Agent-Quality "Calls to review" queue.
--
-- `calls` is append-only, so a call's reviewed/dismissed status lives here, one
-- row per actioned call. Absence of a row = still open in the queue; the queue
-- query left-excludes call_ids with status reviewed/dismissed so it shrinks as an
-- operator works it. Tenant-readable; writes are service-role only (the review
-- server action), audited by actioned_by / actioned_at.

create table public.call_reviews (
  call_id      uuid primary key references public.calls(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  status       text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  note         text,
  actioned_by  uuid,
  actioned_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index call_reviews_tenant_status_idx on public.call_reviews (tenant_id, status);

alter table public.call_reviews enable row level security;
create policy call_reviews_select on public.call_reviews
  for select using (tenant_id in (select public.current_user_tenants()));
