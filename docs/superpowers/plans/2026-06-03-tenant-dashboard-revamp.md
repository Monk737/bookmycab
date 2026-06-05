# Tenant Dashboard Production Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the tenant dashboard from "functional but sparse" to production quality — real time-series trends, revenue, response-time and completion metrics surfaced on the overview pages, the Analytics page completed (response-time + revenue), and polished states — all driven by the real booking/conversation/message data the bot produces.

**Architecture:** A new pure, tested **insights** data layer (`src/lib/dashboard/insights.ts`) computes daily trends, first-response times (from message timestamps), and revenue/completion (from booking fares + status). The three landing surfaces — org overview, per-automation overview, and the Analytics page — consume it. Reducers are pure and unit-tested (mirroring the existing `analytics.ts` pattern); async getters take an injectable Supabase client. The Epic 11 `percentile` helper is reused for response-time percentiles.

**Tech Stack:** Next.js 15 App Router (server components + recharts client charts), TypeScript, Supabase (RLS-scoped reads), Vitest. Existing chart components (`TrendChart`, `DonutChart`, `BarChart`, `HorizontalBarChart`, `FunnelChart`, `Heatmap`) and `KpiStrip` are reused.

---

## Context the implementer needs

- **Demo data is already rolling to today** (`scripts/seed-demo.ts` was fixed separately): bookings/conversations now run up to the current day, so "today" KPIs and trends populate. Do not re-touch the seed.
- **Data model:** `bookings(created_at, fare numeric, currency, status in confirmed|dispatched|completed|cancelled|no_show, pickup_time_mode, vehicle_type, airport_json, automation_id, tenant_id)`; `conversations(started_at, outcome, language, channel_id, automation_id)`; `messages(conversation_id, direction in inbound|outbound, message_type, ts)`. Messages have **no** `automation_id` — reach them via `conversation_id` (two-query pattern, exactly like `getVoiceStats`).
- **RLS:** the tenant Viewer can read all of its tenant's rows (verified). Server components use `createClient()` (user JWT); pass no client and the getter resolves it.
- **Existing analytics pattern to mirror:** `src/lib/dashboard/analytics.ts` — pure `reduceX` + async `getX(automationId, range, client?)` with `SupabaseLike = Awaited<ReturnType<typeof createClient>>`, date filters `gte/lte` on the time column. `tests/dashboard-7b-analytics.test.ts` shows the reducer test style.
- **`TrendChart`** (already built) takes `data: { label: string; current: number; previous: number }[]`.
- **Analytics wiring:** `src/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route.ts` has a `METRICS` map and `STUB_METRICS = new Set(["response-time"])`; `analytics-client.tsx` renders sections and already wired the `voice` metric — `response-time` (section 8) is still an `UnavailableCard`.
- **Reuse:** `percentile(values, p)` from `src/lib/observability/percentile.ts`.

---

## File Structure

**Workstream 1 — Insights data layer (foundational; build first):**
- Create `src/lib/dashboard/insights-types.ts` — `TrendPoint`, `ResponseStats`, `RevenueSummary`.
- Create `src/lib/dashboard/insights.ts` — `reduceDailyTrend`, `reduceResponseStats`, `reduceRevenue` (pure) + `getBookingsTrend`, `getResponseStats`, `getRevenueSummary` (async).
- Test `tests/dashboard-insights.test.ts`.

**Workstream 2 — Per-automation overview revamp (consumes WS1):**
- Modify `src/app/dashboard/automations/[automationId]/page.tsx`.
- Create `src/app/dashboard/automations/[automationId]/overview-trend.tsx` (client wrapper around `TrendChart`).

**Workstream 3 — Analytics page completion (consumes WS1):**
- Modify `src/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route.ts`.
- Modify `src/app/dashboard/automations/[automationId]/analytics/analytics-client.tsx`.
- Modify `tests/dashboard-7b-api.test.ts`.

**Workstream 4 — Org overview revamp (consumes WS1):**
- Modify `src/lib/dashboard/queries.ts` (add `getOrgKpis`; do not change existing exports' shapes).
- Modify `src/app/dashboard/page.tsx`.
- Test `tests/dashboard-org-kpis.test.ts`.

Workstreams 2, 3, 4 touch disjoint files and build in parallel after WS1 lands.

---

# WORKSTREAM 1 — Insights Data Layer

## Task 1.1: insight types

**Files:**
- Create: `src/lib/dashboard/insights-types.ts`

- [ ] **Step 1: Create the types**

```ts
export interface TrendPoint {
  /** Short axis label, e.g. "3 Jun". */
  label: string;
  /** Count in the current period for this bucket. */
  current: number;
  /** Count in the preceding period of equal length, aligned by offset. */
  previous: number;
}

export interface ResponseStats {
  /** Number of conversations that had a measurable first response. */
  sampleSize: number;
  avgSeconds: number;
  p50Seconds: number;
  p95Seconds: number;
}

export interface RevenueSummary {
  /** Sum of fares across all bookings in range (any status). */
  totalFare: number;
  avgFare: number;
  completedCount: number;
  bookingCount: number;
  /** completed / bookingCount, 0–100. */
  completionPct: number;
  /** Booking count by status, descending, for a chart. */
  byStatus: { name: string; value: number }[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dashboard/insights-types.ts
git commit -m "feat(dashboard): insight types (trend, response, revenue)"
```

---

## Task 1.2: pure reducers + async getters

**Files:**
- Create: `src/lib/dashboard/insights.ts`
- Test: `tests/dashboard-insights.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard-insights.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reduceDailyTrend, reduceResponseStats, reduceRevenue } from "@/lib/dashboard/insights";

describe("reduceDailyTrend", () => {
  it("buckets current + previous counts across the day axis", () => {
    const pts = reduceDailyTrend(
      [{ created_at: "2026-06-02T10:00:00Z" }, { created_at: "2026-06-02T12:00:00Z" }, { created_at: "2026-06-03T09:00:00Z" }],
      [{ created_at: "2026-05-31T10:00:00Z" }], // previous window is the 2 days before `from`
      "2026-06-02", "2026-06-03",
    );
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ current: 2 }); // 2 Jun
    expect(pts[1]).toMatchObject({ current: 1 }); // 3 Jun
    // previous-period day 0 (31 May) aligns to bucket 0
    expect(pts[0].previous).toBe(1);
    expect(pts[1].previous).toBe(0);
  });
  it("returns a zero-filled axis when there is no data", () => {
    const pts = reduceDailyTrend([], [], "2026-06-01", "2026-06-03");
    expect(pts).toHaveLength(3);
    expect(pts.every((p) => p.current === 0 && p.previous === 0)).toBe(true);
  });
});

describe("reduceResponseStats", () => {
  it("measures seconds from each conversation's first inbound to the next outbound", () => {
    const msgs = [
      { conversation_id: "c1", direction: "inbound", ts: "2026-06-03T10:00:00Z" },
      { conversation_id: "c1", direction: "outbound", ts: "2026-06-03T10:00:30Z" }, // 30s
      { conversation_id: "c2", direction: "inbound", ts: "2026-06-03T11:00:00Z" },
      { conversation_id: "c2", direction: "outbound", ts: "2026-06-03T11:00:10Z" }, // 10s
    ];
    const s = reduceResponseStats(msgs);
    expect(s.sampleSize).toBe(2);
    expect(s.avgSeconds).toBe(20);
    expect(s.p95Seconds).toBe(30);
  });
  it("ignores conversations with no inbound→outbound pair", () => {
    const s = reduceResponseStats([{ conversation_id: "c1", direction: "inbound", ts: "2026-06-03T10:00:00Z" }]);
    expect(s).toEqual({ sampleSize: 0, avgSeconds: 0, p50Seconds: 0, p95Seconds: 0 });
  });
});

describe("reduceRevenue", () => {
  it("totals fares, averages, and computes completion + status split", () => {
    const r = reduceRevenue([
      { fare: 20, status: "completed" }, { fare: 30, status: "completed" },
      { fare: 10, status: "cancelled" }, { fare: null, status: "confirmed" },
    ]);
    expect(r.bookingCount).toBe(4);
    expect(r.totalFare).toBe(60);
    expect(r.avgFare).toBe(20); // 60 / 3 fares present
    expect(r.completedCount).toBe(2);
    expect(r.completionPct).toBe(50);
    expect(r.byStatus[0]).toMatchObject({ name: "completed", value: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-insights.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `insights.ts`**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { percentile } from "@/lib/observability/percentile";
import type { TrendPoint, ResponseStats, RevenueSummary } from "./insights-types";

export type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

const DAY_MS = 86_400_000;
function dayKey(iso: string | Date): string {
  return new Date(iso).toISOString().slice(0, 10);
}
function shortLabel(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Builds a per-day axis from `from`..`to` (inclusive) with current + previous counts. */
export function reduceDailyTrend(
  current: { created_at: string }[],
  previous: { created_at: string }[],
  from: string,
  to: string,
): TrendPoint[] {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  const days = Math.max(0, Math.round((end - start) / DAY_MS)) + 1;

  const axis: { key: string; current: number; previous: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const key = dayKey(new Date(start + i * DAY_MS));
    idx.set(key, i);
    axis.push({ key, current: 0, previous: 0 });
  }
  for (const r of current) {
    const i = idx.get(dayKey(r.created_at));
    if (i !== undefined) axis[i].current++;
  }
  // Previous window is the `days` days immediately before `from`; align by offset.
  const prevStart = start - days * DAY_MS;
  for (const r of previous) {
    const offset = Math.floor((new Date(r.created_at).getTime() - prevStart) / DAY_MS);
    if (offset >= 0 && offset < days) axis[offset].previous++;
  }
  return axis.map((a) => ({ label: shortLabel(a.key), current: a.current, previous: a.previous }));
}

/** First-response seconds per conversation: first inbound → next outbound after it. */
export function reduceResponseStats(
  messages: { conversation_id: string; direction: string; ts: string }[],
): ResponseStats {
  const byConv = new Map<string, { direction: string; ts: number }[]>();
  for (const m of messages) {
    const arr = byConv.get(m.conversation_id) ?? [];
    arr.push({ direction: m.direction, ts: new Date(m.ts).getTime() });
    byConv.set(m.conversation_id, arr);
  }
  const deltas: number[] = [];
  for (const arr of byConv.values()) {
    arr.sort((a, b) => a.ts - b.ts);
    const firstInbound = arr.find((m) => m.direction === "inbound");
    if (!firstInbound) continue;
    const reply = arr.find((m) => m.direction === "outbound" && m.ts >= firstInbound.ts);
    if (!reply) continue;
    deltas.push(Math.round((reply.ts - firstInbound.ts) / 1000));
  }
  if (deltas.length === 0) return { sampleSize: 0, avgSeconds: 0, p50Seconds: 0, p95Seconds: 0 };
  const avg = Math.round(deltas.reduce((s, d) => s + d, 0) / deltas.length);
  return {
    sampleSize: deltas.length,
    avgSeconds: avg,
    p50Seconds: percentile(deltas, 50),
    p95Seconds: percentile(deltas, 95),
  };
}

export function reduceRevenue(bookings: { fare: number | null; status: string }[]): RevenueSummary {
  const bookingCount = bookings.length;
  const fares = bookings.map((b) => (typeof b.fare === "number" ? b.fare : null)).filter((f): f is number => f !== null);
  const totalFare = Math.round(fares.reduce((s, f) => s + f, 0));
  const avgFare = fares.length ? Math.round(totalFare / fares.length) : 0;
  const completedCount = bookings.filter((b) => b.status === "completed").length;
  const completionPct = bookingCount ? Math.round((completedCount / bookingCount) * 100) : 0;
  const statusMap = new Map<string, number>();
  for (const b of bookings) statusMap.set(b.status, (statusMap.get(b.status) ?? 0) + 1);
  const byStatus = [...statusMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  return { totalFare, avgFare, completedCount, bookingCount, completionPct, byStatus };
}

// ——— async getters (mirror analytics.ts) ———————————————————————

interface Range { from?: string; to?: string }

function defaultRange(r: Range): { from: string; to: string } {
  const to = r.to ?? new Date().toISOString().slice(0, 10);
  const from = r.from ?? dayKey(new Date(Date.now() - 29 * DAY_MS));
  return { from, to };
}

export async function getBookingsTrend(automationId: string, r: Range, client?: SupabaseLike): Promise<TrendPoint[]> {
  const supabase = client ?? (await createClient());
  const { from, to } = defaultRange(r);
  const days = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS) + 1;
  const prevFrom = dayKey(new Date(new Date(`${from}T00:00:00Z`).getTime() - days * DAY_MS));
  const toEnd = `${to}T23:59:59.999Z`;
  const fromStart = `${from}T00:00:00Z`;
  const [{ data: cur }, { data: prev }] = await Promise.all([
    supabase.from("bookings").select("created_at").eq("automation_id", automationId).gte("created_at", fromStart).lte("created_at", toEnd),
    supabase.from("bookings").select("created_at").eq("automation_id", automationId).gte("created_at", `${prevFrom}T00:00:00Z`).lt("created_at", fromStart),
  ]);
  return reduceDailyTrend((cur ?? []) as { created_at: string }[], (prev ?? []) as { created_at: string }[], from, to);
}

export async function getRevenueSummary(automationId: string, r: Range, client?: SupabaseLike): Promise<RevenueSummary> {
  const supabase = client ?? (await createClient());
  let q = supabase.from("bookings").select("fare, status").eq("automation_id", automationId);
  if (r.from) q = q.gte("created_at", `${r.from}T00:00:00Z`);
  if (r.to) q = q.lte("created_at", `${r.to}T23:59:59.999Z`);
  const { data } = await q;
  return reduceRevenue((data ?? []) as { fare: number | null; status: string }[]);
}

export async function getResponseStats(automationId: string, r: Range, client?: SupabaseLike): Promise<ResponseStats> {
  const supabase = client ?? (await createClient());
  let cq = supabase.from("conversations").select("id").eq("automation_id", automationId);
  if (r.from) cq = cq.gte("started_at", `${r.from}T00:00:00Z`);
  if (r.to) cq = cq.lte("started_at", `${r.to}T23:59:59.999Z`);
  const { data: convs } = await cq;
  const ids = (convs ?? []).map((c) => (c as { id: string }).id);
  if (ids.length === 0) return reduceResponseStats([]);
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, direction, ts")
    .in("conversation_id", ids);
  return reduceResponseStats((msgs ?? []) as { conversation_id: string; direction: string; ts: string }[]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dashboard-insights.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck` → clean.

```bash
git add src/lib/dashboard/insights.ts tests/dashboard-insights.test.ts
git commit -m "feat(dashboard): insights reducers + getters (trend, response time, revenue)"
```

---

# WORKSTREAM 2 — Per-Automation Overview Revamp

## Task 2.1: real bookings trend chart wrapper

**Files:**
- Create: `src/app/dashboard/automations/[automationId]/overview-trend.tsx`

- [ ] **Step 1: Create the client wrapper**

```tsx
"use client";

import { TrendChart } from "@/components/dashboard/charts/trend-chart";
import type { TrendPoint } from "@/lib/dashboard/insights-types";

/** Thin client wrapper so the server overview page can hand TrendChart its data. */
export function OverviewTrend({ data }: { data: TrendPoint[] }) {
  return <TrendChart data={data} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/dashboard/automations/[automationId]/overview-trend.tsx"
git commit -m "feat(dashboard): overview trend client wrapper"
```

## Task 2.2: wire real trend + revenue/response KPIs into the overview

**Files:**
- Modify: `src/app/dashboard/automations/[automationId]/page.tsx`

- [ ] **Step 1: Add the insights imports**

After the existing `getRecentRuns` import block, add:

```tsx
import { getBookingsTrend, getRevenueSummary, getResponseStats } from "@/lib/dashboard/insights";
import { OverviewTrend } from "./overview-trend";
```

- [ ] **Step 2: Fetch insights (last 30 days) alongside the existing data**

Replace the existing `Promise.all([...])` that loads `cards, recentBookings, recentConversations, recentRuns` with one that also loads the insights:

```tsx
  const [cards, recentBookings, recentConversations, recentRuns, trend, revenue, response] =
    await Promise.all([
      getAutomationCards(claims.tenant_id),
      getBookingsPage({ automationId, filter: { page: 1, limit: 20 } }),
      getConversationsPage({ automationId, filter: { page: 1, limit: 10 } }),
      getRecentRuns(automationId, 10),
      getBookingsTrend(automationId, {}),
      getRevenueSummary(automationId, {}),
      getResponseStats(automationId, {}),
    ]);
```

- [ ] **Step 3: Replace the KPI strip with real revenue/completion/response**

Replace the existing `<KpiStrip items={[...]} />` block with:

```tsx
      <KpiStrip
        items={[
          { label: "Bookings today", value: card.bookingsToday },
          { label: "Revenue (30d)", value: `£${revenue.totalFare.toLocaleString()}` },
          { label: "Completion", value: `${revenue.completionPct}%` },
          {
            label: "Avg response",
            value: response.sampleSize ? `${response.avgSeconds}s` : "—",
            sub: response.sampleSize ? `p95 ${response.p95Seconds}s` : "No data yet",
          },
          { label: "Active channels", value: card.channels.length },
        ]}
      />
```

- [ ] **Step 4: Replace the empty trend chart with the real one**

Replace the `Bookings trend` card block (the one rendering `<TrendChart data={[]} />`) with:

```tsx
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Bookings trend</h3>
            <span className="text-[11px] text-slate-400">last 30 days</span>
          </div>
          <OverviewTrend data={trend} />
        </div>
```

- [ ] **Step 5: Use the full-range status split instead of the last-20 sample**

The `Booking mode`/`Vehicle types` donuts currently aggregate only `recentBookings.rows`. Add a revenue-by-status bar that uses the 30-day `revenue.byStatus`. Replace the `Vehicle types` card block with a Booking status card:

```tsx
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-slate-700">Booking status</h3>
              <p className="mb-3 text-[11px] text-slate-400">Last 30 days.</p>
              <BarChart data={revenue.byStatus} />
            </div>
```

> Keep the `Booking mode` donut as-is (it is a reasonable recent-sample view). `vehicleTypeData`/`vehicleTypeMap` are now unused — remove those two `const` blocks and the `BarChart`'s prior `vehicleTypeData` usage so there are no orphaned variables.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck` → clean. Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dashboard/automations/REPLACE/  ` is optional (auth-gated).

```bash
git add "src/app/dashboard/automations/[automationId]/page.tsx"
git commit -m "feat(dashboard): real trend + revenue/completion/response KPIs on automation overview"
```

---

# WORKSTREAM 3 — Analytics Page Completion

## Task 3.1: serve response-time + revenue metrics

**Files:**
- Modify: `src/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route.ts`
- Modify: `tests/dashboard-7b-api.test.ts`

- [ ] **Step 1: Update the api test**

In `tests/dashboard-7b-api.test.ts`, extend the analytics mock to include the new getters, and replace the "response-time still stubbed" case. In the `vi.mock("@/lib/dashboard/insights", ...)` (add this mock near the analytics mock):

```ts
vi.mock("@/lib/dashboard/insights", () => ({
  getResponseStats: vi.fn(async () => ({ sampleSize: 5, avgSeconds: 12, p50Seconds: 9, p95Seconds: 30 })),
  getRevenueSummary: vi.fn(async () => ({ totalFare: 1000, avgFare: 20, completedCount: 30, bookingCount: 50, completionPct: 60, byStatus: [] })),
}));
```

Replace the existing response-time stub assertion with:

```ts
  it("serves response-time stats", async () => {
    requireOrgAccess.mockResolvedValue({ tenant_id: "o1" });
    const res = await analyticsGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1", metric: "response-time" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ metric: "response-time", data: { avgSeconds: 12 } });
  });
  it("serves revenue stats", async () => {
    requireOrgAccess.mockResolvedValue({ tenant_id: "o1" });
    const res = await analyticsGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1", metric: "revenue" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ metric: "revenue", data: { completionPct: 60 } });
  });
```

> Match the `requireOrgAccess.mockResolvedValue(...)` success shape used by the other passing analytics cases in this file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-7b-api.test.ts -t "response-time\|revenue"`
Expected: FAIL — `response-time` still returns `{ available: false }`; `revenue` is unknown (404).

- [ ] **Step 3: Wire the metrics in the route**

In the `[metric]/route.ts` import block add:

```ts
import { getResponseStats, getRevenueSummary } from "@/lib/dashboard/insights";
```

Add to the `METRICS` map (after `voice`):

```ts
  voice: (id, r) => getVoiceStats(id, r),
  "response-time": (id, r) => getResponseStats(id, r),
  revenue: (id, r) => getRevenueSummary(id, r),
```

Remove the now-served metric from the stub set:

```ts
const STUB_METRICS = new Set<string>([]);
```

> Leave the `if (STUB_METRICS.has(metric))` block in place (it now matches nothing but keeps the shape for future stubs).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dashboard-7b-api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route.ts" tests/dashboard-7b-api.test.ts
git commit -m "feat(analytics): serve response-time + revenue metrics"
```

## Task 3.2: render Response Time + Revenue sections

**Files:**
- Modify: `src/app/dashboard/automations/[automationId]/analytics/analytics-client.tsx`

- [ ] **Step 1: Import the new types**

In the `import type { ... } from "@/lib/dashboard/analytics-types"` block, no change needed. Add a new import:

```tsx
import type { ResponseStats, RevenueSummary } from "@/lib/dashboard/insights-types";
```

- [ ] **Step 2: Add the metrics to `AllMetrics` + `emptyMetrics` + the loading object + fetch batch + extract**

In `interface AllMetrics`, add:

```tsx
  voice: MetricState<VoiceStats>;
  responseTime: MetricState<ResponseStats>;
  revenue: MetricState<RevenueSummary>;
```

In `emptyMetrics()` return and in the `setMetrics({ ... })` "loading" object, add `responseTime: { status: "idle" }` / `responseTime: { status: "loading" }` and the same for `revenue`.

In the `Promise.allSettled([...])` destructure + array, append `fetchMetric("response-time")` and `fetchMetric("revenue")` as `responseRes`, `revenueRes`. In the final `setMetrics`, add:

```tsx
        responseTime: extract<ResponseStats>(responseRes, "data"),
        revenue: extract<RevenueSummary>(revenueRes, "data"),
```

- [ ] **Step 3: Replace the Response Time stub section (section 8)**

Replace:

```tsx
      {/* 8 — Response Time Distribution (not yet available) */}
      <SectionCard title="Response Time Distribution">
        <UnavailableCard message="Available once message-timing capture is enabled." />
      </SectionCard>
```

with:

```tsx
      {/* 8 — Response Time */}
      <SectionCard title="Response Time">
        {metrics.responseTime.status === "loading" ? (
          <Skeleton height={120} />
        ) : metrics.responseTime.status === "ok" ? (
          metrics.responseTime.data.sampleSize === 0 ? (
            <UnavailableCard message="No measurable responses in this period." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Avg" value={`${metrics.responseTime.data.avgSeconds}s`} />
              <StatTile label="Median" value={`${metrics.responseTime.data.p50Seconds}s`} />
              <StatTile label="P95" value={`${metrics.responseTime.data.p95Seconds}s`} />
              <StatTile label="Sample" value={metrics.responseTime.data.sampleSize.toLocaleString()} />
            </div>
          )
        ) : metrics.responseTime.status === "error" ? (
          <UnavailableCard message="Could not load response-time data." />
        ) : null}
      </SectionCard>

      {/* 8b — Revenue */}
      <SectionCard title="Revenue & Completion">
        {metrics.revenue.status === "loading" ? (
          <Skeleton height={120} />
        ) : metrics.revenue.status === "ok" ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Revenue" value={`£${metrics.revenue.data.totalFare.toLocaleString()}`} />
              <StatTile label="Avg fare" value={`£${metrics.revenue.data.avgFare}`} />
              <StatTile label="Completion" value={`${metrics.revenue.data.completionPct}%`} />
              <StatTile label="Bookings" value={metrics.revenue.data.bookingCount.toLocaleString()} />
            </div>
            {metrics.revenue.data.byStatus.length > 0 && <HorizontalBarChart data={metrics.revenue.data.byStatus} />}
          </div>
        ) : metrics.revenue.status === "error" ? (
          <UnavailableCard message="Could not load revenue data." />
        ) : null}
      </SectionCard>
```

> `StatTile`, `Skeleton`, `UnavailableCard`, `SectionCard`, and `HorizontalBarChart` already exist in this file / its imports (added for the voice section in Epic 11). If `StatTile` is defined below its first use, no problem — function declarations hoist.

- [ ] **Step 4: Typecheck + tests + commit**

Run: `pnpm typecheck && pnpm vitest run tests/dashboard-7b-api.test.ts`
Expected: clean + PASS.

```bash
git add "src/app/dashboard/automations/[automationId]/analytics/analytics-client.tsx"
git commit -m "feat(analytics): render Response Time + Revenue & Completion sections"
```

---

# WORKSTREAM 4 — Org Overview Revamp

## Task 4.1: org KPIs with revenue + 30-day trend

**Files:**
- Modify: `src/lib/dashboard/queries.ts`
- Test: `tests/dashboard-org-kpis.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/dashboard-org-kpis.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reduceOrgKpis } from "@/lib/dashboard/queries";

describe("reduceOrgKpis", () => {
  it("sums revenue and counts bookings across the tenant", () => {
    const k = reduceOrgKpis([
      { fare: 20, status: "completed" }, { fare: 30, status: "cancelled" }, { fare: null, status: "confirmed" },
    ]);
    expect(k.bookings30d).toBe(3);
    expect(k.revenue30d).toBe(50);
  });
  it("is zero-safe with no bookings", () => {
    expect(reduceOrgKpis([])).toEqual({ bookings30d: 0, revenue30d: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-org-kpis.test.ts`
Expected: FAIL — `reduceOrgKpis` not exported.

- [ ] **Step 3: Add `reduceOrgKpis` + `getOrgKpis` to `queries.ts`**

Add near the top exports (do NOT change `getKpiStrip`/`getAutomationCards`):

```ts
export function reduceOrgKpis(bookings: { fare: number | null; status: string }[]): { bookings30d: number; revenue30d: number } {
  const revenue30d = Math.round(
    bookings.reduce((s, b) => s + (typeof b.fare === "number" ? b.fare : 0), 0),
  );
  return { bookings30d: bookings.length, revenue30d };
}

export async function getOrgKpis(tenantId: string, client?: SupabaseLike): Promise<{ bookings30d: number; revenue30d: number }> {
  const supabase = client ?? (await createClient());
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabase.from("bookings").select("fare, status").eq("tenant_id", tenantId).gte("created_at", since);
  return reduceOrgKpis((data ?? []) as { fare: number | null; status: string }[]);
}
```

> If `SupabaseLike`/`createClient` are not already imported at the top of `queries.ts`, they are (the existing getters use them) — reuse them.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dashboard-org-kpis.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/dashboard-org-kpis.test.ts
git commit -m "feat(dashboard): org-level 30-day bookings + revenue KPIs"
```

## Task 4.2: surface revenue on the org overview KPI strip

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Load org KPIs**

Add `getOrgKpis` to the import from `@/lib/dashboard/queries`. Replace the existing `Promise.all([...])` (`org, kpis, cards`) with:

```tsx
  const [org, kpis, cards, orgKpis] = await Promise.all([
    getOrgSummary(claims.tenant_id),
    getKpiStrip(claims.tenant_id),
    getAutomationCards(claims.tenant_id),
    getOrgKpis(claims.tenant_id),
  ]);
```

- [ ] **Step 2: Add revenue + 30-day bookings to the KPI strip**

Replace the `<KpiStrip items={[...]} />` block with:

```tsx
          <KpiStrip
            items={[
              { label: "Bookings today", value: kpis.bookingsToday },
              { label: "Bookings (30d)", value: orgKpis.bookings30d },
              { label: "Revenue (30d)", value: `£${orgKpis.revenue30d.toLocaleString()}` },
              { label: "Conversations today", value: kpis.conversationsToday },
              { label: "Live automations", value: kpis.liveAutomations },
            ]}
          />
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck` → clean.

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): revenue + 30-day bookings on org overview"
```

---

# Task 5: Integration gate

- [ ] **Step 1: Full typecheck** — `pnpm typecheck` → clean.
- [ ] **Step 2: Full suite** — `pnpm test` → PASS except the pre-existing live-n8n `tests/engine-client.integration.test.ts` (env-dependent). All dashboard/analytics suites green.
- [ ] **Step 3: Manual smoke (optional, dev server running):** sign in as `demo@demo.bookmycab.com`, open an automation → overview shows a populated trend + revenue/response KPIs; Analytics tab shows Response Time + Revenue sections; `/dashboard` shows revenue + 30-day bookings.

---

## Self-Review

**Spec coverage:** Trend time-series (WS1+WS2), revenue/completion (WS1+WS2+WS3+WS4), response-time from message timestamps (WS1+WS2+WS3), analytics completion incl. previously-stubbed response-time (WS3), org-level revenue (WS4), live demo data (done separately). 

**Placeholder scan:** every step has complete code; tests assert real behavior; no TBD.

**Type consistency:** `TrendPoint`/`ResponseStats`/`RevenueSummary` defined in 1.1 are consumed unchanged in 2.2 (overview), 3.2 (analytics-client via `insights-types`), and the route (3.1). `getBookingsTrend`/`getRevenueSummary`/`getResponseStats(automationId, range, client?)` signatures match between definition (1.2) and callers (2.2, 3.1). `reduceOrgKpis` shape matches between 4.1 definition, its test, and the `getOrgKpis` caller.

**Parallelization:** WS1 is foundational (build first). WS2 (overview page + new client file), WS3 (analytics route + client + api test), WS4 (queries.ts + org page + test) touch disjoint files and build in parallel after WS1. Task 5 is the gate.
