# B5 — Voice Call Metering Design Spec

**Date:** 2026-06-11
**Program:** Two-product revamp. Depends on R1/B1 (`calls`, `voice_subscriptions`, `usage_counters`, `credit_ledger`, `voice_calls` feature) + B3 (pool reset).
**Status:** Design — approved decisions, ready for `writing-plans`.

## Purpose

Wire **call consumption**: when an AI Voice call completes, decrement the tenant's call balance using the fixed draw order (plan pool first, then prepaid top-up credit), record the call for analytics, and stay idempotent + race-safe. This is the missing consumption half of the metering loop (the monthly pool reset already lands via the B3 webhook).

## Resolved decisions

- **Ingest path:** a new app endpoint `POST /api/voice/calls/ingest`. The (future) Voice n8n workflow POSTs one request per completed call. The app owns consumption + idempotency.
- **Auth:** a shared bearer secret `VOICE_INGEST_SECRET` (env). The endpoint constant-time-compares the `Authorization: Bearer …` header; 401 on mismatch. No tenant session (n8n is a trusted backend caller).
- **Consumption:** a Postgres `SECURITY DEFINER` function `record_voice_call(...)` does the whole draw order in one transaction, serialized per tenant via a transaction advisory lock — race-safe under concurrent calls, idempotent on a provider call id.

## Draw order (fixed by B1 D5b)

Per completed call, atomically:
1. **Plan pool first** — current calendar-month `usage_counters` for `feature_key='voice_calls'` (same bounds as the meter + B3 reset). If `used < allowance` → increment `used`, append a `usage_events` row (`automation_id` = the voice agent), `credit_source='plan'`, `credit_charged=1`, outcome = the call's business outcome.
2. **Else top-up** — if `credit_balance(tenant) > 0` → append `credit_ledger` `delta=-1, reason='call_consumption', call_id=<new call>`, `credit_source='topup'`, `credit_charged=1`, outcome = business outcome.
3. **Else** — `credit_source='none'`, `credit_charged=0`, outcome overridden to `'no_credit'` (the call is still recorded, flagged).

Always insert the `calls` row (analytics).

## Schema — migration `0044_voice_call_metering.sql`

```sql
-- Idempotency key from the Voice workflow (one ingest per real call).
alter table public.calls add column provider_call_id text;
create unique index calls_provider_call_id_uniq
  on public.calls (provider_call_id) where provider_call_id is not null;

-- Atomic, idempotent, race-safe consumption. SECURITY DEFINER; service_role only.
create or replace function public.record_voice_call(
  p_provider_call_id text,
  p_tenant uuid,
  p_automation uuid,
  p_caller text,
  p_agent_number text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_duration_s integer,
  p_outcome text                       -- business outcome: booked|quoted|abandoned|transferred|failed|unknown
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
  -- Serialize all consumption for this tenant → no over-draw across concurrent calls.
  perform pg_advisory_xact_lock(hashtext(p_tenant::text));

  -- Idempotency: a re-delivered ingest for the same call is a no-op.
  select * into v_existing from public.calls where provider_call_id = p_provider_call_id limit 1;
  if found then
    return jsonb_build_object('call_id', v_existing.id, 'credit_source', v_existing.credit_source,
                              'outcome', v_existing.outcome, 'charged', v_existing.credit_charged, 'duplicate', true);
  end if;

  select coalesce(monthly_call_allowance, 0) into v_allowance
  from public.voice_subscriptions where tenant_id = p_tenant;
  v_allowance := coalesce(v_allowance, 0);

  -- Ensure the current-month plan counter exists (idempotent), then try to draw from it.
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
```

> **Testing this function on a Supabase dev branch, not prod:** `calls`/`credit_ledger`/`usage_events` are append-only (test rows can't be deleted from prod). Create a Supabase branch, apply `0044` there, run the draw-order scenarios (plan → exhaust → topup → exhaust → no_credit + duplicate idempotency), verify, then apply `0044` to the main project and delete the branch.

## Endpoint — `POST /api/voice/calls/ingest`

- **Auth:** read `Authorization: Bearer <token>`; constant-time compare to `env.VOICE_INGEST_SECRET`; 401 on mismatch/absent. (Extract the compare into a pure helper so it's unit-testable.)
- **Body (zod):** `{ provider_call_id: string, tenant_id: uuid, automation_id: uuid, caller_number?, agent_number?, started_at?, ended_at?, duration_s?, outcome: 'booked'|'quoted'|'abandoned'|'transferred'|'failed'|'unknown' }`. 400 on invalid.
- Call `serviceClient.rpc('record_voice_call', { … })`; return `200 { call_id, credit_source, outcome, charged, duplicate }`. On RPC error → 500 (Stripe-style logged).
- `runtime = "nodejs"`.

## Env

Add `VOICE_INGEST_SECRET` to the env schema (`src/env.ts`), server-only, required in production.

## Out of scope

- The Voice n8n workflow itself (built later; conforms to this contract).
- Blocking a call before it happens when no credit (this records + flags `no_credit`; pre-call gating is the workflow's concern using `credit_balance`/remaining).
- Dashboard call analytics charts (R5).

## Acceptance criteria

1. `0044` applies cleanly; `calls.provider_call_id` + unique index added; `record_voice_call` exists, `SECURITY DEFINER`, `service_role`-only execute.
2. Draw order verified on a Supabase branch: first calls consume the plan pool (usage_counters.used increments, usage_events appended); after `allowance` calls, further calls draw from `credit_ledger` (−1 each); after the balance hits 0, calls record `credit_source='none'`, `outcome='no_credit'`, `credit_charged=0`.
3. Idempotency: re-sending the same `provider_call_id` returns the existing call with `duplicate=true` and does NOT double-charge.
4. Concurrency: the advisory lock serializes per-tenant consumption (no over-draw of the pool).
5. Endpoint: 401 without the bearer secret; 400 on bad body; 200 with the rpc result on success. Auth + validation unit-tested with mocked env + mocked rpc.
6. `tsc`/lint/build clean.
