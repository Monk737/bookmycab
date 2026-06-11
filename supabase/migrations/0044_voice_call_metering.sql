-- 0044: Voice call metering — atomic, idempotent, race-safe consumption.
--
-- When a voice call completes, draw down the balance: plan pool first (current
-- calendar-month usage_counters for 'voice_calls'), else prepaid top-up
-- (credit_ledger), else record as 'no_credit'. Always record the call. A
-- per-tenant transaction advisory lock serializes consumption (no over-draw);
-- provider_call_id makes re-delivery idempotent. SECURITY DEFINER, service_role
-- only (the /api/voice/calls/ingest endpoint calls it with the service key).

alter table public.calls add column provider_call_id text;
create unique index calls_provider_call_id_uniq
  on public.calls (provider_call_id) where provider_call_id is not null;

create or replace function public.record_voice_call(
  p_provider_call_id text,
  p_tenant uuid,
  p_automation uuid,
  p_caller text,
  p_agent_number text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_duration_s integer,
  p_outcome text
) returns jsonb language plpgsql security definer set search_path = public as $$
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
begin
  perform pg_advisory_xact_lock(hashtext(p_tenant::text));

  select * into v_existing from public.calls where provider_call_id = p_provider_call_id limit 1;
  if found then
    return jsonb_build_object('call_id', v_existing.id, 'credit_source', v_existing.credit_source,
                              'outcome', v_existing.outcome, 'charged', v_existing.credit_charged, 'duplicate', true);
  end if;

  select coalesce(monthly_call_allowance, 0) into v_allowance
  from public.voice_subscriptions where tenant_id = p_tenant;
  v_allowance := coalesce(v_allowance, 0);

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
                            started_at, ended_at, duration_s, outcome, credit_source, credit_charged)
  values (p_tenant, p_automation, p_provider_call_id, p_caller, p_agent_number,
          coalesce(p_started_at, now()), p_ended_at, p_duration_s, v_outcome, v_source, v_charged)
  returning id into v_call_id;

  if v_source = 'topup' then
    insert into public.credit_ledger (tenant_id, delta, reason, call_id)
      values (p_tenant, -1, 'call_consumption', v_call_id);
  end if;

  return jsonb_build_object('call_id', v_call_id, 'credit_source', v_source,
                            'outcome', v_outcome, 'charged', v_charged, 'duplicate', false);
end;
$$;

revoke execute on function public.record_voice_call(text,uuid,uuid,text,text,timestamptz,timestamptz,integer,text)
  from public, anon, authenticated;
grant execute on function public.record_voice_call(text,uuid,uuid,text,text,timestamptz,timestamptz,integer,text)
  to service_role;
