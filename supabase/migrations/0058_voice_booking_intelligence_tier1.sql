-- Tier 1 voice booking intelligence: capture route / fare / vehicle / airport on
-- each call (for recovery, demand, funnel and route analytics), plus a mutable
-- recovery worklist (calls is append-only, so callback state lives separately).

alter table public.calls
  add column if not exists pickup       text,
  add column if not exists destination  text,
  add column if not exists quoted_fare  numeric(8,2),
  add column if not exists vehicle_type text,
  add column if not exists booking_ref  text,
  add column if not exists airport_code text,
  add column if not exists sentiment    text;

-- Recovery worklist: one row per lost call (quoted/abandoned, no booking).
create table if not exists public.voice_call_recovery (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  call_id     uuid not null references public.calls(id)   on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending','contacted','recovered','dismissed')),
  note        text,
  actioned_by uuid,
  actioned_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (call_id)
);
create index if not exists voice_call_recovery_tenant_idx
  on public.voice_call_recovery (tenant_id, status, created_at desc);

alter table public.voice_call_recovery enable row level security;
drop policy if exists voice_call_recovery_select on public.voice_call_recovery;
create policy voice_call_recovery_select on public.voice_call_recovery
  for select using (tenant_id in (select current_user_tenants()));

create or replace function public.touch_voice_call_recovery() returns trigger
  language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists trg_touch_voice_call_recovery on public.voice_call_recovery;
create trigger trg_touch_voice_call_recovery
  before update on public.voice_call_recovery
  for each row execute function public.touch_voice_call_recovery();

-- Replace record_voice_call with the extended signature (route/fare/vehicle/etc.)
-- and drop the old 11-arg overload so the named-arg call resolves unambiguously.
drop function if exists public.record_voice_call(
  text,uuid,uuid,text,text,timestamptz,timestamptz,integer,text,text,boolean);

create or replace function public.record_voice_call(
  p_provider_call_id text,
  p_tenant uuid,
  p_automation uuid,
  p_caller text,
  p_agent_number text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_duration_s integer,
  p_outcome text,
  p_summary text default null,
  p_success boolean default null,
  p_pickup text default null,
  p_destination text default null,
  p_quoted_fare numeric default null,
  p_vehicle_type text default null,
  p_booking_ref text default null,
  p_airport_code text default null,
  p_sentiment text default null
) returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
                            summary, success, pickup, destination, quoted_fare, vehicle_type,
                            booking_ref, airport_code, sentiment)
  values (p_tenant, p_automation, p_provider_call_id, p_caller, p_agent_number,
          coalesce(p_started_at, now()), p_ended_at, p_duration_s, v_outcome, v_source, v_charged,
          p_summary, p_success, p_pickup, p_destination, p_quoted_fare, p_vehicle_type,
          nullif(p_booking_ref, ''), p_airport_code, p_sentiment)
  returning id into v_call_id;

  if v_source = 'topup' then
    insert into public.credit_ledger (tenant_id, delta, reason, call_id)
      values (p_tenant, -1, 'call_consumption', v_call_id);
  end if;

  -- Open a recovery row for a lost booking opportunity.
  if v_outcome in ('quoted','abandoned') and nullif(p_booking_ref, '') is null then
    insert into public.voice_call_recovery (tenant_id, call_id, status)
    values (p_tenant, v_call_id, 'pending')
    on conflict (call_id) do nothing;
  end if;

  select used into v_used from public.usage_counters
    where tenant_id = p_tenant and feature_key = 'voice_calls' and period_start = v_start;
  select coalesce(sum(delta), 0) into v_credit from public.credit_ledger where tenant_id = p_tenant;

  return jsonb_build_object('call_id', v_call_id, 'credit_source', v_source,
                            'outcome', v_outcome, 'charged', v_charged, 'duplicate', false,
                            'used', coalesce(v_used, 0), 'allowance', v_allowance,
                            'credit_balance', v_credit, 'period_start', v_start);
end;
$function$;

revoke all on function public.record_voice_call(
  text,uuid,uuid,text,text,timestamptz,timestamptz,integer,text,text,boolean,text,text,numeric,text,text,text,text
) from anon, authenticated;
grant execute on function public.record_voice_call(
  text,uuid,uuid,text,text,timestamptz,timestamptz,integer,text,text,boolean,text,text,numeric,text,text,text,text
) to service_role;
