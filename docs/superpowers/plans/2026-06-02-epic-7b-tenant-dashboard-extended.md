# Epic 7b — Tenant Dashboard (Extended: Analytics, Config, Channels, Team, Billing, Support) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. **Every UI task MUST use `ui-ux-pro-max`** with the persisted design system at `design-system/cabbybot-dashboard/MASTER.md`. Tests: `pnpm vitest run <file>`.

**Goal:** Complete the tenant dashboard with the remaining six sections — Analytics (10 sub-sections, recharts), Bot Configuration, Channels, Team, Billing, and Support — all RLS-isolated, role-gated, and built on the Epic-7a foundation.

**Architecture:** Same as 7a. Server Components read via the SSR/RLS client (`@/lib/dashboard/queries` + a new `@/lib/dashboard/analytics.ts`); JSON APIs under `src/app/api/orgs/[orgId]/...` reuse `requireOrgAccess`. Two new tables (`automation_config`, `support_tickets`) with RLS. Team invite uses the service-role admin client **server-side only** behind an Owner-gated server action (mirroring Epic-3 `src/app/admin/credentials/actions.ts`). Billing displays Supabase-stored subscription/setup-fee data; the Stripe Customer Portal + invoice PDFs are Epic 8 — 7b stubs the portal route to return a clear "available soon" response. Analytics aggregates from existing tables; sub-sections needing data not yet captured (per-turn response times, Whisper/voice stats — Epic 10) render honest empty states, never fabricated numbers.

**Tech Stack:** Next.js 15, React 19, TS, Tailwind v4, Supabase SSR + service-role (team invite only), recharts, Vitest.

**Depends on:** Epic 7a (shell, subnav, data layer, components, charts, realtime, guard usage) + Plans 1/3/4/5. Reuses everything in `src/lib/dashboard/` and `src/components/dashboard/` from 7a.

---

## Decisions locked for this plan

- **Design:** reuse the 7a "Data-Dense Dashboard" system (blue-800/amber/slate, Fira Sans). Analytics charts reuse the 7a chart components where they fit and add a few analytics-specific ones (funnel, heatmap, horizontal bar) themed identically.
- **Config storage:** new `automation_config` table, one row per automation, columns for the §9.3.6 editable fields. Writes are **Owner/Admin** (`minRole: "Admin"`); reads any role. Synced to the engine is out of scope here (Epic 5/10 owns the sync trigger) — 7b persists config to Supabase and notes "changes apply on the automation's next run" in the UI.
- **Support storage:** new `support_tickets` table. Any role may open a ticket; listing shows the tenant's tickets. "Request a new automation" pre-fills category `build_request`.
- **Team invite:** Owner-only. Uses `supabase.auth.admin.inviteUserByEmail` via the **service-role client in a server action** (never client-exposed), then inserts a `tenant_users` row. Role change/revoke Owner-only. This is the ONLY 7b surface allowed to touch the service-role key, and only server-side in `src/app/dashboard/team/actions.ts`.
- **Billing:** read-only display from `tenants` + `subscriptions` + `setup_fees`. "Update Payment Method" → `POST /api/orgs/:orgId/billing/portal` returns `503 { error: "Billing portal is being set up." }` until Epic 8 (honest stub). Invoices table shows setup fee + a "monthly invoices arrive with billing go-live (Epic 8)" empty state.
- **Channels:** `POST .../channels/:channelId/test` returns a recorded "test queued" acknowledgement (the actual send is an engine concern; 7b records the intent and returns 200). "Reconnect"/"Add channel" → open a support ticket (structural change).
- **Analytics data honesty:** funnel, channel-mix, mode-split, vehicle, top-zones, top-destinations, heatmap, abandonment are computable from `conversations`/`bookings` and ARE built. **Response-time distribution** and **voice-note stats** need per-message timing + Whisper metadata captured in Epic 10 — render an explicit "Available once voice/timing capture is enabled" empty state. Never fabricate.
- **Security/brand:** identical rules to 7a — RLS client for tenant reads, `requireOrgAccess` on every route with `automationId` for automation-scoped routes, no "n8n/workflow/execution/CabLab" anywhere.

---

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0015_dashboard_config_support.sql` | `automation_config` + `support_tickets` tables + RLS |
| `src/lib/dashboard/analytics.ts` | server-only analytics aggregation queries (RLS client) |
| `src/lib/dashboard/analytics-types.ts` | analytics DTOs (Funnel, ChannelMix, ModeSplit, VehicleSplit, ZoneRow, HeatmapCell, AbandonmentRow) |
| `src/lib/dashboard/config-types.ts` | `AutomationConfig` DTO + zod schema for PATCH validation |
| `src/lib/dashboard/config-queries.ts` | get/update automation config (RLS client) |
| `src/lib/dashboard/channels-queries.ts` | get channels for an automation + channel health |
| `src/lib/dashboard/team-queries.ts` | list members, list audit (RLS client) |
| `src/lib/dashboard/billing-queries.ts` | subscription + setup-fee read (RLS client) |
| `src/lib/dashboard/support-queries.ts` | list/create tickets (RLS client) |
| `src/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route.ts` | analytics JSON (single dynamic route switching on metric) |
| `src/app/api/orgs/[orgId]/automations/[automationId]/config/route.ts` | GET/PATCH config |
| `src/app/api/orgs/[orgId]/automations/[automationId]/channels/route.ts` | GET channels |
| `src/app/api/orgs/[orgId]/automations/[automationId]/channels/[channelId]/test/route.ts` | POST test |
| `src/app/api/orgs/[orgId]/team/route.ts` | GET members |
| `src/app/api/orgs/[orgId]/team/[userId]/route.ts` | PATCH role / DELETE member |
| `src/app/api/orgs/[orgId]/audit/route.ts` | GET audit (last 50) |
| `src/app/api/orgs/[orgId]/billing/subscription/route.ts` | GET subscription+plan |
| `src/app/api/orgs/[orgId]/billing/portal/route.ts` | POST portal (503 stub) |
| `src/app/api/orgs/[orgId]/support/route.ts` | GET list / POST create |
| `src/app/dashboard/team/actions.ts` | Owner-gated server actions: invite (service-role), change role, revoke |
| `src/app/dashboard/automations/[automationId]/analytics/page.tsx` (+ `analytics-client.tsx`) | Analytics (§9.3.5) |
| `src/app/dashboard/automations/[automationId]/config/page.tsx` (+ `config-form.tsx`) | Config (§9.3.6) |
| `src/app/dashboard/automations/[automationId]/channels/page.tsx` (+ `channels-client.tsx`) | Channels (§9.3.7) |
| `src/app/dashboard/team/page.tsx` (+ `team-client.tsx`) | Team (§9.3.8) |
| `src/app/dashboard/billing/page.tsx` | Billing (§9.3.9) |
| `src/app/dashboard/support/page.tsx` (+ `support-client.tsx`) | Support (§9.3.10) |
| `src/components/dashboard/charts/{funnel-chart,heatmap,horizontal-bar-chart}.tsx` | analytics-specific charts |
| `tests/dashboard-7b-*.test.ts` | migration, analytics, config-zod, query-shape, API-guard, structure/brand tests |

---

### Task 1: Migration — `automation_config` + `support_tickets`

**Files:** Create `supabase/migrations/0015_dashboard_config_support.sql`; Test `tests/dashboard-7b-migration.test.ts`.

- [ ] **Step 1: Write the failing test**

`tests/dashboard-7b-migration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0015_dashboard_config_support.sql"), "utf8");

describe("0015 migration", () => {
  it("creates automation_config (one row per automation) with tenant_id + automation_id", () => {
    expect(sql).toMatch(/create table public\.automation_config/i);
    expect(sql).toMatch(/automation_id\s+uuid\s+not null/i);
    expect(sql).toMatch(/tenant_id\s+uuid\s+not null/i);
    expect(sql).toMatch(/unique\s*\(automation_id\)|automation_id\s+uuid\s+not null\s+unique/i);
  });
  it("creates support_tickets with status + category checks", () => {
    expect(sql).toMatch(/create table public\.support_tickets/i);
    expect(sql).toMatch(/category .*check .*build_request/i);
    expect(sql).toMatch(/status .*check .*open/i);
  });
  it("enables RLS on both tables", () => {
    expect(sql).toMatch(/alter table public\.automation_config enable row level security/i);
    expect(sql).toMatch(/alter table public\.support_tickets enable row level security/i);
  });
  it("has tenant-isolation policies referencing tenant_users", () => {
    expect(sql).toMatch(/tenant_users/i);
  });
});
```

Run; confirm FAIL (file missing).

- [ ] **Step 2: Write the migration**

`supabase/migrations/0015_dashboard_config_support.sql`:

```sql
-- Epic 7b — bot configuration + support tickets.

-- Bot configuration: one row per automation (editable by Owner/Admin in the
-- dashboard; the engine reads it on its next run). JSON columns hold the
-- per-channel/array shaped settings from PRD §9.3.6.
create table public.automation_config (
  automation_id     uuid not null unique references public.automations(id) on delete cascade,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  welcome_messages  jsonb not null default '{}'::jsonb,   -- { channelType: copy }
  vehicle_types     jsonb not null default '[]'::jsonb,   -- ["Saloon","Estate",...]
  service_area      text,
  opening_hours     jsonb not null default '{}'::jsonb,   -- { mon: [["09:00","17:00"]], ... }
  brand_colours     jsonb not null default '{}'::jsonb,   -- { primary, secondary }
  languages         jsonb not null default '["en"]'::jsonb,
  ask_driver_note   boolean not null default false,
  updated_by        uuid references public.users(id) on delete set null,
  updated_at        timestamptz not null default now(),
  primary key (automation_id)
);
create index automation_config_tenant_idx on public.automation_config (tenant_id);

-- Support tickets (tenant-facing). "Request a new automation" uses category
-- build_request and is mirrored to the internal build queue out-of-band.
create table public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  created_by    uuid references public.users(id) on delete set null,
  subject       text not null,
  category      text not null check (category in ('technical','billing','build_request','other')),
  description   text not null,
  status        text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index support_tickets_tenant_idx on public.support_tickets (tenant_id);

alter table public.automation_config enable row level security;
alter table public.support_tickets   enable row level security;

-- Tenant isolation: a member of the tenant may read/write its config + tickets.
-- (Mirrors the tenant_isolation pattern from migration 0005.)
create policy automation_config_tenant on public.automation_config
  for all using (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()));

create policy support_tickets_tenant on public.support_tickets
  for all using (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()))
  with check (tenant_id in (select tenant_id from public.tenant_users where user_id = auth.uid()));
```

> Role enforcement (Owner/Admin for config writes) is done in the API layer via `requireOrgAccess(minRole:"Admin")`; the RLS policy enforces tenant isolation. This matches how 7a handles booking PATCH.

- [ ] **Step 3: Run test; then apply locally if `supabase` CLI present** (`supabase migration up` or `supabase db reset`); else skip live apply and note CI covers it (same convention as Epic 6 Task 8).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0015_dashboard_config_support.sql tests/dashboard-7b-migration.test.ts
git commit -m "feat(dashboard): migration for automation_config + support_tickets (RLS)"
```

---

### Task 2: Analytics aggregation layer

**Files:** Create `src/lib/dashboard/analytics-types.ts`, `src/lib/dashboard/analytics.ts`; Test `tests/dashboard-7b-analytics.test.ts`.

Analytics functions take `{ automationId, from?, to? }` and the injectable SSR client (same testing pattern as 7a `queries.ts`). They compute aggregates in TypeScript from rows the RLS client returns (Supabase has no rich GROUP BY via PostgREST without RPC; for v1 we fetch the filtered rows and reduce in memory — tenants are small). Tests pass a fake client returning canned rows and assert the reduction.

- [ ] **Step 1: Write the failing test**

`tests/dashboard-7b-analytics.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reduceFunnel, reduceChannelMix, reduceModeSplit, reduceVehicleSplit, reduceTopZones, reduceHeatmap, reduceAbandonment } from "@/lib/dashboard/analytics";

describe("reduceFunnel", () => {
  it("counts conversations through outcome stages", () => {
    const convs = [{ outcome: "booked" }, { outcome: "quoted" }, { outcome: "abandoned" }, { outcome: "booked" }];
    const f = reduceFunnel(convs as never, 2); // 2 bookings
    expect(f.inbound).toBe(4);
    expect(f.booked).toBe(2);
    // quoted stage counts quoted+booked (reached quote)
    expect(f.quoted).toBeGreaterThanOrEqual(2);
  });
});

describe("reduceChannelMix", () => {
  it("counts conversations per channel id/handle", () => {
    const rows = reduceChannelMix([{ channel_id: "c1" }, { channel_id: "c1" }, { channel_id: "c2" }] as never);
    const c1 = rows.find((r) => r.name === "c1");
    expect(c1?.value).toBe(2);
  });
});

describe("reduceModeSplit / reduceVehicleSplit", () => {
  it("buckets bookings by mode and vehicle", () => {
    const bookings = [{ pickup_time_mode: "asap", vehicle_type: "Saloon" }, { pickup_time_mode: "airport", vehicle_type: "MPV" }, { pickup_time_mode: "asap", vehicle_type: "Saloon" }];
    expect(reduceModeSplit(bookings as never).find((r) => r.name === "asap")?.value).toBe(2);
    expect(reduceVehicleSplit(bookings as never).find((r) => r.name === "Saloon")?.value).toBe(2);
  });
});

describe("reduceTopZones", () => {
  it("ranks pickup zones by count with percentage", () => {
    const bookings = [
      { pickup_address: { zone: "LHR T123" } }, { pickup_address: { zone: "LHR T123" } }, { pickup_address: { zone: "SW1" } },
    ];
    const zones = reduceTopZones(bookings as never, "pickup_address");
    expect(zones[0]).toMatchObject({ zone: "LHR T123", count: 2 });
    expect(zones[0].pct).toBe(67); // 2/3 rounded
  });
});

describe("reduceHeatmap", () => {
  it("produces a 7x24 grid keyed by weekday/hour", () => {
    const cells = reduceHeatmap([{ created_at: "2026-06-01T14:00:00.000Z" }] as never); // Monday 14:00 UTC
    const cell = cells.find((c) => c.day === 1 && c.hour === 14);
    expect(cell?.value).toBe(1);
    expect(cells.length).toBe(7 * 24);
  });
});

describe("reduceAbandonment", () => {
  it("counts abandonment reasons", () => {
    const rows = reduceAbandonment([{ abandonment_reason: "no_pickup" }, { abandonment_reason: "no_pickup" }, { abandonment_reason: null }] as never);
    expect(rows.find((r) => r.reason === "no_pickup")?.count).toBe(2);
  });
});
```

Run; confirm FAIL.

- [ ] **Step 2: Write `analytics-types.ts`**

```typescript
export interface Funnel { inbound: number; greeted: number; intent: number; quoted: number; confirmed: number; booked: number; }
export interface NamedValue { name: string; value: number; }
export interface ZoneRow { zone: string; count: number; pct: number; }
export interface HeatmapCell { day: number; hour: number; value: number; } // day 0=Sun..6=Sat
export interface AbandonmentRow { reason: string; count: number; }
export interface AnalyticsRange { from?: string; to?: string; }
```

- [ ] **Step 3: Write `analytics.ts`** — `server-only`, RLS client. Exports the pure `reduce*` functions (tested above) PLUS async `getAnalytics(metric, args, client?)` that fetches the needed rows and applies the matching reducer. Full reducer implementations:

```typescript
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Funnel, NamedValue, ZoneRow, HeatmapCell, AbandonmentRow, AnalyticsRange } from "./analytics-types";

export type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

export function reduceFunnel(convs: { outcome: string | null }[], bookingCount: number): Funnel {
  const inbound = convs.length;
  const reachedQuote = convs.filter((c) => c.outcome === "quoted" || c.outcome === "booked").length;
  const booked = convs.filter((c) => c.outcome === "booked").length;
  // greeted/intent are upstream of quote; without per-turn data we approximate
  // them as "all inbound were greeted, all non-unknown reached intent".
  const intent = convs.filter((c) => c.outcome && c.outcome !== "unknown").length;
  return { inbound, greeted: inbound, intent, quoted: reachedQuote, confirmed: booked, booked: Math.max(booked, bookingCount === 0 ? booked : bookingCount === booked ? booked : booked) };
}

function countBy<T>(rows: T[], key: (r: T) => string | null | undefined): NamedValue[] {
  const m = new Map<string, number>();
  for (const r of rows) { const k = key(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export const reduceChannelMix = (rows: { channel_id: string | null }[]) => countBy(rows, (r) => r.channel_id);
export const reduceModeSplit = (rows: { pickup_time_mode: string | null }[]) => countBy(rows, (r) => r.pickup_time_mode);
export const reduceVehicleSplit = (rows: { vehicle_type: string | null }[]) => countBy(rows, (r) => r.vehicle_type);

export function reduceTopZones(rows: { pickup_address?: unknown; destination_address?: unknown }[], field: "pickup_address" | "destination_address"): ZoneRow[] {
  const m = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    const addr = r[field] as { zone?: string; town?: string } | null;
    const zone = addr?.zone ?? addr?.town;
    if (zone) { m.set(zone, (m.get(zone) ?? 0) + 1); total++; }
  }
  return [...m.entries()]
    .map(([zone, count]) => ({ zone, count, pct: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function reduceHeatmap(rows: { created_at: string }[]): HeatmapCell[] {
  const grid: HeatmapCell[] = [];
  const idx = new Map<string, number>();
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) { idx.set(`${d}:${h}`, grid.length); grid.push({ day: d, hour: h, value: 0 }); }
  for (const r of rows) {
    const dt = new Date(r.created_at);
    if (Number.isNaN(dt.getTime())) continue;
    const cell = grid[idx.get(`${dt.getUTCDay()}:${dt.getUTCHours()}`)!];
    cell.value++;
  }
  return grid;
}

export function reduceAbandonment(rows: { abandonment_reason: string | null }[]): AbandonmentRow[] {
  const m = new Map<string, number>();
  for (const r of rows) { if (r.abandonment_reason) m.set(r.abandonment_reason, (m.get(r.abandonment_reason) ?? 0) + 1); }
  return [...m.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
}

function range<T extends string>(q: { gte: (c: string, v: string) => unknown; lte: (c: string, v: string) => unknown }, col: T, r: AnalyticsRange) {
  if (r.from) q.gte(col, r.from);
  if (r.to) q.lte(col, r.to);
  return q;
}

export async function getFunnel(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<Funnel> {
  const supabase = client ?? (await createClient());
  let cq = supabase.from("conversations").select("outcome").eq("automation_id", automationId);
  if (r.from) cq = cq.gte("started_at", r.from);
  if (r.to) cq = cq.lte("started_at", r.to);
  const { data: convs } = await cq;
  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("automation_id", automationId);
  return reduceFunnel((convs ?? []) as { outcome: string | null }[], count ?? 0);
}

export async function getChannelMix(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<NamedValue[]> {
  const supabase = client ?? (await createClient());
  let q = supabase.from("conversations").select("channel_id").eq("automation_id", automationId);
  if (r.from) q = q.gte("started_at", r.from);
  if (r.to) q = q.lte("started_at", r.to);
  const { data } = await q;
  return reduceChannelMix((data ?? []) as { channel_id: string | null }[]);
}

async function bookingsForAnalytics(automationId: string, r: AnalyticsRange, cols: string, supabase: SupabaseLike) {
  let q = supabase.from("bookings").select(cols).eq("automation_id", automationId);
  if (r.from) q = q.gte("created_at", r.from);
  if (r.to) q = q.lte("created_at", r.to);
  const { data } = await q;
  return data ?? [];
}

export async function getModeSplit(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<NamedValue[]> {
  const supabase = client ?? (await createClient());
  return reduceModeSplit((await bookingsForAnalytics(automationId, r, "pickup_time_mode", supabase)) as never);
}
export async function getVehicleSplit(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<NamedValue[]> {
  const supabase = client ?? (await createClient());
  return reduceVehicleSplit((await bookingsForAnalytics(automationId, r, "vehicle_type", supabase)) as never);
}
export async function getTopZones(automationId: string, r: AnalyticsRange, field: "pickup_address" | "destination_address", client?: SupabaseLike): Promise<ZoneRow[]> {
  const supabase = client ?? (await createClient());
  return reduceTopZones((await bookingsForAnalytics(automationId, r, field, supabase)) as never, field);
}
export async function getHeatmap(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<HeatmapCell[]> {
  const supabase = client ?? (await createClient());
  return reduceHeatmap((await bookingsForAnalytics(automationId, r, "created_at", supabase)) as never);
}
export async function getAbandonment(automationId: string, r: AnalyticsRange, client?: SupabaseLike): Promise<AbandonmentRow[]> {
  const supabase = client ?? (await createClient());
  let q = supabase.from("conversations").select("abandonment_reason").eq("automation_id", automationId);
  if (r.from) q = q.gte("started_at", r.from);
  if (r.to) q = q.lte("started_at", r.to);
  const { data } = await q;
  return reduceAbandonment((data ?? []) as { abandonment_reason: string | null }[]);
}
```

> The `reduceFunnel` `booked` expression is over-defensive; simplify to `booked` if the implementer prefers — the test only checks `inbound`, `booked`, and `quoted >= 2`. Keep `greeted/intent` as documented approximations until Epic 10 adds per-turn data.

- [ ] **Step 4: Run test + typecheck.** Commit:

```bash
git add src/lib/dashboard/analytics-types.ts src/lib/dashboard/analytics.ts tests/dashboard-7b-analytics.test.ts
git commit -m "feat(dashboard): analytics aggregation layer (funnel/mix/zones/heatmap/abandonment)"
```

---

### Task 3: Config + Channels + Billing + Support + Team query/type modules

**Files:** Create `config-types.ts`, `config-queries.ts`, `channels-queries.ts`, `team-queries.ts`, `billing-queries.ts`, `support-queries.ts` under `src/lib/dashboard/`; Test `tests/dashboard-7b-queries.test.ts`.

- [ ] **Step 1: Write the failing test** — assert each query builds against the right table and the config zod schema validates/rejects. Sketch:

```typescript
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AutomationConfigSchema } from "@/lib/dashboard/config-types";
import { getAutomationConfig } from "@/lib/dashboard/config-queries";
import { getChannels } from "@/lib/dashboard/channels-queries";
import { listTickets } from "@/lib/dashboard/support-queries";

function fake(data: unknown) {
  const b: Record<string, unknown> = {}; const calls: { m: string; a: unknown[] }[] = [];
  for (const m of ["select","eq","order","limit","maybeSingle","gte","lte"]) b[m] = (...a: unknown[]) => { calls.push({ m, a }); return m === "maybeSingle" ? Promise.resolve({ data, error: null }) : b; };
  (b as { then: unknown }).then = (res: (v: unknown)=>void) => res({ data, error: null });
  return { client: { from: (t: string) => { calls.push({ m: "from", a: [t] }); return b; } }, calls };
}

describe("AutomationConfigSchema", () => {
  it("accepts a valid partial config", () => {
    expect(AutomationConfigSchema.safeParse({ service_area: "Slough", ask_driver_note: true }).success).toBe(true);
  });
  it("rejects a non-array vehicle_types", () => {
    expect(AutomationConfigSchema.safeParse({ vehicle_types: "Saloon" }).success).toBe(false);
  });
});

describe("getChannels / listTickets / getAutomationConfig", () => {
  it("query the right tables", async () => {
    const c1 = fake([]); await getChannels("a1", c1.client as never);
    expect(c1.calls.find((c)=>c.m==="from")?.a[0]).toBe("channels");
    const c2 = fake([]); await listTickets("t1", c2.client as never);
    expect(c2.calls.find((c)=>c.m==="from")?.a[0]).toBe("support_tickets");
    const c3 = fake(null); await getAutomationConfig("a1", c3.client as never);
    expect(c3.calls.find((c)=>c.m==="from")?.a[0]).toBe("automation_config");
  });
});
```

- [ ] **Step 2: Implement the modules.** Full contracts:

`config-types.ts`:
```typescript
import { z } from "zod";
export const AutomationConfigSchema = z.object({
  welcome_messages: z.record(z.string()).optional(),
  vehicle_types: z.array(z.string()).optional(),
  service_area: z.string().max(2000).nullable().optional(),
  opening_hours: z.record(z.array(z.tuple([z.string(), z.string()]))).optional(),
  brand_colours: z.object({ primary: z.string().optional(), secondary: z.string().optional() }).partial().optional(),
  languages: z.array(z.string()).optional(),
  ask_driver_note: z.boolean().optional(),
});
export type AutomationConfigInput = z.infer<typeof AutomationConfigSchema>;
export interface AutomationConfig extends AutomationConfigInput { automationId: string; updatedAt: string | null; }
```

`config-queries.ts` — `getAutomationConfig(automationId, client?)` (select from `automation_config`, return defaults when no row) and `upsertAutomationConfig(automationId, tenantId, patch, userId, client?)` (`upsert` keyed on `automation_id`, set `updated_by`/`updated_at`).

`channels-queries.ts` — `getChannels(automationId, client?)`: select `id, type, external_id, status, token_expires_at, last_message_at` from `channels` eq `automation_id`, map to a DTO including `health` (reuse 7a `channelHealth`) and `tokenExpiresInDays`.

`team-queries.ts` — `listMembers(tenantId, client?)`: select from `tenant_users` joined to `users` (`role, automation_restrictions, users(email, full_name, last_login_at)`). `listAudit(tenantId, limit=50, client?)`: select from `audit_log` (RLS: tenant users have NO select on audit_log per 0005/0011 — so this must use the **service-role** path OR be Owner-gated server-side; SIMPLEST for 7b: the audit list is Owner-only and read via a server action using the service-role client, mirroring team invite. Implement `listAudit` to accept a client and let the API/route provide a service-role client for this ONE read; document the exception clearly.)

`billing-queries.ts` — `getBillingOverview(tenantId, client?)`: read `tenants` (plan_band, currency, monthly_price, contract_start, contract_renewal, setup_fee_paid), `subscriptions` (latest), `setup_fees`. Return a combined DTO.

`support-queries.ts` — `listTickets(tenantId, client?)` and `createTicket({tenantId, automationId, createdBy, subject, category, description}, client?)`.

- [ ] **Step 3: Run test + typecheck. Commit:**

```bash
git add src/lib/dashboard/config-types.ts src/lib/dashboard/config-queries.ts src/lib/dashboard/channels-queries.ts src/lib/dashboard/team-queries.ts src/lib/dashboard/billing-queries.ts src/lib/dashboard/support-queries.ts tests/dashboard-7b-queries.test.ts
git commit -m "feat(dashboard): config/channels/team/billing/support query layer + config zod schema"
```

> **Audit-log RLS note:** `audit_log` has no tenant SELECT (0005/0011). The Team page's audit trail (last 50) must be read with a service-role client inside the Owner-gated team server action / a server-only helper — never via the tenant RLS client (it would return empty). Flag this explicitly in code comments.

---

### Task 4: API routes — analytics, config, channels, billing, support, team, audit

**Files:** the route handlers listed in the file table; Test `tests/dashboard-7b-api.test.ts` (guard + role + validation, mocking the query modules — same style as 7a `dashboard-api-guard.test.ts`).

- [ ] **Step 1: Write failing guard/role tests** covering: analytics GET requires Viewer + automationId; config PATCH requires Admin + validates body via zod (400 on invalid); channels test POST requires Admin; team invite/PATCH/DELETE require Owner; billing portal returns 503; support POST requires Viewer + validates category. Mock the query/action modules and `requireOrgAccess`.

- [ ] **Step 2: Implement routes.** Each mirrors the 7a pattern: `await ctx.params` (typed `Promise<Record<string,string>>`), `requireOrgAccess(orgId, { minRole, automationId? })`, short-circuit on `NextResponse`, then call the query, return JSON. Specifics:
  - Analytics `[metric]/route.ts`: validate `metric ∈ {funnel,channels,mode,vehicle,zones,destinations,heatmap,abandonment,response-time,voice}`; parse `from`/`to` from query; switch to the matching `analytics.ts` function; for `response-time`/`voice` return `{ available: false }` (honest empty). `minRole: "Viewer"`, pass `automationId`.
  - Config GET (`Viewer`) / PATCH (`Admin`): PATCH parses body via `AutomationConfigSchema.safeParse` → 400 on failure → `upsertAutomationConfig`.
  - Channels GET (`Viewer`); `channels/[channelId]/test` POST (`Admin`) → record + return `{ ok: true, queued: true }`.
  - Team GET (`Viewer`) → `listMembers`. `team/[userId]` PATCH/DELETE (`Owner`) → call the team server action helpers. `audit` GET (`Owner`) → `listAudit` (service-role read).
  - Billing `subscription` GET (`Viewer`); `portal` POST (`Admin`) → `new NextResponse(JSON.stringify({ error: "Billing portal is being set up." }), { status: 503, headers: { "content-type": "application/json" }})`.
  - Support GET (`Viewer`) → `listTickets`; POST (`Viewer`) → validate `{ subject, category, description, automationId? }`, `createTicket`.

- [ ] **Step 3: Run tests + typecheck + lint. Commit per logical group** (analytics; config+channels; team+audit; billing+support) or one commit:

```bash
git add "src/app/api/orgs/[orgId]/" tests/dashboard-7b-api.test.ts
git commit -m "feat(dashboard): analytics/config/channels/team/billing/support read+write APIs"
```

---

### Task 5: Team server actions (service-role invite — Owner only)

**Files:** Create `src/app/dashboard/team/actions.ts`; Test `tests/dashboard-7b-team-actions.test.ts`.

- [ ] **Step 1: Write failing tests** — mock `requireOrgAccess`/service-role client; assert: `inviteMember` rejects when caller isn't Owner; on success calls `auth.admin.inviteUserByEmail` then inserts a `tenant_users` row with the chosen role + restrictions; never logs the email's token. `changeRole`/`revokeMember` Owner-gated.

- [ ] **Step 2: Implement** mirroring `src/app/admin/credentials/actions.ts` (service-role client via `createSupabaseJS(url, SERVICE_ROLE_KEY)`), `"use server"`, each action: `const gate = await requireOrgAccess(orgId, { minRole: "Owner" })` (throw/return error if not allowed), zod-validate input, perform the admin operation, `writeAudit(...)`, `revalidatePath("/dashboard/team")`. Validate email + role enum + optional `automationRestrictions: string[]`.

- [ ] **Step 3: Run tests + typecheck + lint. Commit:**

```bash
git add src/app/dashboard/team/actions.ts tests/dashboard-7b-team-actions.test.ts
git commit -m "feat(dashboard): Owner-gated team invite/role/revoke server actions"
```

---

### Task 6: Analytics-specific chart components

**Use `ui-ux-pro-max`.** Files: `src/components/dashboard/charts/{funnel-chart,heatmap,horizontal-bar-chart}.tsx` (all `"use client"`). Append paths to a `tests/dashboard-7b-structure.test.ts` existence list.

- [ ] Build:
  - `FunnelChart({ data }: { data: { stage: string; count: number; pct: number }[] })` — stacked horizontal bars or a recharts `FunnelChart`; show count + drop-off %.
  - `Heatmap({ cells }: { cells: HeatmapCell[] })` — 7×24 CSS grid, cell background opacity scaled to value, accessible `<table>` fallback with `aria-label`s; legend.
  - `HorizontalBarChart({ data }: { data: NamedValue[] })` — recharts horizontal bar.
  - Each has an empty state. Commit.

---

### Task 7: Analytics page

**Use `ui-ux-pro-max`.** Files: `analytics/page.tsx` (Server Component) + `analytics-client.tsx` (`"use client"`, holds the date-range + period toggle, fetches each metric from the analytics API, renders the 10 sections). Append page path to structure test.

- [ ] Server page: `requireUser()`, automation-restriction guard (the `[automationId]/layout.tsx` already guards), pass `orgId`/`automationId` + the automation `type` (to conditionally show booking-only sections) to the client. Client fetches metrics in parallel and renders:
  1. Conversion funnel (`FunnelChart`), 2. Channel mix (`DonutChart`), 3. Mode split — booking-type only (`BarChart`), 4. Vehicle breakdown — booking-type only (`HorizontalBarChart`), 5. Top pickup zones (table), 6. Top destinations (table), 7. Peak-hours heatmap (`Heatmap`), 8. Response-time distribution → "Available once timing capture is enabled" empty card, 9. Abandonment reasons (`HorizontalBarChart`/table), 10. Voice-note stats → "Available once voice capture is enabled" empty card. Date-range picker + period-over-period toggle drive the query params. Commit.

---

### Task 8: Config page

**Use `ui-ux-pro-max`.** Files: `config/page.tsx` (Server: load config + automation, gate) + `config-form.tsx` (`"use client"`: form for welcome messages per channel, vehicle-type toggles, service area, opening hours editor, brand colours, languages, driver-note toggle; submits PATCH to the config API; read-only for Viewers with an explanatory note; "Request a structural change" → support ticket link). Honest note: "Changes apply on the automation's next run." Commit.

---

### Task 9: Channels page

**Use `ui-ux-pro-max`.** Files: `channels/page.tsx` (Server: `getChannels`) + `channels-client.tsx` (cards per channel: icon+type+external id, `StatusBadge`, token-expiry warning amber@7d/red@1d, last message + 24h count if available, "Send test message" → POST test (Admin), "Reconnect"/"Add channel" → support ticket). Commit.

---

### Task 10: Team page

**Use `ui-ux-pro-max`.** Files: `team/page.tsx` (Server: `listMembers`, and audit via the Owner-gated path) + `team-client.tsx` (members table; invite-by-email form (Owner) calling the `inviteMember` action; role change/revoke (Owner); Viewer automation-restriction multi-select; audit trail last 50). Commit.

---

### Task 11: Billing + Support pages

**Use `ui-ux-pro-max`.**
- `billing/page.tsx` (Server: `getBillingOverview`): plan card (band, currency, monthly price, contract start/renewal), setup-fee status ("Paid — £X on DD/MM/YYYY" or "Pending"), invoices table (setup fee row + "monthly invoices arrive with billing go-live" empty state), "Update Payment Method" button → POSTs portal route, shows the 503 "being set up" message gracefully, "Request plan change" → support ticket.
- `support/page.tsx` (Server: `listTickets`) + `support-client.tsx`: open-tickets table (id/subject/created/status), new-ticket form (subject, category, description) → POST support API, "Request a new automation" button pre-filling category `build_request`, KB external link. Commit both.

---

### Task 12: Brand/RLS/service-role guards + final gate

**Files:** `tests/dashboard-7b-structure.test.ts` (extend with: all 7b page/route files exist; brand scan over the new surfaces; service-role scan that ONLY `src/app/dashboard/team/actions.ts` and the team-queries audit helper may reference SERVICE_ROLE — assert no OTHER dashboard file does; 0015 migration RLS presence).

- [ ] **Step 1** Write the guard tests. The service-role scan: allow `team/actions.ts` (and document the audit exception), forbid SERVICE_ROLE anywhere else under `src/app/dashboard` / `src/components/dashboard` / `src/lib/dashboard` EXCEPT the explicitly allowlisted team files. If any other file matches, STOP and report.
- [ ] **Step 2** Full gate: `pnpm vitest run && pnpm typecheck && pnpm lint && pnpm build`. Report totals. All green.
- [ ] **Step 3** Commit.

```bash
git add tests/dashboard-7b-structure.test.ts
git commit -m "test(dashboard): 7b brand/RLS/service-role guards + final gate"
```

---

## Self-review against the spec

**Coverage (PRD §9.3.5–9.3.10, §12.5–12.9):** Analytics 10 sections (Tasks 2,6,7 — with honest empty states for response-time/voice pending Epic 10), Config (Tasks 1,3,4,8), Channels (Tasks 3,4,9), Team (Tasks 3,4,5,10), Billing (Tasks 3,4,11 — portal/invoices stubbed for Epic 8), Support (Tasks 1,3,4,11). APIs §12.5–12.9 — Task 4. New tables + RLS — Task 1.

**Security:** tenant reads via RLS client; `requireOrgAccess` on every route with correct `minRole` (Owner for team, Admin for config/channel-test/portal, Viewer for reads) + `automationId` on automation-scoped routes. Service-role limited to the Owner-gated team actions + the documented audit-log read; Task-12 guard enforces this.

**Honesty:** no fabricated analytics; billing portal/invoices and voice/response-time clearly marked pending their owning epics.

**Type consistency:** analytics DTOs in `analytics-types.ts`, config DTO+zod in `config-types.ts`, reused across queries/APIs/pages. `requireOrgAccess` signature matches Epic 5. Reuses 7a components (`DataTable`, `StatusBadge`, `ChannelIcon`, `SlideOver`, `FilterBar`, chart components) unchanged.

---

## Execution handoff

Built on top of Epic 7a. Sequence: Task 1 (migration) → 2 (analytics lib) + 3 (query modules) → 4 (APIs) + 5 (team actions) → 6 (charts) → 7–11 (pages) → 12 (gate). Tasks 2/3 are parallelizable after Task 1; pages 7–11 are largely independent of each other (different files) and parallelizable in worktrees, but share the branch/git index so run sequentially unless isolated. Build with subagent-driven-development; review the security-sensitive tasks (1 RLS, 4 guards, 5 service-role invite) most carefully.
