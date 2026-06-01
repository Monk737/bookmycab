-- 0011: Make public.audit_log genuinely append-only (insert-only).
--
-- Background: 0005 already RLS-hard-denies tenant users (anon/authenticated
-- cannot even SELECT audit_log). However, service_role — which every admin
-- write path uses — bypasses RLS and could still UPDATE/DELETE rows, so the
-- "append-only" guarantee documented in the plan/CLAUDE.md was not actually
-- enforced against the backend.
--
-- This trigger blocks UPDATE and DELETE for EVERYONE, including service_role
-- and table owners (triggers fire regardless of role/RLS-bypass), making the
-- table truly immutable after insert.
--   * INSERT is still allowed (all writes go through writeAudit, which only
--     INSERTs).
--   * SELECT remains governed by the existing RLS/grants from 0005
--     (tenant users denied; service_role/FlowMo admin read).
--
-- Intentional: this blocks ALL update/delete, including service_role. Nothing
-- in the app updates or deletes audit rows. If a future legitimate need arises
-- (e.g. GDPR erasure), that will be a deliberate, explicit future migration
-- that drops/relaxes this trigger.

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only; UPDATE/DELETE is not permitted';
end;
$$;

comment on function public.prevent_audit_log_mutation() is
  'Append-only guard for public.audit_log: raises on any UPDATE/DELETE. '
  'Enforces true immutability even against service_role / table owners '
  '(triggers fire regardless of RLS bypass). INSERT remains allowed; SELECT '
  'is still governed by RLS/grants from 0005.';

create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function public.prevent_audit_log_mutation();
