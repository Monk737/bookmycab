-- Build-queue pipeline fields for the internal admin console.
-- Pipeline stage is SEPARATE from runtime `status` (building|uat|live|stopped|error):
-- `build_stage` tracks the provisioning/build pipeline (Kanban), `status` tracks
-- the live automation's runtime health.
alter table public.automations
  add column build_stage text not null default 'Requested'
    check (build_stage in ('Requested','Scoped','Building','UAT','Live')),
  add column assigned_engineer uuid references public.users(id) on delete set null,
  add column target_go_live date,
  add column build_notes text;
