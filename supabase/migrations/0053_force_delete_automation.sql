-- 0053: admin force-delete for a single automation, including ones with data.
--
-- Deleting an automation that has calls cascades into the append-only `calls`
-- (and credit_ledger via call_id), and nulls automation_id on dispatch_attempts
-- / usage_events, all of which carry *_immutable guards that raise on the
-- DELETE/UPDATE. This SECURITY DEFINER function (owned by postgres) momentarily
-- disables those guards, deletes the automation so its children cascade, then
-- re-enables them. DDL is transactional, so a failure rolls back with the guards
-- still on. Locked to service_role. The caller scopes the automation to its
-- tenant and records an audit entry first.

create or replace function public.force_delete_automation(p_automation uuid)
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

  delete from public.automations where id = p_automation;

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

revoke execute on function public.force_delete_automation(uuid) from public, anon, authenticated;
grant execute on function public.force_delete_automation(uuid) to service_role;
