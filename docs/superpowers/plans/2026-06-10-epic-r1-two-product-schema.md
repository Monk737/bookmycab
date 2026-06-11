# Epic R1 — Two-Product Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Supabase schema, RLS, immutability, and metering primitives for the BookMyCab two-product model (Chat + AI Voice Agent) — migrations 0035–0039 — purely additively.

**Architecture:** Five additive migrations on top of `0034`. A Voice agent is an `automations` row with `type='Voice'`; a per-tenant `voice_subscriptions` row holds the **shared** monthly call pool; `voice_agents` holds per-agent detail; `calls` is an append-only per-agent analytics table; `credit_ledger` is an append-only prepaid top-up balance; a `voice_calls` feature key meters the plan pool via the existing `usage_events`/`usage_counters`; and `coupons` is extended so tenants can apply opted-in coupons (validated via a `security definer` RPC) with a `coupon_redemptions` audit table. No table is dropped; only two CHECK constraints widen.

**Tech Stack:** Supabase (PostgreSQL 17), SQL migrations under `supabase/migrations/`, Supabase CLI (`npx supabase`), Vitest + `pg` for migration/RLS tests (`tests/helpers/db.ts`), TypeScript type generation.

**Spec:** `docs/superpowers/specs/2026-06-10-r1-two-product-schema-design.md`

---

## Prerequisites (do once before Task 1)

The live RLS/immutability tests run against a **local** Supabase Postgres on `127.0.0.1:54322`. Start it and confirm a clean baseline:

```bash
npx supabase start           # boots local Postgres + applies migrations 0001–0034
npm test -- tests/rls.test.ts   # sanity: existing RLS tests pass against the local DB
```

After **every** new migration in this plan, re-apply with `npx supabase db reset` (rebuilds the local DB from all migrations 0001→latest). Each task states this explicitly.

> **Conventions to follow (already in the repo):**
> - **Static migration test** = read the `.sql` file with `readFileSync` and assert structure with regex (see `tests/invoicing-migration.test.ts`).
> - **Live test** = `withPostgres` (superuser, seeds fixtures) + `asUser` (role `authenticated`, RLS applies) from `tests/helpers/db.ts` (see `tests/rls.test.ts`).
> - Tenant SELECT policies use `tenant_id in (select public.current_user_tenants())`.
> - Append-only tables use a `before update or delete` trigger that `raise exception` (see `0011`, `0018`).

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `supabase/migrations/0035_voice_agents.sql` | Widen `automations.type`; `voice_subscriptions` (shared pool); `voice_agents` (per-agent) + RLS | Create |
| `supabase/migrations/0036_calls.sql` | `calls` analytics table + indexes + RLS + immutability trigger | Create |
| `supabase/migrations/0037_credit_ledger.sql` | `credit_ledger` + RLS + immutability + `credit_balance()` RPC | Create |
| `supabase/migrations/0038_voice_calls_feature.sql` | `voice_calls` row in `features` catalog | Create |
| `supabase/migrations/0039_coupons_tenant_redeem.sql` | `coupons` columns + widen `applies_to`; `coupon_redemptions`; `validate_coupon()` RPC | Create |
| `tests/voice-agents-migration.test.ts` | Static structure assertions for 0035 | Create |
| `tests/calls-migration.test.ts` | Static structure assertions for 0036 | Create |
| `tests/credit-ledger-migration.test.ts` | Static structure assertions for 0037 | Create |
| `tests/voice-feature-migration.test.ts` | Static structure assertions for 0038 | Create |
| `tests/coupons-redeem-migration.test.ts` | Static structure assertions for 0039 | Create |
| `tests/r1-schema-rls.test.ts` | Live RLS + immutability + RPC behaviour across the new tables (built up across tasks) | Create (Task 1), extend (Tasks 2,3,5) |
| `src/lib/database.types.ts` *(or repo's generated types path — confirm in Task 6)* | Regenerated TS types | Modify |

---

### Task 1: Migration 0035 — voice agents

**Files:**
- Create: `supabase/migrations/0035_voice_agents.sql`
- Create: `tests/voice-agents-migration.test.ts`
- Create: `tests/r1-schema-rls.test.ts`

- [ ] **Step 1: Write the failing static test**

Create `tests/voice-agents-migration.test.ts`:

```ts
// tests/voice-agents-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0035_voice_agents.sql"),
  "utf8",
);

describe("0035 voice agents migration", () => {
  it("widens automations.type to include Voice", () => {
    expect(sql).toMatch(/alter table public\.automations[\s\S]*drop constraint if exists automations_type_check/i);
    expect(sql).toMatch(/check \(type in \([^)]*'Voice'[^)]*\)\)/i);
  });
  it("creates voice_subscriptions with a shared allowance + tier", () => {
    expect(sql).toMatch(/create table public\.voice_subscriptions/i);
    expect(sql).toMatch(/plan_tier .*check .*ignition.*in_motion.*full_throttle/i);
    expect(sql).toMatch(/monthly_call_allowance integer not null/i);
    expect(sql).toMatch(/included_agents integer not null/i);
    expect(sql).toMatch(/stripe_subscription_id text/i);
  });
  it("creates voice_agents keyed by automation_id", () => {
    expect(sql).toMatch(/create table public\.voice_agents/i);
    expect(sql).toMatch(/automation_id\s+uuid primary key references public\.automations\(id\)/i);
    expect(sql).toMatch(/phone_number\s+text/i);
  });
  it("enables RLS + tenant select policies on both tables", () => {
    expect(sql).toMatch(/alter table public\.voice_subscriptions enable row level security/i);
    expect(sql).toMatch(/alter table public\.voice_agents enable row level security/i);
    expect(sql).toMatch(/voice_subscriptions_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/voice_agents_select[\s\S]*current_user_tenants\(\)/i);
  });
});
```

- [ ] **Step 2: Run the static test to verify it fails**

Run: `npm test -- tests/voice-agents-migration.test.ts`
Expected: FAIL — `ENOENT` (the migration file does not exist yet).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0035_voice_agents.sql`:

```sql
-- 0035: Voice agents (two-product model).
--
-- A Voice agent IS an automation (type='Voice'), reusing engine controls,
-- status, and usage_events.automation_id. voice_subscriptions holds the
-- per-tenant SHARED monthly call pool (D3); voice_agents holds per-agent detail.

-- Widen automations.type to include 'Voice' (additive; existing rows unaffected).
alter table public.automations drop constraint if exists automations_type_check;
alter table public.automations add constraint automations_type_check
  check (type in ('Booking','Support','Driver','Custom','Voice'));

-- Per-tenant Voice subscription = the shared monthly call allowance pool.
create table public.voice_subscriptions (
  tenant_id              uuid primary key references public.tenants(id) on delete cascade,
  plan_tier              text not null check (plan_tier in ('ignition','in_motion','full_throttle')),
  monthly_call_allowance integer not null check (monthly_call_allowance >= 0),
  included_agents        integer not null check (included_agents >= 0),
  status                 text not null default 'active' check (status in ('active','paused','cancelled')),
  current_period_start   date,
  current_period_end     date,
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Per-agent Voice detail (1:1 with a type='Voice' automation).
create table public.voice_agents (
  automation_id    uuid primary key references public.automations(id) on delete cascade,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  display_name     text not null,
  phone_number     text,
  phone_number_ref text,
  created_at       timestamptz not null default now()
);
create index voice_agents_tenant_idx on public.voice_agents (tenant_id);

-- RLS: tenant may read its own rows; writes go through service_role (no write policy).
alter table public.voice_subscriptions enable row level security;
alter table public.voice_agents enable row level security;

create policy voice_subscriptions_select on public.voice_subscriptions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy voice_agents_select on public.voice_agents
  for select using (tenant_id in (select public.current_user_tenants()));
```

- [ ] **Step 4: Run the static test to verify it passes**

Run: `npm test -- tests/voice-agents-migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Apply the migration to the local DB**

Run: `npx supabase db reset`
Expected: all migrations 0001→0035 apply with no error; ends with "Finished supabase db reset".

- [ ] **Step 6: Write the live RLS test (creates the shared R1 live test file)**

Create `tests/r1-schema-rls.test.ts`:

```ts
// tests/r1-schema-rls.test.ts
// Live RLS / immutability / RPC behaviour for the R1 two-product schema.
// Requires the local Supabase stack with migrations 0035+ applied (supabase db reset).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withPostgres, asUser } from "./helpers/db";

const TENANT_A = "d1111111-1111-1111-1111-111111111111";
const TENANT_B = "d2222222-2222-2222-2222-222222222222";
const USER_A = "d1aaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "d2bbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const AGENT_A = "d1cccccc-cccc-cccc-cccc-cccccccccccc"; // type='Voice' automation in tenant A

beforeAll(async () => {
  await withPostgres(async (c) => {
    await c.query("begin");
    for (const [id, email] of [
      [USER_A, "r1-owner-a@acme-cabs.com"],
      [USER_B, "r1-owner-b@other-cabs.com"],
    ] as const) {
      await c.query(
        `insert into auth.users (instance_id, id, aud, role, email)
         values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2)
         on conflict (id) do nothing`,
        [id, email],
      );
      await c.query(
        `insert into public.users (id, email) values ($1, $2) on conflict (id) do nothing`,
        [id, email],
      );
    }
    for (const [id, name, slug] of [
      [TENANT_A, "R1 Acme Cabs", "r1-acme-cabs"],
      [TENANT_B, "R1 Other Cabs", "r1-other-cabs"],
    ] as const) {
      await c.query(
        `insert into public.tenants (id, name, slug, country, plan_band, currency)
         values ($1, $2, $3, 'GB', 'A-Single', 'GBP') on conflict (id) do nothing`,
        [id, name, slug],
      );
    }
    await c.query(
      `insert into public.tenant_users (tenant_id, user_id, role) values
        ($1,$2,'Owner'), ($3,$4,'Owner') on conflict do nothing`,
      [TENANT_A, USER_A, TENANT_B, USER_B],
    );
    // A Voice agent automation in tenant A.
    await c.query(
      `insert into public.automations (id, tenant_id, name, type)
       values ($1, $2, 'Voice Line', 'Voice') on conflict (id) do nothing`,
      [AGENT_A, TENANT_A],
    );
    await c.query(
      `insert into public.voice_subscriptions
        (tenant_id, plan_tier, monthly_call_allowance, included_agents)
       values ($1, 'in_motion', 2250, 2) on conflict (tenant_id) do nothing`,
      [TENANT_A],
    );
    await c.query(
      `insert into public.voice_agents (automation_id, tenant_id, display_name, phone_number)
       values ($1, $2, 'Main Line', '+441234567890') on conflict (automation_id) do nothing`,
      [AGENT_A, TENANT_A],
    );
    await c.query("commit");
  });
});

afterAll(async () => {
  await withPostgres(async (c) => {
    await c.query("delete from public.voice_agents where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.voice_subscriptions where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.automations where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.tenant_users where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.tenants where id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.users where id in ($1,$2)", [USER_A, USER_B]);
    await c.query("delete from auth.users where id in ($1,$2)", [USER_A, USER_B]);
  });
});

describe("0035 voice agents — type + RLS", () => {
  it("accepts type='Voice' automations", async () => {
    await withPostgres(async (c) => {
      const r = await c.query(
        "select type from public.automations where id = $1",
        [AGENT_A],
      );
      expect(r.rows[0].type).toBe("Voice");
    });
  });

  it("tenant A owner sees its voice subscription + agent", async () => {
    await asUser(USER_A, async (q) => {
      const subs = await q("select tenant_id from public.voice_subscriptions");
      expect(subs.map((r) => r.tenant_id)).toContain(TENANT_A);
      const agents = await q("select automation_id from public.voice_agents");
      expect(agents.map((r) => r.automation_id)).toContain(AGENT_A);
    });
  });

  it("tenant B owner cannot see tenant A voice rows", async () => {
    await asUser(USER_B, async (q) => {
      const subs = await q("select tenant_id from public.voice_subscriptions");
      expect(subs.map((r) => r.tenant_id)).not.toContain(TENANT_A);
      const agents = await q("select automation_id from public.voice_agents");
      expect(agents.map((r) => r.automation_id)).not.toContain(AGENT_A);
    });
  });
});
```

- [ ] **Step 7: Run the live test to verify it passes**

Run: `npm test -- tests/r1-schema-rls.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0035_voice_agents.sql tests/voice-agents-migration.test.ts tests/r1-schema-rls.test.ts
git commit -m "feat(db): 0035 voice agents — type='Voice', voice_subscriptions, voice_agents + RLS"
```

---

### Task 2: Migration 0036 — calls (analytics, append-only)

**Files:**
- Create: `supabase/migrations/0036_calls.sql`
- Create: `tests/calls-migration.test.ts`
- Modify: `tests/r1-schema-rls.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing static test**

Create `tests/calls-migration.test.ts`:

```ts
// tests/calls-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0036_calls.sql"),
  "utf8",
);

describe("0036 calls migration", () => {
  it("creates calls with agent attribution + outcome + credit_source", () => {
    expect(sql).toMatch(/create table public\.calls/i);
    expect(sql).toMatch(/automation_id\s+uuid not null references public\.automations\(id\)/i);
    expect(sql).toMatch(/outcome .*check .*booked[\s\S]*no_credit[\s\S]*unknown/i);
    expect(sql).toMatch(/credit_source .*check .*plan.*topup.*none/i);
    expect(sql).toMatch(/credit_charged integer not null default 1/i);
  });
  it("indexes by tenant+started_at and automation+started_at", () => {
    expect(sql).toMatch(/create index calls_tenant_started_idx on public\.calls \(tenant_id, started_at\)/i);
    expect(sql).toMatch(/create index calls_automation_idx on public\.calls \(automation_id, started_at\)/i);
  });
  it("enables RLS with a tenant select policy", () => {
    expect(sql).toMatch(/alter table public\.calls enable row level security/i);
    expect(sql).toMatch(/calls_select[\s\S]*current_user_tenants\(\)/i);
  });
  it("makes calls append-only via a trigger", () => {
    expect(sql).toMatch(/create trigger calls_immutable[\s\S]*before update or delete on public\.calls/i);
    expect(sql).toMatch(/calls is append-only/i);
  });
});
```

- [ ] **Step 2: Run the static test to verify it fails**

Run: `npm test -- tests/calls-migration.test.ts`
Expected: FAIL — `ENOENT` (file missing).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0036_calls.sql`:

```sql
-- 0036: Calls (AI Voice analytics detail, append-only).
--
-- One row per completed call, attributed to a Voice agent (automation_id).
-- This is the analytics source for per-agent + aggregate charts (D7). Billing
-- truth lives in usage_events (plan pool) and credit_ledger (top-ups).

create table public.calls (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  automation_id   uuid not null references public.automations(id) on delete cascade,
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

-- Append-only: a completed call is immutable history.
create or replace function public.prevent_calls_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'calls is append-only; UPDATE/DELETE is not permitted';
end;
$$;
create trigger calls_immutable
  before update or delete on public.calls
  for each row execute function public.prevent_calls_mutation();
```

- [ ] **Step 4: Run the static test + apply the migration**

Run: `npm test -- tests/calls-migration.test.ts` → Expected: PASS.
Run: `npx supabase db reset` → Expected: migrations 0001→0036 apply cleanly.

- [ ] **Step 5: Append the live behaviour test**

In `tests/r1-schema-rls.test.ts`, add a constant for a seeded call and an INSERT in `beforeAll`, plus a new describe block.

5a. Add this constant after the `AGENT_A` declaration:

```ts
const CALL_A = "d1dddddd-dddd-dddd-dddd-dddddddddddd";
```

5b. In `beforeAll`, immediately before `await c.query("commit");`, insert a call:

```ts
    await c.query(
      `insert into public.calls (id, tenant_id, automation_id, outcome, credit_source)
       values ($1, $2, $3, 'booked', 'plan') on conflict (id) do nothing`,
      [CALL_A, TENANT_A, AGENT_A],
    );
```

5c. In `afterAll`, add this delete as the FIRST statement inside `withPostgres` (before the voice_agents delete):

```ts
    await c.query("delete from public.calls where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
```

5d. Append this describe block at the end of the file:

```ts
describe("0036 calls — RLS + append-only", () => {
  it("tenant A sees its own calls; tenant B does not", async () => {
    await asUser(USER_A, async (q) => {
      const rows = await q("select id from public.calls");
      expect(rows.map((r) => r.id)).toContain(CALL_A);
    });
    await asUser(USER_B, async (q) => {
      const rows = await q("select id from public.calls");
      expect(rows.map((r) => r.id)).not.toContain(CALL_A);
    });
  });

  it("rejects UPDATE and DELETE (append-only)", async () => {
    await withPostgres(async (c) => {
      await expect(
        c.query("update public.calls set outcome = 'failed' where id = $1", [CALL_A]),
      ).rejects.toThrow(/append-only/i);
      await expect(
        c.query("delete from public.calls where id = $1", [CALL_A]),
      ).rejects.toThrow(/append-only/i);
    });
  });
});
```

- [ ] **Step 6: Run the live test to verify it passes**

Run: `npm test -- tests/r1-schema-rls.test.ts`
Expected: PASS (Task 1 block + the two new tests).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0036_calls.sql tests/calls-migration.test.ts tests/r1-schema-rls.test.ts
git commit -m "feat(db): 0036 calls — append-only per-agent analytics + RLS"
```

---

### Task 3: Migration 0037 — credit ledger + balance RPC

**Files:**
- Create: `supabase/migrations/0037_credit_ledger.sql`
- Create: `tests/credit-ledger-migration.test.ts`
- Modify: `tests/r1-schema-rls.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing static test**

Create `tests/credit-ledger-migration.test.ts`:

```ts
// tests/credit-ledger-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0037_credit_ledger.sql"),
  "utf8",
);

describe("0037 credit ledger migration", () => {
  it("creates credit_ledger with delta + reason", () => {
    expect(sql).toMatch(/create table public\.credit_ledger/i);
    expect(sql).toMatch(/delta\s+integer not null/i);
    expect(sql).toMatch(/reason .*check .*topup_purchase[\s\S]*call_consumption[\s\S]*admin_adjustment[\s\S]*refund/i);
    expect(sql).toMatch(/stripe_payment_intent_id text/i);
  });
  it("enables RLS with a tenant select policy", () => {
    expect(sql).toMatch(/alter table public\.credit_ledger enable row level security/i);
    expect(sql).toMatch(/credit_ledger_select[\s\S]*current_user_tenants\(\)/i);
  });
  it("makes credit_ledger append-only via a trigger", () => {
    expect(sql).toMatch(/create trigger credit_ledger_immutable[\s\S]*before update or delete on public\.credit_ledger/i);
    expect(sql).toMatch(/credit_ledger is append-only/i);
  });
  it("defines credit_balance() as a security-definer function scoped to the caller", () => {
    expect(sql).toMatch(/create or replace function public\.credit_balance\(p_tenant uuid\)/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/sum\(delta\)/i);
    expect(sql).toMatch(/current_user_tenants\(\)/i);
  });
});
```

- [ ] **Step 2: Run the static test to verify it fails**

Run: `npm test -- tests/credit-ledger-migration.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0037_credit_ledger.sql`:

```sql
-- 0037: Credit ledger (prepaid AI Voice top-up balance, append-only).
--
-- Top-ups are app-managed prepaid credits (D5a): tenant buys via a one-off
-- Stripe payment; each call consumed from top-ups writes a -1 row (D5b, after
-- the plan pool is exhausted). Balance = SUM(delta). Top-ups never expire.

create table public.credit_ledger (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  delta                    integer not null,
  reason                   text not null check (reason in
                             ('topup_purchase','call_consumption','admin_adjustment','refund')),
  call_id                  uuid references public.calls(id) on delete set null,
  unit_price_micros        bigint,
  currency                 text check (currency in ('GBP','EUR','USD')),
  stripe_payment_intent_id text,
  created_by               uuid references public.users(id) on delete set null,
  created_at               timestamptz not null default now()
);
create index credit_ledger_tenant_idx on public.credit_ledger (tenant_id, created_at);

alter table public.credit_ledger enable row level security;
create policy credit_ledger_select on public.credit_ledger
  for select using (tenant_id in (select public.current_user_tenants()));

-- Append-only.
create or replace function public.prevent_credit_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'credit_ledger is append-only; UPDATE/DELETE is not permitted';
end;
$$;
create trigger credit_ledger_immutable
  before update or delete on public.credit_ledger
  for each row execute function public.prevent_credit_ledger_mutation();

-- Fast balance for the calling tenant; security definer so the dashboard reads
-- it directly, but gated to the caller's own tenants so it cannot read others'.
create or replace function public.credit_balance(p_tenant uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::bigint
  from public.credit_ledger
  where tenant_id = p_tenant
    and tenant_id in (select public.current_user_tenants());
$$;
```

- [ ] **Step 4: Run the static test + apply the migration**

Run: `npm test -- tests/credit-ledger-migration.test.ts` → Expected: PASS.
Run: `npx supabase db reset` → Expected: migrations 0001→0037 apply cleanly.

- [ ] **Step 5: Append the live behaviour test**

In `tests/r1-schema-rls.test.ts`:

5a. In `beforeAll`, immediately before `await c.query("commit");`, seed ledger rows for tenant A (a +10 purchase and a -1 consumption → balance 9):

```ts
    await c.query(
      `insert into public.credit_ledger (tenant_id, delta, reason, unit_price_micros, currency)
       values ($1, 10, 'topup_purchase', 900000, 'GBP')`,
      [TENANT_A],
    );
    await c.query(
      `insert into public.credit_ledger (tenant_id, delta, reason, call_id)
       values ($1, -1, 'call_consumption', $2)`,
      [TENANT_A, CALL_A],
    );
```

5b. In `afterAll`, add this delete as the FIRST statement inside `withPostgres` (before the calls delete):

```ts
    await c.query("delete from public.credit_ledger where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
```

5c. Append this describe block at the end of the file:

```ts
describe("0037 credit ledger — balance + RLS + append-only", () => {
  it("credit_balance returns SUM(delta) for the calling tenant (10 - 1 = 9)", async () => {
    await asUser(USER_A, async (q) => {
      const rows = await q("select public.credit_balance($1) as bal", [TENANT_A]);
      expect(Number(rows[0].bal)).toBe(9);
    });
  });

  it("credit_balance returns 0 when querying another tenant", async () => {
    await asUser(USER_B, async (q) => {
      const rows = await q("select public.credit_balance($1) as bal", [TENANT_A]);
      expect(Number(rows[0].bal)).toBe(0);
    });
  });

  it("tenant B cannot read tenant A ledger rows", async () => {
    await asUser(USER_B, async (q) => {
      const rows = await q("select id from public.credit_ledger where tenant_id = $1", [TENANT_A]);
      expect(rows).toHaveLength(0);
    });
  });

  it("rejects UPDATE and DELETE (append-only)", async () => {
    await withPostgres(async (c) => {
      await expect(
        c.query("update public.credit_ledger set delta = 0 where tenant_id = $1", [TENANT_A]),
      ).rejects.toThrow(/append-only/i);
      await expect(
        c.query("delete from public.credit_ledger where tenant_id = $1", [TENANT_A]),
      ).rejects.toThrow(/append-only/i);
    });
  });
});
```

- [ ] **Step 6: Run the live test to verify it passes**

Run: `npm test -- tests/r1-schema-rls.test.ts`
Expected: PASS (all prior blocks + the four new tests).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0037_credit_ledger.sql tests/credit-ledger-migration.test.ts tests/r1-schema-rls.test.ts
git commit -m "feat(db): 0037 credit_ledger — prepaid balance, append-only, credit_balance RPC"
```

---

### Task 4: Migration 0038 — voice_calls feature key

**Files:**
- Create: `supabase/migrations/0038_voice_calls_feature.sql`
- Create: `tests/voice-feature-migration.test.ts`

> This seeds only the metered **feature key** that the plan pool meters against (via `usage_events`/`usage_counters`). Per-plan quota rows (`plan_features`) are seeded at provisioning time (R6/R7), NOT here — keep this migration to the single catalog row.

- [ ] **Step 1: Write the failing static test**

Create `tests/voice-feature-migration.test.ts`:

```ts
// tests/voice-feature-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0038_voice_calls_feature.sql"),
  "utf8",
);

describe("0038 voice_calls feature migration", () => {
  it("inserts a metered voice_calls feature with unit 'call'", () => {
    expect(sql).toMatch(/insert into public\.features/i);
    expect(sql).toMatch(/'voice_calls'/);
    expect(sql).toMatch(/true,\s*'call'/i); // metered=true, unit='call'
  });
  it("is idempotent (on conflict do nothing)", () => {
    expect(sql).toMatch(/on conflict \(key\) do nothing/i);
  });
});
```

- [ ] **Step 2: Run the static test to verify it fails**

Run: `npm test -- tests/voice-feature-migration.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0038_voice_calls_feature.sql`:

```sql
-- 0038: voice_calls feature key.
--
-- Backs the SHARED plan call pool (D3/D4). Consumption is metered through the
-- existing usage_events (append-only) + usage_counters (per-period rollup)
-- tables with feature_key='voice_calls'. Per-plan quota_limit rows in
-- plan_features are seeded at provisioning time (R6/R7), not here.

insert into public.features (key, name, description, category, metered, unit)
values ('voice_calls', 'AI Voice calls',
        'Monthly included AI Voice call allowance (shared across a tenant''s voice agents).',
        'voice', true, 'call')
on conflict (key) do nothing;
```

- [ ] **Step 4: Run the static test + apply the migration**

Run: `npm test -- tests/voice-feature-migration.test.ts` → Expected: PASS.
Run: `npx supabase db reset` → Expected: migrations 0001→0038 apply cleanly.

- [ ] **Step 5: Verify the row exists in the DB**

Run:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select key, metered, unit from public.features where key='voice_calls';"
```

Expected: one row → `voice_calls | t | call`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0038_voice_calls_feature.sql tests/voice-feature-migration.test.ts
git commit -m "feat(db): 0038 voice_calls metered feature key"
```

---

### Task 5: Migration 0039 — coupons tenant-redeemable + validate_coupon

**Files:**
- Create: `supabase/migrations/0039_coupons_tenant_redeem.sql`
- Create: `tests/coupons-redeem-migration.test.ts`
- Modify: `tests/r1-schema-rls.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing static test**

Create `tests/coupons-redeem-migration.test.ts`:

```ts
// tests/coupons-redeem-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0039_coupons_tenant_redeem.sql"),
  "utf8",
);

describe("0039 coupons tenant-redeem migration", () => {
  it("adds tenant_redeemable and widens applies_to to include credit", () => {
    expect(sql).toMatch(/alter table public\.coupons add column tenant_redeemable boolean not null default false/i);
    expect(sql).toMatch(/check \(applies_to in \([^)]*'credit'[^)]*\)\)/i);
  });
  it("creates coupon_redemptions with applied_to + tenant scope", () => {
    expect(sql).toMatch(/create table public\.coupon_redemptions/i);
    expect(sql).toMatch(/applied_to .*check .*subscription.*setup.*credit_topup/i);
    expect(sql).toMatch(/coupon_redemptions_select[\s\S]*current_user_tenants\(\)/i);
  });
  it("defines validate_coupon() as a security-definer function honouring eligibility", () => {
    expect(sql).toMatch(/create or replace function public\.validate_coupon\(p_code text\)/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/c\.active/i);
    expect(sql).toMatch(/c\.tenant_redeemable/i);
    expect(sql).toMatch(/times_redeemed < c\.max_redemptions/i);
  });
});
```

- [ ] **Step 2: Run the static test to verify it fails**

Run: `npm test -- tests/coupons-redeem-migration.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0039_coupons_tenant_redeem.sql`:

```sql
-- 0039: Tenant-redeemable coupons (D6).
--
-- Existing coupons (0033) are admin-provisioning percent-off. This lets an admin
-- opt a coupon in for tenant self-serve (tenant_redeemable) and lets a coupon
-- discount a credit top-up (applies_to='credit'). Tenants validate a code via the
-- validate_coupon() RPC (never a blanket SELECT). coupon_redemptions is the audit.

alter table public.coupons add column tenant_redeemable boolean not null default false;
alter table public.coupons drop constraint if exists coupons_applies_to_check;
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
-- INSERT via the checkout server action (service_role); no tenant insert policy.

-- Validate a code WITHOUT exposing the coupons table. Returns the usable
-- percent_off, or NULL if the coupon is missing/inactive/not tenant-redeemable/
-- expired/over its redemption cap.
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

- [ ] **Step 4: Run the static test + apply the migration**

Run: `npm test -- tests/coupons-redeem-migration.test.ts` → Expected: PASS.
Run: `npx supabase db reset` → Expected: migrations 0001→0039 apply cleanly.

- [ ] **Step 5: Append the live behaviour test**

In `tests/r1-schema-rls.test.ts`:

5a. Add constants after the `CALL_A` declaration:

```ts
const COUPON_OK = "e1111111-1111-1111-1111-111111111111";  // active + tenant_redeemable
const COUPON_OFF = "e2222222-2222-2222-2222-222222222222"; // active but NOT tenant_redeemable
```

5b. In `beforeAll`, immediately before `await c.query("commit");`, seed two coupons:

```ts
    await c.query(
      `insert into public.coupons (id, code, percent_off, applies_to, active, tenant_redeemable)
       values ($1, 'R1SAVE20', 20, 'credit', true, true) on conflict (id) do nothing`,
      [COUPON_OK],
    );
    await c.query(
      `insert into public.coupons (id, code, percent_off, applies_to, active, tenant_redeemable)
       values ($1, 'R1ADMINONLY', 50, 'both', true, false) on conflict (id) do nothing`,
      [COUPON_OFF],
    );
```

5c. In `afterAll`, add these deletes as the FIRST statements inside `withPostgres` (before the credit_ledger delete):

```ts
    await c.query("delete from public.coupon_redemptions where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.coupons where id in ($1,$2)", [COUPON_OK, COUPON_OFF]);
```

5d. Append this describe block at the end of the file:

```ts
describe("0039 coupons — validate_coupon + redemption RLS", () => {
  it("validate_coupon returns percent_off for an active, tenant-redeemable code", async () => {
    await asUser(USER_A, async (q) => {
      const rows = await q("select public.validate_coupon($1) as pct", ["r1save20"]);
      expect(Number(rows[0].pct)).toBe(20);
    });
  });

  it("validate_coupon returns NULL for an admin-only (non-redeemable) code", async () => {
    await asUser(USER_A, async (q) => {
      const rows = await q("select public.validate_coupon($1) as pct", ["R1ADMINONLY"]);
      expect(rows[0].pct).toBeNull();
    });
  });

  it("validate_coupon returns NULL for an unknown code", async () => {
    await asUser(USER_A, async (q) => {
      const rows = await q("select public.validate_coupon($1) as pct", ["NOPE"]);
      expect(rows[0].pct).toBeNull();
    });
  });

  it("a tenant cannot SELECT the coupons table directly", async () => {
    await asUser(USER_A, async (q) => {
      const rows = await q("select id from public.coupons");
      expect(rows).toHaveLength(0); // default-deny RLS on coupons (0033)
    });
  });

  it("coupon_redemptions are tenant-isolated", async () => {
    await withPostgres(async (c) => {
      await c.query(
        `insert into public.coupon_redemptions (coupon_id, tenant_id, applied_to)
         values ($1, $2, 'credit_topup')`,
        [COUPON_OK, TENANT_A],
      );
    });
    await asUser(USER_B, async (q) => {
      const rows = await q("select id from public.coupon_redemptions where tenant_id = $1", [TENANT_A]);
      expect(rows).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 6: Run the live test to verify it passes**

Run: `npm test -- tests/r1-schema-rls.test.ts`
Expected: PASS (all prior blocks + the five new tests).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0039_coupons_tenant_redeem.sql tests/coupons-redeem-migration.test.ts tests/r1-schema-rls.test.ts
git commit -m "feat(db): 0039 tenant-redeemable coupons + coupon_redemptions + validate_coupon RPC"
```

---

### Task 6: Regenerate TypeScript types + full verification

**Files:**
- Modify: the repo's generated Supabase types file (confirm exact path in Step 1)

- [ ] **Step 1: Locate the generated types file**

Run: `grep -rl "export type Database" src | head` and `grep -rn "gen types" package.json README.md docs 2>/dev/null`
Expected: a file such as `src/lib/supabase/database.types.ts` (or similar). Note its exact path for Step 2. If no generated types file exists in the repo, skip Steps 2–3 and note that in the commit; the schema is still complete.

- [ ] **Step 2: Regenerate types from the local DB**

Using the path from Step 1 (example shown — substitute the real path):

```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

Expected: the file now contains `voice_subscriptions`, `voice_agents`, `calls`, `credit_ledger`, `coupon_redemptions`, and the `credit_balance` / `validate_coupon` functions.

- [ ] **Step 3: Confirm the new tables/functions are present**

Run:

```bash
grep -E "voice_subscriptions|voice_agents|calls:|credit_ledger|coupon_redemptions|credit_balance|validate_coupon" src/lib/supabase/database.types.ts
```

Expected: matches for each new table and function.

- [ ] **Step 4: Full verification gate**

Run each and confirm green:

```bash
npx supabase db reset          # all 39 migrations apply from scratch
npm test                       # full vitest suite: new + existing migration/RLS tests pass
npx tsc --noEmit               # regenerated types compile
npm run lint                   # clean
```

Expected: db reset finishes, all tests pass, typecheck and lint clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(db): regenerate Supabase types for R1 two-product schema"
```

---

## Self-Review

**Spec coverage (R1 design spec → tasks):**
- Voice agent = `automations type='Voice'` + `voice_agents` + shared `voice_subscriptions` → Task 1 ✓
- `calls` analytics table (D7), append-only → Task 2 ✓
- `credit_ledger` prepaid balance (D5a/b), append-only, `credit_balance()` → Task 3 ✓
- `voice_calls` metered feature key (D3/D4 plan pool) → Task 4 ✓
- Coupons `tenant_redeemable` + `applies_to='credit'` + `coupon_redemptions` + `validate_coupon()` (D6) → Task 5 ✓
- RLS on every new tenant table; coupons stay default-deny; tenant access via RPC → Tasks 1,2,3,5 (live isolation tests) ✓
- Immutability triggers on `calls` + `credit_ledger` → Tasks 2,3 (live reject UPDATE/DELETE tests) ✓
- Regenerated TS types (acceptance #9) → Task 6 ✓
- Acceptance #1 (migrations apply cleanly) → Task 6 Step 4 `supabase db reset` ✓
- Out-of-scope items (Stripe handlers, UI, quota seeding) correctly NOT included.

**Placeholder scan:** No "TBD"/"handle errors"/"similar to". Every SQL and test block is complete. The only deliberate variable is the generated-types path in Task 6, which Step 1 resolves explicitly before use. ✓

**Type/name consistency:** Table names (`voice_subscriptions`, `voice_agents`, `calls`, `credit_ledger`, `coupon_redemptions`), function names (`credit_balance`, `validate_coupon`, `prevent_calls_mutation`, `prevent_credit_ledger_mutation`), policy names, and the fixture UUIDs/constants (`TENANT_A/B`, `USER_A/B`, `AGENT_A`, `CALL_A`, `COUPON_OK/OFF`) are identical across the migrations, static tests, and the shared live test file. The live test file is created in Task 1 and extended in Tasks 2/3/5 with explicit anchors. ✓

> **Sequential dependency (intentional):** `tests/r1-schema-rls.test.ts` is created in Task 1 and appended to in Tasks 2, 3, 5. Execute tasks in order. Each migration also requires `npx supabase db reset` before its live test runs.
