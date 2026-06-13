-- 0050: voice usage notifications (running-low / plan-exhausted emails).
--
-- Adds the pool snapshot to record_voice_call's return so the ingest route can
-- decide whether to notify, plus a once-per-period idempotency ledger so each
-- notice is emailed at most once per tenant per billing month.

-- 1. Idempotency ledger. One row per (tenant, period, kind); the PK makes the
--    claim atomic. Service-role only (no RLS policies = no anon/authed access).
create table if not exists public.voice_usage_notifications (
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  period_start date not null,
  kind         text not null,
  sent_at      timestamptz not null default now(),
  primary key (tenant_id, period_start, kind)
);
alter table public.voice_usage_notifications enable row level security;

-- Atomically claim a (tenant, period, kind) notification. Returns true exactly
-- once, the first time it's claimed; subsequent calls return false. The caller
-- sends the email only when this returns true.
create or replace function public.claim_usage_notification(
  p_tenant uuid, p_period_start date, p_kind text
) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare v_inserted int;
begin
  insert into public.voice_usage_notifications (tenant_id, period_start, kind)
  values (p_tenant, p_period_start, p_kind)
  on conflict (tenant_id, period_start, kind) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;
revoke execute on function public.claim_usage_notification(uuid, date, text) from public, anon, authenticated;
grant execute on function public.claim_usage_notification(uuid, date, text) to service_role;

-- 2. Extend record_voice_call to return the post-charge pool snapshot
--    (used / allowance / credit_balance / period_start). Behaviour is otherwise
--    unchanged: pool-first then top-up credit, idempotent on provider_call_id.
create or replace function public.record_voice_call(
  p_provider_call_id text, p_tenant uuid, p_automation uuid, p_caller text,
  p_agent_number text, p_started_at timestamptz, p_ended_at timestamptz,
  p_duration_s integer, p_outcome text,
  p_summary text default null, p_success boolean default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('month', now() at time zone 'utc')::date;
  v_end   date := (date_trunc('month', now() at time zone 'utc') + interval '1 month' - interval '1 day')::date;
  v_allowance int;
  v_existing  public.calls;
  v_call_id uuid;
  v_source text;
  v_charged int;
  v_outcome text;
  v_plan_ok int;
  v_used int;
  v_credit bigint;
begin
  perform pg_advisory_xact_lock(hashtext(p_tenant::text));

  select coalesce(monthly_call_allowance, 0) into v_allowance
  from public.voice_subscriptions where tenant_id = p_tenant;
  v_allowance := coalesce(v_allowance, 0);

  select * into v_existing from public.calls where provider_call_id = p_provider_call_id limit 1;
  if found then
    select used into v_used from public.usage_counters
      where tenant_id = p_tenant and feature_key = 'voice_calls' and period_start = v_start;
    select coalesce(sum(delta), 0) into v_credit from public.credit_ledger where tenant_id = p_tenant;
    return jsonb_build_object('call_id', v_existing.id, 'credit_source', v_existing.credit_source,
                              'outcome', v_existing.outcome, 'charged', v_existing.credit_charged, 'duplicate', true,
                              'used', coalesce(v_used, 0), 'allowance', v_allowance,
                              'credit_balance', v_credit, 'period_start', v_start);
  end if;

  insert into public.usage_counters (tenant_id, feature_key, period_start, period_end, used, limit_amount)
  values (p_tenant, 'voice_calls', v_start, v_end, 0, v_allowance)
  on conflict (tenant_id, feature_key, period_start) do nothing;

  update public.usage_counters
    set used = used + 1
    where tenant_id = p_tenant and feature_key = 'voice_calls' and period_start = v_start
      and used < coalesce(limit_amount, v_allowance)
    returning 1 into v_plan_ok;

  if v_plan_ok = 1 then
    insert into public.usage_events (tenant_id, feature_key, automation_id, quantity, unit)
      values (p_tenant, 'voice_calls', p_automation, 1, 'call');
    v_source := 'plan'; v_charged := 1; v_outcome := p_outcome;
  elsif (select coalesce(sum(delta), 0) from public.credit_ledger where tenant_id = p_tenant) > 0 then
    v_source := 'topup'; v_charged := 1; v_outcome := p_outcome;
  else
    v_source := 'none'; v_charged := 0; v_outcome := 'no_credit';
  end if;

  insert into public.calls (tenant_id, automation_id, provider_call_id, caller_number, agent_number,
                            started_at, ended_at, duration_s, outcome, credit_source, credit_charged,
                            summary, success)
  values (p_tenant, p_automation, p_provider_call_id, p_caller, p_agent_number,
          coalesce(p_started_at, now()), p_ended_at, p_duration_s, v_outcome, v_source, v_charged,
          p_summary, p_success)
  returning id into v_call_id;

  if v_source = 'topup' then
    insert into public.credit_ledger (tenant_id, delta, reason, call_id)
      values (p_tenant, -1, 'call_consumption', v_call_id);
  end if;

  select used into v_used from public.usage_counters
    where tenant_id = p_tenant and feature_key = 'voice_calls' and period_start = v_start;
  select coalesce(sum(delta), 0) into v_credit from public.credit_ledger where tenant_id = p_tenant;

  return jsonb_build_object('call_id', v_call_id, 'credit_source', v_source,
                            'outcome', v_outcome, 'charged', v_charged, 'duplicate', false,
                            'used', coalesce(v_used, 0), 'allowance', v_allowance,
                            'credit_balance', v_credit, 'period_start', v_start);
end;
$$;
