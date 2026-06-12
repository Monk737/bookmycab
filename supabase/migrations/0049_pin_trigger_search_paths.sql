-- 0049: pin search_path on trigger/hook functions (security lint 0011).
--
-- The append-only immutability triggers (audit_log, calls, credit_ledger,
-- usage_events, etc.) and the JWT claims hook had a role-mutable search_path.
-- None are API-callable, but pinning removes any search-path-hijack surface
-- and clears the Supabase security advisor warnings.

alter function public.custom_access_token_hook(jsonb) set search_path = public;
alter function public.prevent_audit_log_mutation() set search_path = public;
alter function public.prevent_usage_events_mutation() set search_path = public;
alter function public.prevent_alert_events_mutation() set search_path = public;
alter function public.prevent_notification_log_mutation() set search_path = public;
alter function public.prevent_dispatch_attempts_mutation() set search_path = public;
alter function public.prevent_report_runs_mutation() set search_path = public;
alter function public.prevent_webhook_deliveries_mutation() set search_path = public;
alter function public.prevent_copilot_messages_mutation() set search_path = public;
alter function public.prevent_calls_mutation() set search_path = public;
alter function public.prevent_credit_ledger_mutation() set search_path = public;
