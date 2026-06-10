# R1 — Two-Product Schema Design Spec

**Date:** 2026-06-10
**Epic:** R1 (Schema & RLS) of the App Revamp program — `docs/superpowers/plans/2026-06-10-app-revamp-program.md`
**Status:** Design approved; ready for `writing-plans`.

## Purpose

Establish the Supabase schema, RLS, and metering primitives for the BookMyCab two-product model — multi-channel **Chat** and **AI Voice Agent** — including a shared monthly call allowance, a prepaid top-up credit balance, per-agent call analytics, and tenant-applicable coupons.

This epic is **additive**: no existing table is dropped. Only two CHECK constraints are widened (`automations.type`, `coupons.applies_to`).

## Resolved decisions

| ID | Decision |
|---|---|
| D1 | n8n engine stays; removed from **Chat** dashboard UI, kept for **Voice** (engine start/stop). *(Resolved in program plan; not schema.)* |
| D2 | Surgical removal manifest; no whole-page deletions. *(Program plan §2.)* |
| **Voice model** | A Voice agent is an `automations` row with `type='Voice'`. Reuses engine controls, status, and `usage_events.automation_id`. |
| **D3** | **Shared org pool** for the monthly call allowance; calls attributed **per-agent** for analytics. |
| **D4** | Allowance resets **billing-cycle aligned** (Stripe `invoice.paid`); **no carry-forward**. |
| **D5a** | **App-managed prepaid balance** for top-ups; Stripe handles the purchase only. Min £9 (≈10 calls at £0.90). |
| **D5b** | Draw order: **plan pool first, then top-up balance**. Top-up credits **never expire** (carry forward). |
| **D6** | Coupons stay **app-managed percent-off**. Admin create/manage; **tenant can apply** opted-in coupons at billing/top-up checkout. **"Print"** = branded print-to-PDF voucher page (no schema). |
| **D7** | Dedicated **`calls`** table for per-agent analytics (live queries); headline numbers from `usage_counters` rollup + `credit_ledger` balance. |

## Reused existing infrastructure (do NOT recreate)

- `automations` (`type` Booking/Support/Driver/Custom + engine refs + status) — Chat products and Voice agents both live here.
- `channels` (5 types incl. whatsapp/widget) — Chat channels.
- `plans` / `features` / `plan_features` / `tenant_entitlements` / `feature_rollouts` (0017) — entitlements + quotas.
- `usage_events` (append-only, has `automation_id`, `cost_micros`) + `usage_counters` (rollup, `period_start`/`period_end`, `used`, `limit_amount`) (0018) — the plan-pool metering for `voice_calls`.
- `coupons` (0033, percent-off, `applies_to` both/setup/subscription, admin-only) — extended here.
- Append-only immutability pattern: trigger that raises on UPDATE/DELETE (0011 audit_log, 0018 usage_events) — reused for `calls` and `credit_ledger`.
- `public.current_user_tenants()` — RLS helper used by all tenant SELECT policies.

## Schema

### Migration 0035 — voice agents

```sql
-- Widen automations.type to include Voice.
alter table public.automations drop constraint automations_type_check;
alter table public.automations add constraint automations_type_check
  check (type in ('Booking','Support','Driver','Custom','Voice'));

-- Per-tenant Voice subscription = the SHARED monthly call pool (D3).
create table public.voice_subscriptions (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  plan_tier              text not null check (plan_tier in ('ignition','in_motion','full_throttle')),
  monthly_call_allowance integer not null check (monthly_call_allowance >= 0), -- 1500/2250/3000
  included_agents        integer not null check (included_agents >= 0),        -- 1/2/2
  status                 text not null default 'active' check (status in ('active','paused','cancelled')),
  current_period_start   date,
  current_period_end     date,
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Per-agent Voice detail (each row 1:1 with a type='Voice' automation).
create table public.voice_agents (
  automation_id    uuid primary key references public.automations(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  display_name     text not null,
  phone_number     text,              -- E.164; the number this agent answers on
  phone_number_ref text,              -- vault/provider reference, never the raw secret
  created_at       timestamptz not null default now()
);
create index voice_agents_tenant_idx on public.voice_agents (tenant_id);

alter table public.voice_subscriptions enable row level security;
alter table public.voice_agents enable row level security;
create policy voice_subscriptions_select on public.voice_subscriptions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy voice_agents_select on public.voice_agents
  for select using (tenant_id in (select public.current_user_tenants()));
-- Writes are admin/provisioning via service_role (bypasses RLS): no write policy.
```

### Migration 0036 — calls (analytics detail, D7)

```sql
create table public.calls (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  automation_id   uuid not null references public.automations(id) on delete cascade, -- the Voice agent
  conversation_id uuid references public.conversations(id) on delete set null,
  caller_number   text,
  agent_number    text,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_s      integer check (duration_s is null or duration_s >= 0),
  outcome         text not null default 'unknown'
                    check (outcome in ('booked','quoted','abandoned','transferred','failed','no_credit','unknown')),
  credit_source   text not null default 'plan' check (credit_source in ('plan','topup','none')),
  credit_charged  integer not null default 1 check (credit_charged >= 0),
  raw_engine_json jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index calls_tenant_started_idx on public.calls (tenant_id, started_at);
create index calls_automation_idx     on public.calls (automation_id, started_at);

alter table public.calls enable row level security;
create policy calls_select on public.calls
  for select using (tenant_id in (select public.current_user_tenants()));
-- Writes via service_role only.

-- Append-only: a call record is immutable history.
create or replace function public.prevent_calls_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'calls is append-only; UPDATE/DELETE is not permitted';
end; $$;
create trigger calls_immutable
  before update or delete on public.calls
  for each row execute function public.prevent_calls_mutation();
```

> **Note on `ended_at`/`duration_s`/`outcome`:** because `calls` is append-only, the row is written **once at call completion** (when these are known), not at call start. Mid-call state, if ever needed, lives in the engine/session layer, not here.

### Migration 0037 — credit ledger (prepaid top-up balance, D5)

```sql
create table public.credit_ledger (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  delta                    integer not null,   -- +N on purchase, -1 per call consumed from top-up
  reason                   text not null check (reason in
                             ('topup_purchase','call_consumption','admin_adjustment','refund')),
  call_id                  uuid references public.calls(id) on delete set null,
  unit_price_micros        bigint,             -- 900000 = £0.90 at purchase time
  currency                 text check (currency in ('GBP','EUR','USD')),
  stripe_payment_intent_id text,
  created_by               uuid references public.users(id) on delete set null,
  created_at               timestamptz not null default now()
);
create index credit_ledger_tenant_idx on public.credit_ledger (tenant_id, created_at);

alter table public.credit_ledger enable row level security;
create policy credit_ledger_select on public.credit_ledger
  for select using (tenant_id in (select public.current_user_tenants()));
-- Writes via service_role only (purchase webhook, call consumption, admin adjust).

create or replace function public.prevent_credit_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is append-only; UPDATE/DELETE is not permitted';
end; $$;
create trigger credit_ledger_immutable
  before update or delete on public.credit_ledger
  for each row execute function public.prevent_credit_ledger_mutation();

-- Balance helper (security definer so the dashboard can read its own balance fast).
create or replace function public.credit_balance(p_tenant uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::bigint
  from public.credit_ledger
  where tenant_id = p_tenant
    and tenant_id in (select public.current_user_tenants());
$$;
```

### Migration 0038 — voice_calls feature key

```sql
-- Metered feature backing the SHARED plan pool (consumed via usage_events/usage_counters).
insert into public.features (key, name, description, category, metered, unit)
values ('voice_calls', 'AI Voice calls',
        'Monthly included AI Voice call allowance (shared across a tenant''s voice agents).',
        'voice', true, 'call')
on conflict (key) do nothing;

-- Per-plan quota rows are seeded when voice plans are created (admin/provisioning),
-- mapping plan_tier -> monthly_call_allowance via plan_features.quota_limit / quota_period='month'.
-- (Seeding is provisioning logic, specified in the R6/R7 plan, not a hardcoded migration row.)
```

### Migration 0039 — coupons: tenant-redeemable + redemptions (D6)

```sql
-- Admin opts a coupon in for tenant self-serve; widen what a coupon can discount.
alter table public.coupons add column tenant_redeemable boolean not null default false;
alter table public.coupons drop constraint coupons_applies_to_check;
alter table public.coupons add constraint coupons_applies_to_check
  check (applies_to in ('both','setup','subscription','credit'));

create table public.coupon_redemptions (
  id                       uuid primary key default gen_random_uuid(),
  coupon_id                uuid not null references public.coupons(id) on delete cascade,
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  applied_to               text not null check (applied_to in ('subscription','setup','credit_topup')),
  amount_discounted_micros bigint,
  currency                 text check (currency in ('GBP','EUR','USD')),
  stripe_ref               text,
  redeemed_at              timestamptz not null default now()
);
create index coupon_redemptions_tenant_idx on public.coupon_redemptions (tenant_id, redeemed_at);
create index coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);

alter table public.coupon_redemptions enable row level security;
create policy coupon_redemptions_select on public.coupon_redemptions
  for select using (tenant_id in (select public.current_user_tenants()));
-- INSERT via checkout server action (service_role).

-- Tenants validate a code WITHOUT a blanket SELECT over coupons.
-- Returns the usable percent_off, or NULL if invalid/ineligible.
create or replace function public.validate_coupon(p_code text)
returns integer language sql stable security definer set search_path = public as $$
  select c.percent_off
  from public.coupons c
  where upper(c.code) = upper(p_code)
    and c.active
    and c.tenant_redeemable
    and (c.expires_at is null or c.expires_at > now())
    and (c.max_redemptions is null or c.times_redeemed < c.max_redemptions)
  limit 1;
$$;
```

> `times_redeemed` is incremented by the checkout server action (service_role) when a redemption is recorded; concurrency is handled there (see the R4 plan), not in this schema.

## Credit consumption flow (server-side, per completed call)

```
1. plan pool first (D5b):
   if usage_counters(tenant, 'voice_calls', current period).used < monthly_call_allowance:
       - write usage_events row (feature_key='voice_calls', automation_id=agent, quantity=1)
       - increment usage_counters.used
       - credit_source = 'plan'
2. else top-up:
   if credit_balance(tenant) > 0:
       - insert credit_ledger (delta=-1, reason='call_consumption', call_id=...)
       - credit_source = 'topup'
3. else:
   - credit_source = 'none', outcome = 'no_credit'
4. always insert the calls row (with credit_source + outcome).
```

**Reset (D4):** Stripe `invoice.paid` webhook handler opens a fresh `usage_counters` period for `voice_calls` (new `period_start`/`period_end` from the subscription), sets `limit_amount = monthly_call_allowance`. No carry-forward (a new period row starts at `used=0`; the prior period is left as history). `credit_ledger` is untouched.

**Top-up purchase (D5a):** tenant initiates a one-off Stripe Checkout (min £9). On `checkout.session.completed` / `payment_intent.succeeded`, write `credit_ledger` (delta = +floor(amount/0.90), reason='topup_purchase', unit_price_micros=900000, currency, stripe_payment_intent_id).

## Dashboard sourcing (D7)

| Surface | Source |
|---|---|
| Chat channels in use | `count(channels)` where the parent automation `type <> 'Voice'` and `status='active'` |
| Voice agents in use | `count(automations)` where `type='Voice'` and `status` in ('live','uat') |
| Phone numbers in use | distinct of `voice_agents.phone_number` ∪ chat channel numbers |
| Calls made this period | `usage_counters(voice_calls).used` |
| Remaining plan calls | `monthly_call_allowance − usage_counters.used` |
| Top-up credit balance | `credit_balance(tenant)` |
| Per-agent + aggregate call charts | live queries over `calls` grouped by `automation_id` (volumes ≤ 3,000/mo) |

## Out of scope for R1 (later epics)

- Wiring the Voice-specific n8n workflow that emits call events (R3/R5 + engine work).
- Stripe Checkout/webhook handlers for top-up purchases and subscription resets (R3/R4 — R1 only provides the tables they write to).
- Coupon admin voucher page and tenant checkout apply UI (R4).
- Plan-tier → entitlement/quota seeding at provisioning (R6/R7).
- Dashboard UI components (R2/R5).

## Acceptance criteria

1. Migrations 0035–0039 apply cleanly on top of 0034 with no errors (`supabase db reset` / `apply_migration`).
2. `automations.type` accepts `'Voice'`; existing rows unaffected.
3. New tenant tables have RLS enabled; a tenant can SELECT only its own `voice_subscriptions`, `voice_agents`, `calls`, `credit_ledger`, `coupon_redemptions`, and cannot SELECT another tenant's rows.
4. `calls` and `credit_ledger` reject UPDATE/DELETE (even as table owner) via trigger.
5. `credit_balance(tenant)` returns `SUM(delta)` for the calling tenant and 0 for others.
6. `validate_coupon(code)` returns `percent_off` only for an active, `tenant_redeemable`, unexpired, under-limit coupon; NULL otherwise; and never exposes non-redeemable coupons.
7. `coupons.applies_to` accepts `'credit'`; `tenant_redeemable` defaults false.
8. `features` contains a `voice_calls` metered row.
9. Generated TypeScript types (`supabase gen types`) include the new tables/functions.
