-- Demo seed for the two-product (Chat + AI Voice) dashboard.
-- Target: the demo tenant (DEMO_TENANT_ID = d0000000-0000-0000-0000-000000000001).
-- Visiting /demo signs in demo@demo.bookmycab.com and lands on a populated
-- /dashboard (Overview) + /dashboard/voice (analytics).
--
-- Re-runnable: clears prior voice/credit/call seed for this tenant, then
-- reinserts. Reuses the existing demo chat channels (migration 0016) for the
-- Chat panel, so it does NOT touch `channels` (FK'd from conversations).
-- Run only against the demo tenant id below.

begin;

-- 1. Commercial model: run BOTH products (Double Decker, Mix & Match), GBP.
--    monthly_price is the MRR source of truth = chat (799) + voice (1799) = 2598.
update tenants
   set commercial_model = 'double_decker', currency = 'GBP', monthly_price = 2598
 where id = 'd0000000-0000-0000-0000-000000000001';

-- 2. Clear prior seed (scoped to this tenant). NOTE: `calls` and `credit_ledger`
--    are append-only (immutability triggers, migration 0044) — they are NOT
--    deleted; the call/credit inserts in steps 6-7 are guarded with NOT EXISTS
--    so re-runs (and 24h demo resets) never duplicate or attempt a delete.
delete from voice_agents where tenant_id = 'd0000000-0000-0000-0000-000000000001';
delete from automations  where tenant_id = 'd0000000-0000-0000-0000-000000000001'
                           and id in ('a2222222-2222-2222-2222-222222222222',
                                      'a3333333-3333-3333-3333-333333333333');

-- 3. Subscriptions. Double Decker In Motion (Mix & Match):
--      chat = In Motion (£999) − £200 bundle discount = £799
--      voice = In Motion (£1799, 2,250 calls, 2 agents), never discounted
insert into chat_subscriptions (tenant_id, plan_tier, monthly_price_gbp, status,
                                current_period_start, current_period_end)
values ('d0000000-0000-0000-0000-000000000001', 'in_motion', 799, 'active',
        date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date)
on conflict (tenant_id) do update
  set plan_tier = excluded.plan_tier,
      monthly_price_gbp = excluded.monthly_price_gbp, status = 'active',
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end, updated_at = now();

insert into voice_subscriptions (tenant_id, plan_tier, monthly_call_allowance, included_agents,
                                 monthly_price_gbp, status, current_period_start, current_period_end)
values ('d0000000-0000-0000-0000-000000000001', 'in_motion', 2250, 2, 1799, 'active',
        date_trunc('month', now())::date, (date_trunc('month', now()) + interval '1 month - 1 day')::date)
on conflict (tenant_id) do update
  set plan_tier = excluded.plan_tier, monthly_call_allowance = excluded.monthly_call_allowance,
      included_agents = excluded.included_agents, monthly_price_gbp = excluded.monthly_price_gbp,
      status = 'active', current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end, updated_at = now();

-- 4. Voice automations + agents (one Live, one in UAT -> exercises StatusPill).
-- Daytime line is wired to the TEMPLATE engine pair (n8n workflow + Vapi
-- assistant, see docs/voice-template.md); the After-Hours line stays unwired to
-- exercise the admin "Engine wiring" form.
insert into automations (id, tenant_id, name, type, status, build_stage, dispatch_adapter, engine_workflow_id)
values
  ('a2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000001', 'Daytime Booking Line', 'Voice', 'live', 'Live', 'autocab', '0x5hOeCgWfr3N7pR'),
  ('a3333333-3333-3333-3333-333333333333', 'd0000000-0000-0000-0000-000000000001', 'After-Hours Line',     'Voice', 'uat',  'UAT',  'autocab', null);

insert into voice_agents (automation_id, tenant_id, display_name, phone_number, vapi_assistant_id)
values
  ('a2222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000001', 'Daytime Booking Line', '+44 20 7946 0001', '15c5709f-7585-4d39-96cf-ffe85e42bd40'),
  ('a3333333-3333-3333-3333-333333333333', 'd0000000-0000-0000-0000-000000000001', 'After-Hours Line',     '+44 20 7946 0002', null);

-- 5. Voice plan pool counter (this calendar month).
insert into usage_counters (tenant_id, feature_key, period_start, period_end, used, limit_amount)
values ('d0000000-0000-0000-0000-000000000001', 'voice_calls',
        date_trunc('month', now())::date,
        (date_trunc('month', now()) + interval '1 month - 1 day')::date, 428, 2250)
on conflict (tenant_id, feature_key, period_start) do update
  set used = excluded.used, limit_amount = excluded.limit_amount,
      period_end = excluded.period_end, updated_at = now();

-- 6. Calls — ~30 days of deterministic, realistic traffic across both agents.
insert into calls (tenant_id, automation_id, caller_number, agent_number, started_at, ended_at,
                   duration_s, outcome, credit_source, credit_charged, provider_call_id)
select
  'd0000000-0000-0000-0000-000000000001',
  (case when h % 5 < 3 then 'a2222222-2222-2222-2222-222222222222'
        else 'a3333333-3333-3333-3333-333333333333' end)::uuid,
  '+44 7700 ' || lpad((h % 900000 + 100000)::text, 6, '0'),
  case when h % 5 < 3 then '+44 20 7946 0001' else '+44 20 7946 0002' end,
  started_at, started_at + (dur || ' seconds')::interval,
  dur, outcome, cs,
  case when cs = 'none' then 0 else 1 end,
  'demo-' || ago || '-' || n
from (
  select ago, n, h, started_at, outcome,
    case when outcome = 'no_credit' then 'none'
         when h % 10 < 2 then 'topup' else 'plan' end as cs,
    case outcome
      when 'booked'      then 90 + (h % 150)
      when 'quoted'      then 60 + (h % 90)
      when 'abandoned'   then 10 + (h % 40)
      when 'transferred' then 70 + (h % 80)
      when 'failed'      then (h % 30)
      when 'no_credit'   then 0
      else 20 + (h % 60) end as dur
  from (
    select ago, n, h,
      least(now() - interval '2 minutes',
            date_trunc('day', now()) - (ago || ' days')::interval + ((h % 86399) || ' seconds')::interval) as started_at,
      case
        when h % 100 < 55 then 'booked'
        when h % 100 < 70 then 'quoted'
        when h % 100 < 82 then 'abandoned'
        when h % 100 < 90 then 'transferred'
        when h % 100 < 95 then 'failed'
        when h % 100 < 98 then 'no_credit'
        else 'unknown' end as outcome
    from (
      select d.ago, g.n, abs(hashtext(d.ago::text || '-' || g.n::text)) as h
      from generate_series(0, 29) as d(ago)
      cross join lateral generate_series(1, 2 + (abs(hashtext(d.ago::text)) % 7)) as g(n)
    ) base
  ) o
) f
-- Append-only guard: only seed calls the first time (no delete is possible).
where not exists (
  select 1 from calls where tenant_id = 'd0000000-0000-0000-0000-000000000001'
);

-- 7. Top-up ledger: two purchases minus per-call consumption -> net positive.
--    Append-only: guarded so re-runs never duplicate (no delete is possible).
insert into credit_ledger (tenant_id, delta, reason, unit_price_micros, currency, created_at)
select * from (values
  ('d0000000-0000-0000-0000-000000000001'::uuid, 50, 'topup_purchase', 900000, 'GBP', now() - interval '18 days'),
  ('d0000000-0000-0000-0000-000000000001'::uuid, 20, 'topup_purchase', 900000, 'GBP', now() - interval '6 days')
) v(tenant_id, delta, reason, unit_price_micros, currency, created_at)
where not exists (
  select 1 from credit_ledger where tenant_id = 'd0000000-0000-0000-0000-000000000001'
);

insert into credit_ledger (tenant_id, delta, reason, created_at)
select 'd0000000-0000-0000-0000-000000000001', -1, 'call_consumption', started_at
from calls
where tenant_id = 'd0000000-0000-0000-0000-000000000001' and credit_source = 'topup'
  and not exists (
    select 1 from credit_ledger
    where tenant_id = 'd0000000-0000-0000-0000-000000000001' and reason = 'call_consumption'
  );

commit;
