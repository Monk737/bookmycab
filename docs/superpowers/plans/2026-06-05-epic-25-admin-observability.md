# Epic 25: Admin Platform Observability — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give FlowMo staff two admin dashboards: a **Usage & cost** view (per-tenant metering/quota across features, from the metering tables) and a **Platform health** view (automation success rates, dispatch-adapter health, and notification deliverability aggregated across all tenants). Admin-only (`requireStaff`).

**Architecture:** No new tables — both dashboards aggregate existing data (`usage_counters`/`usage_events`, `automation_runs`, `dispatch_attempts`, `notification_log`, `tenants`). A pure reducer layer turns raw rows into per-tenant usage rows and platform-health summaries (fully unit-tested). A service (service-role) fetches the rows and runs the reducers. Two admin pages render them, gated by `requireStaff` and added to the admin nav. This is admin-surface only: no tenant entitlement gating, no demo block.

**Tech Stack:** TypeScript, Next.js App Router (server components), Supabase service-role client, Vitest. Builds on Epic 13 (metering tables), Epic 18 (`dispatch_attempts`), Epic 14 (`notification_log`), and the existing admin shell/`requireStaff` (Epic 3).

**Dependencies:** Epics 13/14/18 (the tables being aggregated), Epic 3 (`requireStaff`, admin shell). Mirrors the established epic structure but with **no migration** (Task 1 is pure logic).

---

## File Map

### New — Core library (`src/lib/admin/observability/`)
- `src/lib/admin/observability/reduce.ts` — pure `reduceUsage(counters, tenantsById)` + `reducePlatformHealth({ runs, dispatch, notifications })`
- `src/lib/admin/observability/service.ts` — `getUsageOverview()`, `getPlatformHealth()` (service-role)

### New — Admin pages
- `src/app/admin/usage/page.tsx` — per-tenant usage & cost table
- `src/app/admin/health/page.tsx` — platform health summary

### Modified
- `src/components/admin/admin-shell.tsx` — add "Usage" + "Health" nav entries

### Test files
- `tests/admin-observability-reduce.test.ts` — pure reducers

---

## Task 1: Pure aggregation reducers

**Files:** Create `src/lib/admin/observability/reduce.ts`; Test `tests/admin-observability-reduce.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/admin-observability-reduce.test.ts
import { describe, it, expect } from "vitest";
import { reduceUsage, reducePlatformHealth, type UsageCounterRow } from "@/lib/admin/observability/reduce";

const tenants = new Map([["t1", "Premier Cabs"], ["t2", "City Cars"]]);

describe("reduceUsage", () => {
  const counters: UsageCounterRow[] = [
    { tenant_id: "t1", feature_key: "alerting", used: 120, limit_amount: 2000 },
    { tenant_id: "t1", feature_key: "ai_copilot", used: 3400, limit_amount: null },
    { tenant_id: "t2", feature_key: "alerting", used: 50, limit_amount: 200 },
  ];
  it("groups usage rows by tenant with the tenant name", () => {
    const rows = reduceUsage(counters, tenants);
    const t1 = rows.find((r) => r.tenantId === "t1")!;
    expect(t1.tenantName).toBe("Premier Cabs");
    expect(t1.features).toHaveLength(2);
  });
  it("computes a utilisation % when a limit is set, null when unlimited", () => {
    const t1 = reduceUsage(counters, tenants).find((r) => r.tenantId === "t1")!;
    const alerting = t1.features.find((f) => f.featureKey === "alerting")!;
    expect(alerting.utilisationPct).toBe(6); // 120/2000
    const copilot = t1.features.find((f) => f.featureKey === "ai_copilot")!;
    expect(copilot.utilisationPct).toBeNull();
  });
  it("flags tenants over 80% of any quota", () => {
    const overCounters: UsageCounterRow[] = [{ tenant_id: "t2", feature_key: "alerting", used: 190, limit_amount: 200 }];
    expect(reduceUsage(overCounters, tenants)[0].nearLimit).toBe(true);
  });
});

describe("reducePlatformHealth", () => {
  it("computes automation success rate", () => {
    const h = reducePlatformHealth({
      runs: [{ status: "success" }, { status: "success" }, { status: "error" }, { status: "running" }],
      dispatch: [],
      notifications: [],
    });
    expect(h.automations.total).toBe(4);
    expect(h.automations.successRate).toBe(50); // 2 success of 4
  });
  it("computes dispatch success rate per adapter", () => {
    const h = reducePlatformHealth({
      runs: [],
      dispatch: [{ adapter: "autocab", status: "success" }, { adapter: "autocab", status: "failed" }],
      notifications: [],
    });
    expect(h.dispatch.find((d) => d.adapter === "autocab")!.successRate).toBe(50);
  });
  it("computes notification deliverability", () => {
    const h = reducePlatformHealth({
      runs: [],
      dispatch: [],
      notifications: [{ status: "sent" }, { status: "sent" }, { status: "failed" }],
    });
    expect(h.notifications.total).toBe(3);
    expect(h.notifications.deliveredRate).toBeCloseTo(66.7, 1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/admin-observability-reduce.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/admin/observability/reduce.ts`**

```typescript
export interface UsageCounterRow {
  tenant_id: string;
  feature_key: string;
  used: number;
  limit_amount: number | null;
}

export interface TenantUsage {
  tenantId: string;
  tenantName: string;
  nearLimit: boolean;
  features: { featureKey: string; used: number; limit: number | null; utilisationPct: number | null }[];
}

/** Pure: group usage counters by tenant, compute utilisation %, flag near-limit (>=80%). */
export function reduceUsage(counters: UsageCounterRow[], tenantsById: Map<string, string>): TenantUsage[] {
  const byTenant = new Map<string, UsageCounterRow[]>();
  for (const c of counters) {
    const list = byTenant.get(c.tenant_id) ?? [];
    list.push(c);
    byTenant.set(c.tenant_id, list);
  }
  const out: TenantUsage[] = [];
  for (const [tenantId, rows] of byTenant) {
    let nearLimit = false;
    const features = rows.map((r) => {
      const utilisationPct = r.limit_amount && r.limit_amount > 0 ? Math.round((r.used / r.limit_amount) * 100) : null;
      if (utilisationPct !== null && utilisationPct >= 80) nearLimit = true;
      return { featureKey: r.feature_key, used: r.used, limit: r.limit_amount, utilisationPct };
    });
    out.push({ tenantId, tenantName: tenantsById.get(tenantId) ?? tenantId.slice(0, 8), nearLimit, features });
  }
  return out.sort((a, b) => a.tenantName.localeCompare(b.tenantName));
}

export interface RunRow { status: string }
export interface DispatchRow { adapter: string; status: string }
export interface NotifRow { status: string }

export interface PlatformHealth {
  automations: { total: number; successRate: number };
  dispatch: { adapter: string; total: number; successRate: number }[];
  notifications: { total: number; deliveredRate: number };
}

function rate(n: number, d: number): number {
  return d === 0 ? 0 : +((n / d) * 100).toFixed(1);
}

/** Pure: aggregate platform-wide health from runs, dispatch attempts, notifications. */
export function reducePlatformHealth(args: { runs: RunRow[]; dispatch: DispatchRow[]; notifications: NotifRow[] }): PlatformHealth {
  const { runs, dispatch, notifications } = args;

  const autoTotal = runs.length;
  const autoSuccess = runs.filter((r) => r.status === "success").length;

  const byAdapter = new Map<string, DispatchRow[]>();
  for (const d of dispatch) {
    const list = byAdapter.get(d.adapter) ?? [];
    list.push(d);
    byAdapter.set(d.adapter, list);
  }
  const dispatchOut = [...byAdapter.entries()].map(([adapter, rows]) => ({
    adapter,
    total: rows.length,
    successRate: rate(rows.filter((r) => r.status === "success").length, rows.length),
  })).sort((a, b) => b.total - a.total);

  const notifTotal = notifications.length;
  const notifDelivered = notifications.filter((n) => n.status === "sent" || n.status === "delivered").length;

  return {
    automations: { total: autoTotal, successRate: autoTotal === 0 ? 0 : Math.round((autoSuccess / autoTotal) * 100) },
    dispatch: dispatchOut,
    notifications: { total: notifTotal, deliveredRate: rate(notifDelivered, notifTotal) },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/admin-observability-reduce.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/observability/reduce.ts tests/admin-observability-reduce.test.ts
git commit -m "feat(admin): pure usage + platform-health aggregation reducers"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Observability service

**Files:** Create `src/lib/admin/observability/service.ts`

- [ ] **Step 1: Create `src/lib/admin/observability/service.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { reduceUsage, reducePlatformHealth, type TenantUsage, type PlatformHealth } from "./reduce";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Per-tenant usage across features for the current period (admin-wide). */
export async function getUsageOverview(): Promise<TenantUsage[]> {
  const sb = svc();
  const [{ data: counters }, { data: tenants }] = await Promise.all([
    sb.from("usage_counters").select("tenant_id, feature_key, used, limit_amount"),
    sb.from("tenants").select("id, name"),
  ]);
  const byId = new Map<string, string>();
  for (const t of tenants ?? []) byId.set(t.id as string, (t.name as string) ?? "");
  return reduceUsage((counters ?? []) as never, byId);
}

/** Platform-wide health over the trailing window (admin-wide). */
export async function getPlatformHealth(windowHours = 168): Promise<PlatformHealth> {
  const sb = svc();
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const [{ data: runs }, { data: dispatch }, { data: notifications }] = await Promise.all([
    sb.from("automation_runs").select("status").gte("started_at", since),
    sb.from("dispatch_attempts").select("adapter, status").gte("created_at", since),
    sb.from("notification_log").select("status").gte("sent_at", since),
  ]);
  return reducePlatformHealth({
    runs: (runs ?? []) as never,
    dispatch: (dispatch ?? []) as never,
    notifications: (notifications ?? []) as never,
  });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/admin/observability/service.ts
git commit -m "feat(admin): observability service — usage overview + platform health"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Admin pages + nav

**Files:** Create `src/app/admin/usage/page.tsx`, `src/app/admin/health/page.tsx`; Modify `src/components/admin/admin-shell.tsx`

- [ ] **Step 1: Create `src/app/admin/usage/page.tsx`**

```tsx
import { requireStaff } from "@/lib/admin/guard";
import { getUsageOverview } from "@/lib/admin/observability/service";

export const metadata = { title: "Usage & cost — Admin" };

export default async function UsagePage() {
  await requireStaff();
  const usage = await getUsageOverview();
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Usage &amp; cost</h1>
      <p className="mb-4 text-sm text-slate-500">Metered feature usage per tenant for the current period.</p>
      <div className="space-y-4">
        {usage.length === 0 && <p className="text-sm text-slate-400">No metered usage recorded yet.</p>}
        {usage.map((t) => (
          <section key={t.tenantId} className="rounded-lg border border-slate-200 p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">{t.tenantName}{t.nearLimit && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">near limit</span>}</h2>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50"><tr>{["Feature", "Used", "Limit", "Utilisation"].map((h) => <th key={h} className="px-3 py-1.5 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {t.features.map((f) => (
                  <tr key={f.featureKey}>
                    <td className="px-3 py-1.5 text-slate-800">{f.featureKey}</td>
                    <td className="px-3 py-1.5 text-slate-700">{f.used.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-slate-500">{f.limit === null ? "∞" : f.limit.toLocaleString()}</td>
                    <td className="px-3 py-1.5"><span className={f.utilisationPct === null ? "text-slate-400" : f.utilisationPct >= 80 ? "text-red-600" : "text-slate-700"}>{f.utilisationPct === null ? "—" : `${f.utilisationPct}%`}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/health/page.tsx`**

```tsx
import { requireStaff } from "@/lib/admin/guard";
import { getPlatformHealth } from "@/lib/admin/observability/service";

export const metadata = { title: "Platform health — Admin" };

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  const c = tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : tone === "good" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold ${c}`}>{value}</p>
    </div>
  );
}

function tone(pct: number): "good" | "warn" | "bad" {
  return pct >= 95 ? "good" : pct >= 80 ? "warn" : "bad";
}

export default async function HealthPage() {
  await requireStaff();
  const h = await getPlatformHealth();
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Platform health</h1>
      <p className="mb-4 text-sm text-slate-500">Aggregated across all tenants (last 7 days).</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Automation success" value={`${h.automations.successRate}%`} tone={tone(h.automations.successRate)} />
        <Stat label="Automation runs" value={h.automations.total.toLocaleString()} />
        <Stat label="Notification deliverability" value={`${h.notifications.deliveredRate}%`} tone={tone(h.notifications.deliveredRate)} />
      </div>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">Dispatch adapters</h2>
      <table className="min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{["Adapter", "Attempts", "Success rate"].map((x) => <th key={x} className="px-3 py-2 text-left font-semibold text-slate-700">{x}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {h.dispatch.length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400">No dispatch activity.</td></tr>}
          {h.dispatch.map((d) => (
            <tr key={d.adapter}>
              <td className="px-3 py-2 capitalize text-slate-800">{d.adapter}</td>
              <td className="px-3 py-2 text-slate-600">{d.total}</td>
              <td className="px-3 py-2"><span className={d.successRate >= 95 ? "text-emerald-600" : d.successRate >= 80 ? "text-amber-600" : "text-red-600"}>{d.successRate}%</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Add nav entries**

In `src/components/admin/admin-shell.tsx`, add to `NAV_ITEMS` after "Overview": `{ label: "Health", href: "/admin/health" }` and `{ label: "Usage", href: "/admin/usage" }`. Match the exact existing `{ label, href }` shape.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/admin/usage` + `/admin/health`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/usage src/app/admin/health src/components/admin/admin-shell.tsx
git commit -m "feat(admin): usage & cost + platform health dashboards + nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Integration gate

- [ ] **Step 1: Run the reducer test + full typecheck**

Run: `npx vitest run tests/admin-observability-reduce.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 2: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 3: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(admin): observability gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Per-tenant usage & cost dashboard | Tasks 1, 2, 3 |
| Utilisation % + near-limit flag | Task 1 |
| Platform health: automation success, dispatch per adapter, notification deliverability | Tasks 1, 2, 3 |
| Admin-only (`requireStaff`) | Task 3 |
| No new tables (aggregates existing) | (by design) |

**Placeholder scan:** none.

**Type consistency:** `TenantUsage`/`PlatformHealth` (reduce.ts) used by service.ts + pages. `reduceUsage`/`reducePlatformHealth` pure. Service uses the established `svc()` pattern. Pages gated by `requireStaff` (admin — no entitlement/demo gating).

**Known limitations (documented):** "cost" is shown as usage volume + utilisation (the `usage_events.cost_micros` column is mostly unset in v1 — a real cost model per feature/rate is a follow-up); platform health reads raw rows (fine at current scale; a materialised rollup is a fast-follow); the demo tenant's seeded usage_counters make these dashboards non-empty immediately.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-epic-25-admin-observability.md`.

**4 tasks, no migration. Task 1 (pure) gates 2; 2 gates 3; 4 last.**
