# B1 — New-Model Billing Schema Design Spec

**Date:** 2026-06-10
**Program:** Billing migration (B0–B4), part of the BookMyCab two-product revamp.
**Depends on:** Epic R1 (`docs/superpowers/specs/2026-06-10-r1-two-product-schema-design.md`) — `voice_subscriptions` must exist first. B0 (billing/marketing decouple) is already merged.
**Status:** Design approved; ready for `writing-plans`.

## Purpose

Introduce the billing/provisioning schema and GBP charge figures for the new Chat / AI Voice / Double Decker commercial model, **alongside** the legacy `plan_band` model (existing tenants are grandfathered, untouched). This is the schema/data foundation; provisioning UI (B2), Stripe charge logic (B3), and credit purchases (B4) build on it.

## Resolved decisions

| ID | Decision |
|---|---|
| Scope | Migrate billing to the new model now (decouple already done in B0). Build order B0→B4. |
| **Charge currency** | **All new-model charges in GBP.** Marketing EUR/USD is indicative display only ("billed in GBP"). No price book per currency, no FX pinning. |
| **Subscription shape** | `chat_subscriptions` mirrors R1's `voice_subscriptions`; `tenants.commercial_model` (chat\|voice\|double_decker) marks the bundle. |
| **Existing tenants** | **Grandfathered.** Legacy tenants keep `plan_band` + their current billing untouched. Only new tenants use the new model. `plan_band` becomes nullable. Both billing paths coexist. |
| **Bundle billing** | **Two Stripe subscriptions** (one chat, one voice), each with its own `monthly_price_gbp` and `stripe_subscription_id`. The split is **authored** in the price book (components sum exactly to the advertised bundle price) — no runtime fractioning. |
| **Renewal** | New model = **rolling-monthly** (locked §17). No fixed contract term; `current_period_*` refreshed by the Stripe webhook. Legacy 12-month renewal stays for legacy tenants. |

## Reused / related infrastructure

- R1 `voice_subscriptions` (tenant_id PK, plan_tier, monthly_call_allowance, included_agents, status, current_period_*, stripe_subscription_id) — B1 **adds `monthly_price_gbp`**.
- B0 `src/lib/billing/pricing.ts` (legacy A/B constants) — B1 **adds a new-model GBP charge section**.
- Existing legacy path: `tenants.plan_band`, `src/lib/admin/plan-bands.ts`, `src/lib/billing/plan-price.ts` — untouched, serves grandfathered tenants.
- Coupons: R1 `0039` (`validate_coupon`, `coupon_redemptions`) + `0033` — applied to GBP amounts in B3; no new B1 schema.
- `public.current_user_tenants()` — RLS helper.

## Schema — migration `0040_new_model_billing.sql` (additive, after R1 0039)

```sql
-- 0040: New-model billing (Chat / Voice / Double Decker), GBP, rolling-monthly.
-- Additive + coexists with the legacy plan_band model (grandfathered tenants).

-- Chat subscription (mirror of voice_subscriptions; operational + billing fields).
create table public.chat_subscriptions (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  plan_tier              text not null check (plan_tier in ('ignition','in_motion','full_throttle')),
  channel_mode           text not null check (channel_mode in ('single','bundle')),
  monthly_price_gbp      numeric(10,2) not null check (monthly_price_gbp >= 0),
  status                 text not null default 'active' check (status in ('active','paused','cancelled')),
  current_period_start   date,
  current_period_end     date,
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.chat_subscriptions enable row level security;
create policy chat_subscriptions_select on public.chat_subscriptions
  for select using (tenant_id in (select public.current_user_tenants()));
-- Writes via service_role (provisioning/billing); no tenant write policy.

-- Voice subscription gains its GBP charge amount (R1 had allowance, not price).
alter table public.voice_subscriptions
  add column monthly_price_gbp numeric(10,2) check (monthly_price_gbp is null or monthly_price_gbp >= 0);

-- Tenant commercial model marker; legacy tenants stay null.
alter table public.tenants
  add column commercial_model text check (commercial_model in ('chat','voice','double_decker'));

-- Legacy plan_band is no longer mandatory (new tenants leave it null).
alter table public.tenants alter column plan_band drop not null;
```

> **Path selection:** a tenant with `commercial_model IS NOT NULL` is billed on the new GBP/rolling-monthly path; otherwise the legacy `plan_band` path. A `double_decker` tenant has BOTH a `chat_subscriptions` and a `voice_subscriptions` row.

## New-model GBP charge figures — `src/lib/billing/pricing.ts` (new section)

Authored in GBP. A drift-guard test asserts these equal the marketing canonical GBP numbers (`src/lib/marketing/pricing.ts`) so display and billing never diverge.

**Chat (monthly, GBP):**
| Tier | single | bundle (2 ch) |
|---|---|---|
| Ignition | 499 | 899 |
| In Motion | 999 | 1799 |
| Full Throttle | null (quoted) | null (quoted) |

**Voice (monthly, GBP):** Ignition 1199 · In Motion 1599 · Full Throttle 1999.

**Double Decker (monthly, GBP) — authored chat/voice split (sums to bundle total):**
Default allocation rule: *voice component = standalone voice price for that call volume; chat component = bundle total − voice component.* (Voice volumes map: 1500→Ignition £1199, 2250→In Motion £1599, 3000→Full Throttle £1999.)

| DD tier | mode | bundle total | chat component | voice component |
|---|---|---|---|---|
| Ignition | single (chat single + 1,500 calls) | 1599 | 400 | 1199 |
| Ignition | bundle (2-ch chat + 2,250 calls) | 1999 | 400 | 1599 |
| In Motion | single (chat single + 2,250 calls) | 2499 | 900 | 1599 |
| In Motion | bundle (2-ch chat + 2,250 calls) | 3199 | 1600 | 1599 |
| Full Throttle | single (chat single + 3,000 calls) | 2999 | 1000 | 1999 |
| Full Throttle | bundle (2-ch chat + 3,000 calls) | 3799 | 1800 | 1999 |

> ⚠️ **Finance confirmation needed at spec review:** the chat/voice split above uses the default rule (voice at standalone, chat absorbs the discount). If finance prefers a proportional split or different attribution, only these component numbers change — the schema and code shape do not.

**Setup fees (one-time, GBP):**
- Chat: 1000
- Voice: 1 agent 1000 · 2 agents 1500 · second-agent add-on 500
- Double Decker: 1 chat + 1 voice agent 1500 · 1 chat + 2 voice agents 2000

## Coexistence & safety

- Migration is **additive**: creates one table, adds two nullable columns, drops one NOT NULL. **No existing tenant row is modified.**
- Legacy code path (`plan-bands.ts`, `plan-price.ts`, legacy provisioning) is untouched and continues to serve grandfathered tenants.
- `plan_band` dropping NOT NULL is safe — existing rows keep their values; only new-model tenants insert null.

## Out of scope for B1 (later)

- Provisioning UI to select products/tiers and create these rows (B2).
- Stripe subscription/invoice creation for the new model, rolling-monthly cycle, coupon application (B3).
- Call-credit top-up purchases (B4 / R1-R3).
- Migrating grandfathered tenants onto the new model (deliberately deferred).

## Acceptance criteria

1. Migration `0040` applies cleanly on top of R1's `0039` (`supabase db reset`); additive only.
2. `chat_subscriptions` exists with RLS; a tenant SELECTs only its own row, never another tenant's.
3. `voice_subscriptions.monthly_price_gbp` column exists and is nullable.
4. `tenants.commercial_model` accepts chat/voice/double_decker and null; `tenants.plan_band` accepts null.
5. Existing tenant rows are unchanged after migration (plan_band values intact, commercial_model null).
6. `src/lib/billing/pricing.ts` exports the new-model GBP charge figures (chat, voice, double-decker components, setup fees) with a helper to resolve a tenant's `monthly_price_gbp` from (commercial_model, tier, mode).
7. A drift-guard test asserts the billing GBP figures equal the marketing canonical GBP numbers.
8. A test asserts every Double Decker tier's (chat component + voice component) equals its advertised bundle total.
9. Generated TypeScript types include `chat_subscriptions` and the altered columns.
