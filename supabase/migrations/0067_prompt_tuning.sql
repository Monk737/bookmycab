-- supabase/migrations/0067_prompt_tuning.sql
-- 0067: AI Voice prompt-tuning loop (suggest → request → apply → measure → rollback).
--
-- prompt_suggestions: the detector's drafted prompt revisions per Voice agent,
-- plus the operator→FlowMo handoff (a tenant operator "raises" a draft to admin;
-- only FlowMo staff resolve it). prompt_revisions: the versioned, reversible log
-- of prompt changes actually applied to a Vapi assistant (who/when/why/diff),
-- with measurement fields for one-click + auto rollback. Both are tenant-readable
-- (RLS select) but write-only via the service role (server actions / cron).

create table public.prompt_suggestions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  automation_id     uuid not null references public.automations(id) on delete cascade,
  vapi_assistant_id text not null,
  reason            text not null,
  reason_count      integer not null default 0,
  reason_delta_pct  integer,                   -- whole-number percent change vs the prior window (e.g. 300 = +300%); null = brand new
  baseline_flagged_rate numeric,               -- reason flagged-rate over the window, 0..1; maintained by the writing server actions
  old_prompt        text not null,
  new_prompt        text not null,
  rationale         text,
  evidence_call_ids uuid[] not null default '{}',
  model             text,
  status            text not null default 'draft'
                    check (status in ('draft','requested','applied','dismissed','superseded')),
  -- operator → admin handoff
  requested_by      uuid,
  requested_at      timestamptz,
  operator_note     text,
  -- admin resolution
  resolved_by       uuid,
  resolved_at       timestamptz,
  revision_id       uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- One live suggestion per agent+reason so re-detection refreshes rather than piling up.
create unique index prompt_suggestions_open_uniq
  on public.prompt_suggestions (automation_id, reason)
  where status in ('draft','requested');
create index prompt_suggestions_tenant_status_idx on public.prompt_suggestions (tenant_id, status);
create index prompt_suggestions_requested_idx on public.prompt_suggestions (status, requested_at desc);

create table public.prompt_revisions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  automation_id         uuid not null references public.automations(id) on delete cascade,
  vapi_assistant_id     text not null,
  revision              integer not null,
  old_prompt            text not null,
  new_prompt            text not null,
  reason                text,
  rationale             text,
  source_suggestion_id  uuid references public.prompt_suggestions(id) on delete set null,
  kind                  text not null default 'apply' check (kind in ('apply','rollback')),
  parent_revision_id    uuid references public.prompt_revisions(id) on delete set null,
  status                text not null default 'active' check (status in ('active','superseded','rolled_back')),
  baseline_flagged_rate numeric,
  measured_flagged_rate numeric,
  measured_at           timestamptz,
  applied_by            uuid,
  applied_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);
create unique index prompt_revisions_assistant_rev_uniq on public.prompt_revisions (vapi_assistant_id, revision);
create index prompt_revisions_assistant_status_idx on public.prompt_revisions (vapi_assistant_id, status);
create index prompt_revisions_tenant_idx on public.prompt_revisions (tenant_id);

-- prompt_suggestions.revision_id points at the revision created on apply.
alter table public.prompt_suggestions
  add constraint prompt_suggestions_revision_fk
  foreign key (revision_id) references public.prompt_revisions(id) on delete set null;

-- RLS: tenant may read its own rows; all writes go through the service role
-- (server actions + cron). No insert/update/delete policies on purpose.
alter table public.prompt_suggestions enable row level security;
alter table public.prompt_revisions enable row level security;

create policy prompt_suggestions_select on public.prompt_suggestions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy prompt_revisions_select on public.prompt_revisions
  for select using (tenant_id in (select public.current_user_tenants()));
