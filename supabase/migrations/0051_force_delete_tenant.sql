-- 0051: admin force-delete for a tenant, including tenants that have data.
--
-- A normal tenant delete is blocked two ways:
--   1. audit_log -> tenants is ON DELETE NO ACTION (it won't cascade), and
--   2. ten tables (audit_log, calls, credit_ledger, usage_events, ...) carry an
--      append-only *_immutable trigger that raises on any DELETE.
-- This SECURITY DEFINER function (owned by postgres) momentarily disables those
-- guards, removes the audit rows explicitly, then deletes the tenant so every
-- other child cascades. DDL is transactional, so any failure rolls the whole
-- thing back with the guards still enabled. Locked to service_role.
--
-- Note: this purges ALL of the tenant's history (bookings, calls, ledgers,
-- audit). It does NOT remove their auth.users accounts (an auth user can exist
-- without a tenant); the admin action records its own audit entry beforehand.

create or replace function public.force_delete_tenant(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  alter table public.alert_events       disable trigger alert_events_immutable;
  alter table public.audit_log          disable trigger audit_log_immutable;
  alter table public.calls              disable trigger calls_immutable;
  alter table public.copilot_messages   disable trigger copilot_messages_immutable;
  alter table public.credit_ledger      disable trigger credit_ledger_immutable;
  alter table public.dispatch_attempts  disable trigger dispatch_attempts_immutable;
  alter table public.notification_log   disable trigger notification_log_immutable;
  alter table public.report_runs        disable trigger report_runs_immutable;
  alter table public.usage_events       disable trigger usage_events_immutable;
  alter table public.webhook_deliveries disable trigger webhook_deliveries_immutable;

  -- audit_log's FK is NO ACTION, so it must be cleared before the tenant row.
  delete from public.audit_log where tenant_id = p_tenant;

  -- Everything else cascades on the tenant_id FK.
  delete from public.tenants where id = p_tenant;

  alter table public.alert_events       enable trigger alert_events_immutable;
  alter table public.audit_log          enable trigger audit_log_immutable;
  alter table public.calls              enable trigger calls_immutable;
  alter table public.copilot_messages   enable trigger copilot_messages_immutable;
  alter table public.credit_ledger      enable trigger credit_ledger_immutable;
  alter table public.dispatch_attempts  enable trigger dispatch_attempts_immutable;
  alter table public.notification_log   enable trigger notification_log_immutable;
  alter table public.report_runs        enable trigger report_runs_immutable;
  alter table public.usage_events       enable trigger usage_events_immutable;
  alter table public.webhook_deliveries enable trigger webhook_deliveries_immutable;
end;
$$;

revoke execute on function public.force_delete_tenant(uuid) from public, anon, authenticated;
grant execute on function public.force_delete_tenant(uuid) to service_role;
