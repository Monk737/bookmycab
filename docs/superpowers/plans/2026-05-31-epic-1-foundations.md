# Epic 1 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the CabbyBot codebase skeleton — a Next.js 15 app that builds, the full Supabase schema (§8.1) and RLS policies (§8.2) as versioned migrations on local Supabase, a JWT custom-claims auth hook, Supabase client wrappers, route-protecting middleware, validated env, and green CI.

**Architecture:** Single Next.js 15 (App Router) repo. Database schema and security live in `supabase/migrations/*.sql` applied by the Supabase CLI to a local Postgres 15. Tenant isolation is enforced **in the database** via RLS keyed on `auth.uid()` → `tenant_users`; the app reads denormalised `tenant_id`/`role`/`is_flowmo_staff` claims injected by a Postgres **custom access token hook**. Authorization logic is extracted into a pure, unit-tested function that `middleware.ts` wraps. Tests are Vitest: SQL-level RLS isolation tests via `pg`, a hook unit test, and pure middleware-logic tests.

**Tech Stack:** Next.js 15 · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres 15, Auth, `@supabase/ssr`) · Vitest · `pg` · zod · pnpm · GitHub Actions · Supabase CLI (Docker).

**Locked decisions (from §17):** customer brings own AI key (no usage table) · multi-currency per tenant (`GBP`/`EUR`/`USD`) · `renewal_mode` defaults to `rolling_monthly`.

**Prerequisites on the build machine:** Node ≥ 20, `pnpm` ≥ 9, Docker Desktop running (Supabase CLI needs it), Supabase CLI ≥ 1.200 (`brew install supabase/tap/supabase`).

**Brand rule:** no "n8n"/"workflow"/"execution"/"CabLab" string may appear in any file under this epic except `supabase/` internal comments and `*.test.ts`. Engine columns are named `engine_workflow_id` / `engine_project_id` (internal), never surfaced.

---

## File structure (created by this epic)

```
package.json                         # deps + scripts
pnpm-lock.yaml
tsconfig.json
next.config.ts
postcss.config.mjs                   # Tailwind v4 plugin
vitest.config.ts
.env.example                         # documented env contract
.env.local                           # local secrets (gitignored)
.gitignore
src/
  app/
    layout.tsx                       # root layout, imports globals.css
    page.tsx                         # placeholder landing ("CabbyBot")
    globals.css                      # @import "tailwindcss"
  env.ts                             # zod-validated env accessor
  lib/
    supabase/
      browser.ts                     # createBrowserClient wrapper
      server.ts                      # createServerClient (RSC / route handlers)
      middleware.ts                  # createServerClient for middleware + session refresh
  middleware/
    access.ts                        # pure evaluateAccess() authorization logic
middleware.ts                        # Next.js middleware entrypoint (wraps access.ts)
supabase/
  config.toml                        # invite-only auth, MFA, custom-token hook
  migrations/
    0001_core_tenants.sql
    0002_automations_channels.sql
    0003_conversations_bookings.sql
    0004_billing_audit.sql
    0005_rls_policies.sql
    0006_custom_access_token_hook.sql
tests/
  helpers/db.ts                      # pg connection helpers (postgres + asUser)
  schema.test.ts                     # tables/constraints/decisions exist
  rls.test.ts                        # tenant isolation + automation restriction + audit
  hook.test.ts                       # custom_access_token_hook claim injection
  access.test.ts                     # evaluateAccess() cases
.github/
  workflows/ci.yml                   # lint + typecheck + migration + tests
```

**Responsibility boundaries:** migrations are split by domain (tenants → automation graph → conversations/bookings → billing/audit → security → auth hook) so each is small and reviewable. App-side auth splits into *transport* (`src/lib/supabase/*`, `middleware.ts`) and *policy* (`src/middleware/access.ts`), so the policy is pure and testable.

---

## Task 1: Initialize the Next.js 15 project + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Scaffold with create-next-app**

Run (non-interactive, App Router, no src-less, Tailwind, TS, pnpm):

```bash
cd /Users/sarahbose/Desktop/CabbyBot
pnpm dlx create-next-app@latest . \
  --ts --app --src-dir --tailwind --eslint \
  --import-alias "@/*" --no-turbopack --use-pnpm --yes
```

If the CLI refuses because the directory is non-empty (CLAUDE.md / PRD / docs exist), scaffold in a temp dir and move files in:

```bash
pnpm dlx create-next-app@latest /tmp/cabbybot-init \
  --ts --app --src-dir --tailwind --eslint \
  --import-alias "@/*" --no-turbopack --use-pnpm --yes
rsync -a --ignore-existing /tmp/cabbybot-init/ /Users/sarahbose/Desktop/CabbyBot/
rm -rf /tmp/cabbybot-init
```

- [ ] **Step 2: Pin React 19 + Next 15 and confirm Tailwind v4**

Ensure `package.json` has these versions (edit if create-next-app pinned lower):

```json
{
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  },
  "devDependencies": {
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "typescript": "^5.6.0"
  }
}
```

Confirm `src/app/globals.css` starts with the Tailwind v4 import (create-next-app v15 emits this):

```css
@import "tailwindcss";
```

And `postcss.config.mjs`:

```js
const config = {
  plugins: { "@tailwindcss/postcss": {} },
};
export default config;
```

- [ ] **Step 3: Replace the placeholder landing page**

`src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">CabbyBot</h1>
      <p className="text-neutral-500">Your cab company. On every channel. On autopilot.</p>
    </main>
  );
}
```

`src/app/layout.tsx` (keep generated metadata, ensure title):

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CabbyBot",
  description: "Bespoke AI booking & support automations for the global taxi industry.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verify the app builds**

Run: `pnpm build`
Expected: `✓ Compiled successfully` and a `/` route in the build output, exit code 0.

- [ ] **Step 5: Initialize git and commit**

```bash
cd /Users/sarahbose/Desktop/CabbyBot
git init
git add -A
git commit -m "chore: scaffold Next.js 15 + Tailwind v4 app skeleton

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Vitest setup + first smoke test

**Files:**
- Create: `vitest.config.ts`, `tests/smoke.test.ts`
- Modify: `package.json` (scripts + devDeps)

- [ ] **Step 1: Add test deps and scripts**

```bash
pnpm add -D vitest@^2.1.0 pg@^8.13.0 @types/pg@^8.11.0 zod@^3.23.0 dotenv@^16.4.0
```

Add to `package.json` `"scripts"`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    fileParallelism: false, // DB tests share one local Postgres
  },
});
```

- [ ] **Step 3: Write the failing smoke test**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

Run: `pnpm test`
Expected: PASS — 1 passed.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/smoke.test.ts package.json pnpm-lock.yaml
git commit -m "chore: add Vitest + db/zod test deps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Supabase local init + auth config

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), then edit

- [ ] **Step 1: Initialize Supabase**

```bash
cd /Users/sarahbose/Desktop/CabbyBot
supabase init
```

This creates `supabase/config.toml` and `supabase/migrations/`.

- [ ] **Step 2: Configure invite-only auth + MFA + the token hook**

Edit `supabase/config.toml`. Find the `[auth]` block and set:

```toml
[auth]
enabled = true
site_url = "http://localhost:3000"
# Public signup disabled — all accounts via admin invite() (PRD §7.3)
enable_signup = false
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = false
enable_confirmations = true

[auth.mfa]
max_enrolled_factors = 10

[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true

# Custom access token hook injects tenant_id, role, is_flowmo_staff,
# automation_restrictions into the JWT (added in migration 0006).
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

- [ ] **Step 3: Start Supabase and confirm it boots**

```bash
supabase start
```

Expected: prints API URL `http://127.0.0.1:54321`, DB URL `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, anon key, service_role key. Keep these for `.env.local` (Task 12). Leave it running for subsequent tasks.

- [ ] **Step 4: Commit**

```bash
git add supabase/config.toml
git commit -m "chore: supabase init; invite-only auth, MFA, token hook config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Migration — core tenant tables

**Files:**
- Create: `supabase/migrations/0001_core_tenants.sql`
- Create: `tests/helpers/db.ts`
- Create: `tests/schema.test.ts`

- [ ] **Step 1: Write the DB test helper**

`tests/helpers/db.ts`:

```ts
import { Client } from "pg";

export const DB_URL =
  process.env.SUPABASE_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Connect as the superuser `postgres` role (bypasses RLS). */
export async function withPostgres<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/**
 * Run `fn` inside a transaction impersonating an authenticated user.
 * Sets request.jwt.claims (so auth.uid() works) then switches to the
 * `authenticated` role so RLS applies. Always rolls back.
 */
export async function asUser(
  userId: string,
  fn: (q: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>) => Promise<void>,
): Promise<void> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await c.query("SET LOCAL role authenticated");
    const q = async (sql: string, params?: unknown[]) =>
      (await c.query(sql, params)).rows as Record<string, unknown>[];
    await fn(q);
  } finally {
    await c.query("ROLLBACK").catch(() => {});
    await c.end();
  }
}
```

- [ ] **Step 2: Write the failing schema test**

`tests/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { withPostgres } from "./helpers/db";

async function columnDefault(table: string, column: string): Promise<string | null> {
  return withPostgres(async (c) => {
    const { rows } = await c.query(
      `select column_default from information_schema.columns
       where table_schema='public' and table_name=$1 and column_name=$2`,
      [table, column],
    );
    return rows[0]?.column_default ?? null;
  });
}

async function checkClause(table: string): Promise<string[]> {
  return withPostgres(async (c) => {
    const { rows } = await c.query(
      `select cc.check_clause
       from information_schema.table_constraints tc
       join information_schema.check_constraints cc using (constraint_schema, constraint_name)
       where tc.table_schema='public' and tc.table_name=$1`,
      [table],
    );
    return rows.map((r) => r.check_clause as string);
  });
}

describe("0001 core tenant schema", () => {
  it("creates tenants with multi-currency and rolling_monthly renewal default", async () => {
    const checks = (await checkClause("tenants")).join(" | ");
    expect(checks).toContain("GBP");
    expect(checks).toContain("EUR");
    expect(checks).toContain("USD");
    const renewal = await columnDefault("tenants", "renewal_mode");
    expect(renewal).toContain("rolling_monthly");
  });

  it("creates tenant_users with role + automation_restrictions", async () => {
    const checks = (await checkClause("tenant_users")).join(" | ");
    expect(checks).toContain("Owner");
    expect(checks).toContain("Viewer");
    const def = await columnDefault("tenant_users", "automation_restrictions");
    expect(def).toContain("{}");
  });

  it("does NOT create a token usage table (customer brings own AI key)", async () => {
    const exists = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select 1 from information_schema.tables
         where table_schema='public' and table_name in ('token_usage','usage_statements')`,
      );
      return rows.length > 0;
    });
    expect(exists).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm test tests/schema.test.ts`
Expected: FAIL — relation "tenants" does not exist (table not created yet).

- [ ] **Step 4: Write the migration**

`supabase/migrations/0001_core_tenants.sql` (PRD §8.1, with the locked `renewal_mode` decision; no token-usage table per the own-key decision):

```sql
-- Tenants (one per cab company)
create table public.tenants (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text unique not null,
  country            text not null,
  plan_band          text not null check (plan_band in ('A-Single','A-Bundle','B-Single','B-Bundle','Custom')),
  currency           text not null check (currency in ('GBP','EUR','USD')),
  stripe_customer_id text,
  status             text not null default 'onboarding' check (status in ('onboarding','active','suspended','churned')),
  contract_start     date,
  contract_renewal   date,
  -- §17 Q8 decision: roll to monthly after the 12-month term
  renewal_mode       text not null default 'rolling_monthly' check (renewal_mode in ('rolling_monthly','auto_12mo')),
  monthly_price      numeric(10,2),
  setup_fee_paid     boolean default false,
  is_demo            boolean default false,
  dispatch_adapter   text not null default 'autocab' check (dispatch_adapter in ('autocab','icabbi','cordic')),
  dispatch_company_id text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- Users (linked to Supabase Auth)
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  is_demo_user  boolean default false,
  last_login_at timestamptz,
  created_at    timestamptz default now()
);

-- Tenant users (many-to-many with role)
create table public.tenant_users (
  tenant_id     uuid references public.tenants(id) on delete cascade,
  user_id       uuid references public.users(id) on delete cascade,
  role          text not null check (role in ('Owner','Admin','Viewer')),
  automation_restrictions uuid[] not null default '{}',  -- empty = all automations visible
  invited_by    uuid references public.users(id),
  invited_at    timestamptz default now(),
  accepted_at   timestamptz,
  primary key (tenant_id, user_id)
);

create index tenant_users_user_id_idx on public.tenant_users (user_id);
```

- [ ] **Step 5: Apply migrations and re-run the test**

```bash
supabase db reset
pnpm test tests/schema.test.ts
```

Expected: `supabase db reset` applies `0001` cleanly; test PASSES (3 passed).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_core_tenants.sql tests/helpers/db.ts tests/schema.test.ts
git commit -m "feat(db): core tenant tables (tenants, users, tenant_users)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Migration — automations + channels

**Files:**
- Create: `supabase/migrations/0002_automations_channels.sql`
- Modify: `tests/schema.test.ts` (append a describe block)

- [ ] **Step 1: Append the failing test**

Add to `tests/schema.test.ts`:

```ts
describe("0002 automations + channels", () => {
  it("creates automations scoped to a tenant with engine ids", async () => {
    const cols = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select column_name from information_schema.columns
         where table_schema='public' and table_name='automations'`,
      );
      return rows.map((r) => r.column_name as string);
    });
    expect(cols).toEqual(
      expect.arrayContaining(["tenant_id", "type", "engine_workflow_id", "engine_project_id", "status"]),
    );
  });

  it("creates channels bound to exactly one automation", async () => {
    const checks = (await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select cc.check_clause from information_schema.table_constraints tc
         join information_schema.check_constraints cc using (constraint_schema, constraint_name)
         where tc.table_schema='public' and tc.table_name='channels'`,
      );
      return rows.map((r) => r.check_clause as string);
    })).join(" | ");
    expect(checks).toContain("whatsapp");
    expect(checks).toContain("widget");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/schema.test.ts`
Expected: FAIL — relation "automations" does not exist.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0002_automations_channels.sql` (PRD §8.1):

```sql
-- Automations (one or more per tenant)
create table public.automations (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  name               text not null,
  type               text not null check (type in ('Booking','Support','Driver','Custom')),
  engine_workflow_id text,   -- internal engine workflow id (never surfaced)
  engine_project_id  text,   -- internal engine project id (never surfaced)
  status             text not null default 'building' check (status in ('building','uat','live','stopped','error')),
  dispatch_adapter   text check (dispatch_adapter in ('autocab','icabbi','cordic')),
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index automations_tenant_idx on public.automations (tenant_id);

-- Channels (each bound to exactly one automation)
create table public.channels (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  automation_id    uuid not null references public.automations(id) on delete cascade,
  type             text not null check (type in ('whatsapp','telegram','messenger','instagram','widget')),
  external_id      text,
  webhook_path     text not null,
  credentials_ref  text,            -- vault reference; never the credential itself
  status           text not null default 'active' check (status in ('active','error','disconnected')),
  token_expires_at timestamptz,
  last_message_at  timestamptz,
  created_at       timestamptz default now()
);
create index channels_automation_idx on public.channels (automation_id);
create index channels_tenant_idx on public.channels (tenant_id);
```

- [ ] **Step 4: Apply + re-run**

```bash
supabase db reset
pnpm test tests/schema.test.ts
```

Expected: PASS (all schema tests green).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_automations_channels.sql tests/schema.test.ts
git commit -m "feat(db): automations + channels tables

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Migration — conversations, messages, bookings, runs

**Files:**
- Create: `supabase/migrations/0003_conversations_bookings.sql`
- Modify: `tests/schema.test.ts`

- [ ] **Step 1: Append the failing test**

Add to `tests/schema.test.ts`:

```ts
describe("0003 conversations + bookings", () => {
  it("creates bookings with dispatch + airport audit fields", async () => {
    const cols = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select column_name from information_schema.columns
         where table_schema='public' and table_name='bookings'`,
      );
      return rows.map((r) => r.column_name as string);
    });
    expect(cols).toEqual(
      expect.arrayContaining([
        "tenant_id", "automation_id", "conversation_id", "dispatch_ref",
        "pickup_address", "destination_address", "airport_json", "raw_dispatch_json",
        "your_reference_1", "your_reference_2", "your_reference_3",
      ]),
    );
  });

  it("creates conversations.outcome and messages.message_type with PRD enums", async () => {
    const checks = (await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select cc.check_clause from information_schema.table_constraints tc
         join information_schema.check_constraints cc using (constraint_schema, constraint_name)
         where tc.table_schema='public' and tc.table_name in ('conversations','messages')`,
      );
      return rows.map((r) => r.check_clause as string);
    })).join(" | ");
    expect(checks).toContain("abandoned");   // conversations.outcome
    expect(checks).toContain("voice");        // messages.message_type
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/schema.test.ts`
Expected: FAIL — relation "bookings" does not exist.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0003_conversations_bookings.sql` (PRD §8.1):

```sql
-- Conversations (one per customer chat session per automation)
create table public.conversations (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  automation_id      uuid not null references public.automations(id) on delete cascade,
  channel_id         uuid references public.channels(id),
  customer_handle    text not null,
  customer_name      text,
  language           text default 'en',
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  outcome            text check (outcome in ('booked','quoted','abandoned','managed','cancelled','unknown')),
  abandonment_reason text
);
create index conversations_automation_idx on public.conversations (automation_id);
create index conversations_tenant_idx on public.conversations (tenant_id);

-- Messages (every turn in a conversation)
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  direction        text not null check (direction in ('inbound','outbound')),
  message_type     text not null default 'text' check (message_type in ('text','voice','location','image','interactive','card')),
  payload          jsonb not null,
  transcript       text,
  intent_extracted jsonb,
  ts               timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id);

-- Bookings (one per confirmed booking)
create table public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  automation_id       uuid not null references public.automations(id) on delete cascade,
  conversation_id     uuid references public.conversations(id),
  channel_type        text,
  dispatch_ref        text,
  dispatch_adapter    text,
  passenger_name      text,
  customer_handle     text,
  pickup_address      jsonb,
  destination_address jsonb,
  vehicle_type        text,
  passenger_count     integer,
  fare                numeric(10,2),
  currency            text default 'GBP',
  pickup_at_utc       timestamptz,
  pickup_time_mode    text,
  airport_json        jsonb,
  driver_note         text,
  payment_method      text,
  status              text not null default 'confirmed' check (status in ('confirmed','dispatched','completed','cancelled','no_show')),
  your_reference_1    text,
  your_reference_2    text,
  your_reference_3    text,
  raw_dispatch_json   jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz default now()
);
create index bookings_automation_idx on public.bookings (automation_id);
create index bookings_tenant_idx on public.bookings (tenant_id);

-- Automation runs (engine executions synced into Supabase)
create table public.automation_runs (
  id              uuid primary key default gen_random_uuid(),
  automation_id   uuid not null references public.automations(id) on delete cascade,
  engine_run_id   text,
  status          text not null check (status in ('running','success','error','cancelled')),
  started_at      timestamptz not null,
  finished_at     timestamptz,
  duration_ms     integer,
  error_message   text,
  trigger_channel text,
  trigger_phone   text   -- sanitised; no raw PII
);
create index automation_runs_automation_idx on public.automation_runs (automation_id);
```

- [ ] **Step 4: Apply + re-run**

```bash
supabase db reset
pnpm test tests/schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_conversations_bookings.sql tests/schema.test.ts
git commit -m "feat(db): conversations, messages, bookings, automation_runs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Migration — subscriptions, setup_fees, audit_log

**Files:**
- Create: `supabase/migrations/0004_billing_audit.sql`
- Modify: `tests/schema.test.ts`

- [ ] **Step 1: Append the failing test**

Add to `tests/schema.test.ts`:

```ts
describe("0004 billing + audit", () => {
  it("creates subscriptions, setup_fees, audit_log", async () => {
    const tables = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select table_name from information_schema.tables
         where table_schema='public' and table_name in ('subscriptions','setup_fees','audit_log')`,
      );
      return rows.map((r) => r.table_name as string);
    });
    expect(tables.sort()).toEqual(["audit_log", "setup_fees", "subscriptions"]);
  });

  it("audit_log id is a bigserial (append-only ledger)", async () => {
    const def = await withPostgres(async (c) => {
      const { rows } = await c.query(
        `select column_default from information_schema.columns
         where table_schema='public' and table_name='audit_log' and column_name='id'`,
      );
      return rows[0]?.column_default as string;
    });
    expect(def).toContain("nextval");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/schema.test.ts`
Expected: FAIL — relation "subscriptions" does not exist.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0004_billing_audit.sql` (PRD §8.1):

```sql
-- Subscriptions (Stripe ↔ tenant)
create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  stripe_sub_id        text unique not null,
  plan_band            text not null,
  monthly_price        numeric(10,2),
  currency             text,
  status               text,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  contract_end         date,
  cancel_at            timestamptz
);
create index subscriptions_tenant_idx on public.subscriptions (tenant_id);

-- Setup fees
create table public.setup_fees (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  stripe_invoice_id text unique,
  amount            numeric(10,2),
  currency          text,
  paid_at           timestamptz
);
create index setup_fees_tenant_idx on public.setup_fees (tenant_id);

-- Audit log (immutable, append-only; bigserial ledger)
create table public.audit_log (
  id            bigserial primary key,
  tenant_id     uuid references public.tenants(id),
  actor_user_id uuid references public.users(id),
  action        text not null,
  target_type   text,
  target_id     text,
  metadata      jsonb,
  ip_address    inet,
  ts            timestamptz not null default now()
);
create index audit_log_tenant_idx on public.audit_log (tenant_id);
```

- [ ] **Step 4: Apply + re-run**

```bash
supabase db reset
pnpm test tests/schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_billing_audit.sql tests/schema.test.ts
git commit -m "feat(db): subscriptions, setup_fees, append-only audit_log

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Migration — RLS policies + isolation tests

This is the security core of the epic. RLS keys on `auth.uid()` → `tenant_users` (PRD §8.2). The Viewer `automation_restrictions` rule applies to automation-scoped tables.

**Files:**
- Create: `supabase/migrations/0005_rls_policies.sql`
- Create: `tests/rls.test.ts`

- [ ] **Step 1: Write the failing RLS test**

`tests/rls.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withPostgres, asUser } from "./helpers/db";

// Deterministic fixtures across two tenants.
const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";
const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // member of tenant A (Owner)
const USER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // member of tenant B (Owner)
const USER_V = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // tenant A Viewer restricted to AUTO_A1
const AUTO_A1 = "a1111111-1111-1111-1111-111111111111";
const AUTO_A2 = "a2222222-2222-2222-2222-222222222222";
const AUTO_B1 = "b1111111-1111-1111-1111-111111111111";

beforeAll(async () => {
  await withPostgres(async (c) => {
    await c.query("begin");
    // auth.users rows so public.users FK is satisfiable
    for (const [id, email] of [
      [USER_A, "owner-a@acme-cabs.com"],
      [USER_B, "owner-b@other-cabs.com"],
      [USER_V, "viewer-a@acme-cabs.com"],
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
      [TENANT_A, "Acme Cabs", "acme-cabs"],
      [TENANT_B, "Other Cabs", "other-cabs"],
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
    await c.query(
      `insert into public.tenant_users (tenant_id, user_id, role, automation_restrictions)
       values ($1, $2, 'Viewer', $3::uuid[]) on conflict do nothing`,
      [TENANT_A, USER_V, `{${AUTO_A1}}`],
    );
    for (const [id, tenant, name] of [
      [AUTO_A1, TENANT_A, "WA Booking Bot"],
      [AUTO_A2, TENANT_A, "Telegram Support"],
      [AUTO_B1, TENANT_B, "WA Booking Bot"],
    ] as const) {
      await c.query(
        `insert into public.automations (id, tenant_id, name, type)
         values ($1, $2, $3, 'Booking') on conflict (id) do nothing`,
        [id, tenant, name],
      );
    }
    await c.query("commit");
  });
});

afterAll(async () => {
  await withPostgres(async (c) => {
    await c.query("delete from public.automations where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.tenant_users where tenant_id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.tenants where id in ($1,$2)", [TENANT_A, TENANT_B]);
    await c.query("delete from public.users where id in ($1,$2,$3)", [USER_A, USER_B, USER_V]);
    await c.query("delete from auth.users where id in ($1,$2,$3)", [USER_A, USER_B, USER_V]);
  });
});

describe("RLS tenant isolation", () => {
  it("owner of tenant A sees only tenant A automations", async () => {
    await asUser(USER_A, async (q) => {
      const rows = await q("select id from public.automations order by name");
      const ids = rows.map((r) => r.id);
      expect(ids).toEqual(expect.arrayContaining([AUTO_A1, AUTO_A2]));
      expect(ids).not.toContain(AUTO_B1);
    });
  });

  it("owner of tenant B cannot see tenant A automations", async () => {
    await asUser(USER_B, async (q) => {
      const rows = await q("select id from public.automations");
      expect(rows.map((r) => r.id)).toEqual([AUTO_B1]);
    });
  });

  it("restricted Viewer sees only the allowed automation", async () => {
    await asUser(USER_V, async (q) => {
      const rows = await q("select id from public.automations");
      expect(rows.map((r) => r.id)).toEqual([AUTO_A1]);
    });
  });

  it("a tenant user cannot insert an automation for another tenant", async () => {
    await asUser(USER_A, async (q) => {
      await expect(
        q(
          `insert into public.automations (tenant_id, name, type)
           values ($1, 'Sneaky', 'Booking')`,
          [TENANT_B],
        ),
      ).rejects.toThrow();
    });
  });

  it("tenant users cannot read the audit_log", async () => {
    await asUser(USER_A, async (q) => {
      await expect(q("select * from public.audit_log")).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/rls.test.ts`
Expected: FAIL — with RLS not yet enabled, `USER_B` would see all automations (isolation assertions fail), and the audit_log SELECT would NOT throw.

- [ ] **Step 3: Write the RLS migration**

`supabase/migrations/0005_rls_policies.sql`:

```sql
-- Enable RLS on all tenant-scoped tables
alter table public.tenants        enable row level security;
alter table public.tenant_users   enable row level security;
alter table public.automations    enable row level security;
alter table public.channels       enable row level security;
alter table public.conversations  enable row level security;
alter table public.messages       enable row level security;
alter table public.bookings       enable row level security;
alter table public.automation_runs enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.setup_fees     enable row level security;
alter table public.audit_log      enable row level security;

-- Helper: the set of tenant ids the current user belongs to
create or replace function public.current_user_tenants()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.tenant_users where user_id = auth.uid();
$$;

-- Helper: automations the current user may see within a tenant,
-- honouring the Viewer automation_restrictions array ('{}' = all).
create or replace function public.user_can_see_automation(p_tenant uuid, p_automation uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tenant_users tu
    where tu.user_id = auth.uid()
      and tu.tenant_id = p_tenant
      and (
        tu.automation_restrictions = '{}'
        or p_automation = any (tu.automation_restrictions)
      )
  );
$$;

-- tenants: a user sees tenants they belong to
create policy tenant_self_read on public.tenants
  for select using (id in (select public.current_user_tenants()));

-- tenant_users: a user sees membership rows of their own tenants
create policy tenant_users_read on public.tenant_users
  for select using (tenant_id in (select public.current_user_tenants()));

-- automations: tenant isolation + per-Viewer automation restriction
create policy automations_select on public.automations
  for select using (public.user_can_see_automation(tenant_id, id));
create policy automations_write on public.automations
  for all using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));

-- channels: scoped by tenant + visible automation
create policy channels_select on public.channels
  for select using (public.user_can_see_automation(tenant_id, automation_id));
create policy channels_write on public.channels
  for all using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));

-- conversations
create policy conversations_select on public.conversations
  for select using (public.user_can_see_automation(tenant_id, automation_id));
create policy conversations_write on public.conversations
  for all using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));

-- messages: inherit visibility from the parent conversation
create policy messages_select on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.user_can_see_automation(c.tenant_id, c.automation_id)
    )
  );

-- bookings
create policy bookings_select on public.bookings
  for select using (public.user_can_see_automation(tenant_id, automation_id));
create policy bookings_write on public.bookings
  for all using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));

-- automation_runs: inherit from the parent automation's tenant
create policy automation_runs_select on public.automation_runs
  for select using (
    exists (
      select 1 from public.automations a
      where a.id = automation_runs.automation_id
        and public.user_can_see_automation(a.tenant_id, a.id)
    )
  );

-- subscriptions / setup_fees: tenant read only
create policy subscriptions_read on public.subscriptions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy setup_fees_read on public.setup_fees
  for select using (tenant_id in (select public.current_user_tenants()));

-- audit_log: NO policy granting SELECT to tenant users.
-- RLS is enabled with zero permissive SELECT policies, so authenticated
-- users get nothing; only service_role / FlowMo admin (bypass) can read it.
```

- [ ] **Step 4: Apply + re-run**

```bash
supabase db reset
pnpm test tests/rls.test.ts
```

Expected: PASS (5 passed) — isolation holds, cross-tenant insert rejected, audit_log unreadable.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_rls_policies.sql tests/rls.test.ts
git commit -m "feat(db): RLS tenant isolation + Viewer automation restrictions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Migration — custom access token hook (JWT claims)

Injects `tenant_id`, `role`, `is_flowmo_staff`, `automation_restrictions` into the JWT so `middleware.ts` can authorise without a DB round-trip. Runs as `supabase_auth_admin`.

**Files:**
- Create: `supabase/migrations/0006_custom_access_token_hook.sql`
- Create: `tests/hook.test.ts`

- [ ] **Step 1: Write the failing hook test**

`tests/hook.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { withPostgres } from "./helpers/db";

const TENANT = "33333333-3333-3333-3333-333333333333";
const STAFF = "dddddddd-dddd-dddd-dddd-dddddddddddd";   // @flowmoai.com
const TENANT_USER = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const AUTO = "f1111111-1111-1111-1111-111111111111";

beforeAll(async () => {
  await withPostgres(async (c) => {
    await c.query(
      `insert into public.tenants (id, name, slug, country, plan_band, currency)
       values ($1, 'Hook Co', 'hook-co', 'GB', 'A-Single', 'GBP') on conflict do nothing`,
      [TENANT],
    );
    for (const [id, email] of [
      [STAFF, "ops@flowmoai.com"],
      [TENANT_USER, "raj@hook-co.com"],
    ] as const) {
      await c.query(
        `insert into auth.users (instance_id, id, aud, role, email)
         values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2)
         on conflict (id) do nothing`,
        [id, email],
      );
      await c.query(`insert into public.users (id, email) values ($1, $2) on conflict do nothing`, [id, email]);
    }
    await c.query(
      `insert into public.tenant_users (tenant_id, user_id, role, automation_restrictions)
       values ($1, $2, 'Admin', $3::uuid[]) on conflict do nothing`,
      [TENANT, TENANT_USER, `{${AUTO}}`],
    );
  });
});

afterAll(async () => {
  await withPostgres(async (c) => {
    await c.query("delete from public.tenant_users where tenant_id = $1", [TENANT]);
    await c.query("delete from public.tenants where id = $1", [TENANT]);
    await c.query("delete from public.users where id in ($1,$2)", [STAFF, TENANT_USER]);
    await c.query("delete from auth.users where id in ($1,$2)", [STAFF, TENANT_USER]);
  });
});

function callHook(userId: string, email: string) {
  return withPostgres(async (c) => {
    const event = { user_id: userId, claims: { sub: userId, email } };
    const { rows } = await c.query("select public.custom_access_token_hook($1::jsonb) as out", [
      JSON.stringify(event),
    ]);
    return (rows[0].out as { claims: Record<string, unknown> }).claims;
  });
}

describe("custom_access_token_hook", () => {
  it("injects tenant_id, role, automation_restrictions for a tenant user", async () => {
    const claims = await callHook(TENANT_USER, "raj@hook-co.com");
    expect(claims.tenant_id).toBe(TENANT);
    expect(claims.role).toBe("Admin");
    expect(claims.automation_restrictions).toEqual([AUTO]);
    expect(claims.is_flowmo_staff).toBe(false);
  });

  it("flags is_flowmo_staff for a @flowmoai.com email", async () => {
    const claims = await callHook(STAFF, "ops@flowmoai.com");
    expect(claims.is_flowmo_staff).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/hook.test.ts`
Expected: FAIL — function `public.custom_access_token_hook` does not exist.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0006_custom_access_token_hook.sql`:

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_user_id uuid;
  v_email   text;
  v_claims  jsonb;
  v_tenant  uuid;
  v_role    text;
  v_restr   uuid[];
begin
  v_user_id := (event ->> 'user_id')::uuid;
  v_claims  := coalesce(event -> 'claims', '{}'::jsonb);
  v_email   := v_claims ->> 'email';

  -- v1: a user belongs to a single tenant; take the first membership.
  select tu.tenant_id, tu.role, tu.automation_restrictions
    into v_tenant, v_role, v_restr
  from public.tenant_users tu
  where tu.user_id = v_user_id
  order by tu.invited_at
  limit 1;

  if v_tenant is not null then
    v_claims := jsonb_set(v_claims, '{tenant_id}', to_jsonb(v_tenant));
    v_claims := jsonb_set(v_claims, '{role}', to_jsonb(v_role));
    v_claims := jsonb_set(v_claims, '{automation_restrictions}', to_jsonb(coalesce(v_restr, '{}'::uuid[])));
  end if;

  -- FLOWMO_STAFF_EMAIL_DOMAIN = flowmoai.com
  v_claims := jsonb_set(
    v_claims, '{is_flowmo_staff}',
    to_jsonb(coalesce(v_email like '%@flowmoai.com', false))
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- The hook executes as supabase_auth_admin during token issuance.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.tenant_users to supabase_auth_admin;
-- Keep the hook off the API roles.
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
```

- [ ] **Step 4: Apply + re-run**

```bash
supabase db reset
pnpm test tests/hook.test.ts
```

Expected: PASS (2 passed).

- [ ] **Step 5: Run the whole DB suite to confirm no regressions**

Run: `pnpm test`
Expected: PASS — smoke + schema + rls + hook all green.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_custom_access_token_hook.sql tests/hook.test.ts
git commit -m "feat(auth): custom access token hook injects tenant/role/staff claims

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Supabase client wrappers

**Files:**
- Create: `src/lib/supabase/browser.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the SSR package**

```bash
pnpm add @supabase/ssr@^0.5.0 @supabase/supabase-js@^2.45.0
```

- [ ] **Step 2: Browser client**

`src/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/env";

export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
```

- [ ] **Step 3: Server client (RSC + route handlers)**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — safe to ignore; middleware refreshes the session.
        }
      },
    },
  });
}
```

- [ ] **Step 4: Middleware client (session refresh)**

`src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/env";

/** Builds a Supabase client bound to the middleware request/response cookie jar. */
export function createMiddlewareClient(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  return { supabase, response };
}
```

- [ ] **Step 5: Typecheck (env not yet created — expect a known error, fixed in Task 12)**

These files import `@/env`, created in Task 12. Do not run typecheck in isolation here; it will be green after Task 12. Proceed.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase package.json pnpm-lock.yaml
git commit -m "feat(auth): Supabase browser/server/middleware client wrappers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Pure authorization logic + middleware entrypoint

The decision logic is a pure function so it can be unit-tested without Next internals. `middleware.ts` resolves claims via Supabase, then delegates.

**Files:**
- Create: `src/middleware/access.ts`, `middleware.ts`, `tests/access.test.ts`

- [ ] **Step 1: Write the failing access test**

`tests/access.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { evaluateAccess, type Claims } from "@/middleware/access";

const tenantClaims: Claims = { sub: "u1", tenant_id: "org-1", role: "Owner", is_flowmo_staff: false };
const staffClaims: Claims = { sub: "s1", tenant_id: null, role: null, is_flowmo_staff: true };

describe("evaluateAccess", () => {
  it("allows public paths without auth", () => {
    expect(evaluateAccess("/", null).kind).toBe("allow");
    expect(evaluateAccess("/pricing", null).kind).toBe("allow");
    expect(evaluateAccess("/login", null).kind).toBe("allow");
    expect(evaluateAccess("/webhooks/whatsapp/abc", null).kind).toBe("allow");
  });

  it("redirects unauthenticated users away from protected paths", () => {
    const r = evaluateAccess("/dashboard", null);
    expect(r).toEqual({ kind: "redirect", to: "/login" });
  });

  it("lets an authed tenant user into their dashboard", () => {
    expect(evaluateAccess("/dashboard", tenantClaims).kind).toBe("allow");
  });

  it("blocks /admin for non-staff", () => {
    expect(evaluateAccess("/admin", tenantClaims)).toEqual({ kind: "redirect", to: "/dashboard" });
  });

  it("allows /admin for FlowMo staff", () => {
    expect(evaluateAccess("/admin/tenants", staffClaims).kind).toBe("allow");
  });

  it("forbids API access to another tenant's org id", () => {
    expect(evaluateAccess("/api/orgs/org-2/automations", tenantClaims)).toEqual({ kind: "forbidden" });
  });

  it("allows API access to the user's own org id", () => {
    expect(evaluateAccess("/api/orgs/org-1/automations", tenantClaims).kind).toBe("allow");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test tests/access.test.ts`
Expected: FAIL — cannot find module `@/middleware/access`.

- [ ] **Step 3: Write the access policy**

`src/middleware/access.ts`:

```ts
export type Claims = {
  sub: string;
  tenant_id: string | null;
  role: "Owner" | "Admin" | "Viewer" | null;
  is_flowmo_staff: boolean;
};

export type AccessDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string }
  | { kind: "forbidden" };

// Paths reachable without a session.
const PUBLIC_PREFIXES = ["/login", "/auth", "/webhooks", "/_next", "/favicon", "/demo"];
const PUBLIC_PAGES = new Set([
  "/", "/pricing", "/how-it-works", "/channels", "/custom-solutions",
  "/case-studies", "/about", "/contact", "/privacy", "/terms", "/dpa", "/cookies",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Pure route authorization. `claims` is null for unauthenticated requests. */
export function evaluateAccess(pathname: string, claims: Claims | null): AccessDecision {
  if (isPublic(pathname)) return { kind: "allow" };

  if (!claims) return { kind: "redirect", to: "/login" };

  // Admin surface: FlowMo staff only.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return claims.is_flowmo_staff ? { kind: "allow" } : { kind: "redirect", to: "/dashboard" };
  }

  // Tenant API: the :orgId segment must match the caller's tenant.
  const orgMatch = pathname.match(/^\/api\/orgs\/([^/]+)/);
  if (orgMatch) {
    const orgId = orgMatch[1];
    if (claims.is_flowmo_staff) return { kind: "allow" };
    return orgId === claims.tenant_id ? { kind: "allow" } : { kind: "forbidden" };
  }

  // Everything else under /dashboard etc. requires a session (already true here).
  return { kind: "allow" };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test tests/access.test.ts`
Expected: PASS (7 passed).

- [ ] **Step 5: Write the middleware entrypoint**

`middleware.ts` (repo root):

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { evaluateAccess, type Claims } from "@/middleware/access";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  // Refreshes the session cookie and returns verified claims.
  const { data } = await supabase.auth.getClaims();
  const raw = data?.claims as Record<string, unknown> | undefined;

  const claims: Claims | null = raw
    ? {
        sub: String(raw.sub),
        tenant_id: (raw.tenant_id as string) ?? null,
        role: (raw.role as Claims["role"]) ?? null,
        is_flowmo_staff: Boolean(raw.is_flowmo_staff),
      }
    : null;

  const decision = evaluateAccess(request.nextUrl.pathname, claims);

  if (decision.kind === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    return NextResponse.redirect(url);
  }
  if (decision.kind === "forbidden") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return response;
}

export const config = {
  // Run on everything except static assets; logic above whitelists public paths.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Commit**

```bash
git add src/middleware/access.ts middleware.ts tests/access.test.ts
git commit -m "feat(auth): pure evaluateAccess policy + route-protecting middleware

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Env validation + `.env.example`

**Files:**
- Create: `src/env.ts`, `.env.example`, `.env.local`
- Modify: `.gitignore` (ensure `.env.local` ignored — create-next-app already does this; verify)

- [ ] **Step 1: Write the zod env accessor**

`src/env.ts`:

```ts
import { z } from "zod";

const schema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Engine (internal only; never exposed to customers)
  N8N_BASE_URL: z.string().url().optional(),
  N8N_API_KEY: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Resend
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default("hello@cabbybot.com"),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Gateway / demo / internal
  WEBHOOK_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
  DEMO_TENANT_ID: z.string().uuid().optional(),
  FLOWMO_STAFF_EMAIL_DOMAIN: z.string().default("flowmoai.com"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
```

- [ ] **Step 2: Write `.env.example`**

`.env.example` (PRD §13 — documented contract, no real secrets):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Engine (internal only; never exposed to customers)
N8N_BASE_URL=
N8N_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@cabbybot.com

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Gateway / demo / internal
WEBHOOK_RATE_LIMIT_PER_MIN=60
DEMO_TENANT_ID=
FLOWMO_STAFF_EMAIL_DOMAIN=flowmoai.com

# Tests only (defaults to local supabase if unset)
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

- [ ] **Step 3: Create `.env.local` from the running Supabase**

Copy `.env.example` to `.env.local`, then fill `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from `supabase status`:

```bash
cp .env.example .env.local
supabase status   # copy the anon key + service_role key into .env.local
```

- [ ] **Step 4: Verify `.env.local` is gitignored**

Run: `git check-ignore .env.local`
Expected: prints `.env.local` (it is ignored). If not, add `.env*.local` to `.gitignore`.

- [ ] **Step 5: Full typecheck + build (now that `@/env` exists)**

```bash
pnpm typecheck
pnpm build
```

Expected: typecheck exits 0; build succeeds. (`build` reads env; ensure `.env.local` is populated.)

- [ ] **Step 6: Commit**

```bash
git add src/env.ts .env.example .gitignore
git commit -m "feat: zod-validated env accessor + documented .env.example

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
        env:
          # build/typecheck need these present; values are placeholders for CI
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-anon
          SUPABASE_SERVICE_ROLE_KEY: ci-service

  db-and-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - run: pnpm install --frozen-lockfile
      # Start local stack (applies all migrations) — this is the migration check.
      - run: supabase start
      # Lint migrations for SQL issues (migration dry-run gate).
      - run: supabase db lint --level warning
      - name: Run Vitest (schema + RLS + hook + access)
        run: pnpm test
        env:
          SUPABASE_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      - if: always()
        run: supabase stop
```

- [ ] **Step 2: Validate locally (mirror the CI steps)**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
supabase db lint --level warning
pnpm test
```

Expected: lint clean, typecheck 0 errors, `db lint` no errors, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, typecheck, supabase migration + Vitest suite

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push and confirm green**

Push the branch and open a PR; confirm both CI jobs pass. (If no remote is configured yet, this step waits until the GitHub repo exists — note it for the team.)

---

## Definition of Done (Epic 1)

- [ ] `pnpm build` succeeds with populated `.env.local`.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm test` passes: `smoke`, `schema` (4 migrations), `rls` (5 isolation cases), `hook` (2 claim cases), `access` (7 policy cases).
- [ ] `supabase db reset` applies all 6 migrations cleanly from scratch.
- [ ] RLS proven: a tenant user cannot read another tenant's rows; a restricted Viewer sees only allowed automations; `audit_log` is unreadable by tenant users.
- [ ] JWT hook injects `tenant_id`, `role`, `is_flowmo_staff`, `automation_restrictions`.
- [ ] No "n8n"/"workflow"/"execution"/"CabLab" strings outside `supabase/` comments and `*.test.ts`.
- [ ] CI green on PR.

**Hand-off to Plan 2 (Marketing) / Plan 4 (Auth):** the Supabase clients, `evaluateAccess`, and middleware skeleton are in place; auth screens and public pages build on top. Use the `ui-ux-pro-max` skill for all UI work starting in Plan 2.

---

## Self-review notes

- **Spec coverage (Epic 1 / §14):** Next.js+TS+Tailwind init (T1) · Supabase schema §8.1 all tables (T4–T7) · RLS §8.2 (T8) · Auth config invite-only+MFA+JWT claims (T3, T9) · client wrappers + middleware (T10–T11) · env management §13 (T12) · CI/CD lint+typecheck+migration dry-run (T13). ✅
- **Locked decisions reflected:** no token-usage table (T4 test asserts absence) · multi-currency CHECK kept (T4) · `renewal_mode` default `rolling_monthly` (T4). ✅
- **Type consistency:** `Claims`, `AccessDecision`, `evaluateAccess` identical across `access.ts`, `access.test.ts`, `middleware.ts`. `withPostgres`/`asUser` signatures identical across all DB tests. ✅
- **Deferred (correct for later epics):** Supabase Vault for credentials → Epic 3; Stripe wiring → Epic 8; engine API client → Epic 5; Realtime subscriptions → Epic 7.
```
