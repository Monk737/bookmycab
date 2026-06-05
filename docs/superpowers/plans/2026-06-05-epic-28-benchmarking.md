# Epic 28: Network Benchmarking (Admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute anonymised **network benchmarks** (p25/p50/p75 across tenants, per metric) and let FlowMo staff view + recompute them from an admin page. Backs a future tenant-facing "you vs network median" widget. Admin-only (`requireStaff`).

**Architecture:** Migration 0032 creates `benchmark_snapshots` (global, service-role-only). A pure percentile function computes p25/p50/p75 from a numeric series. A service computes per-tenant metric values (revenue, bookings, abandonment) over a window, derives percentiles across tenants, and writes a snapshot row per metric; a read returns the latest snapshots. An admin page renders them with a "recompute" server action.

**Tech Stack:** Supabase Postgres (RLS), TypeScript, Next.js App Router, Vitest. Builds on Epic 3 (`requireStaff`, admin shell), bookings/conversations.

**Dependencies:** Epic 3, bookings (0003). Mirrors the established epic structure.

---

## File Map

### New — Database
- `supabase/migrations/0032_benchmark_snapshots.sql` — `benchmark_snapshots` (global) + `tenants.benchmark_opt_in`

### New — Core library
- `src/lib/admin/benchmarks.ts` — pure `percentiles(values)` + service `computeSnapshots()`, `listSnapshots()`

### New — Admin
- `src/app/admin/benchmarks/page.tsx` — snapshot table + recompute
- `src/app/admin/benchmarks/actions.ts` — `recomputeAction` (requireStaff)

### Modified
- `src/components/admin/admin-shell.tsx` — add "Benchmarks" nav entry

### Test files
- `tests/admin-benchmarks.test.ts` — pure `percentiles`
- `tests/benchmark-migration.test.ts` — 0032 structure

---

## Task 1: Migration 0032 — benchmark_snapshots

**Files:** Create `supabase/migrations/0032_benchmark_snapshots.sql`; Test `tests/benchmark-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/benchmark-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0032_benchmark_snapshots.sql"), "utf8");

describe("0032 benchmark snapshots migration", () => {
  it("creates benchmark_snapshots with percentile columns", () => {
    expect(sql).toMatch(/create table public\.benchmark_snapshots/i);
    expect(sql).toMatch(/p25\s+numeric/i);
    expect(sql).toMatch(/p50\s+numeric/i);
    expect(sql).toMatch(/p75\s+numeric/i);
    expect(sql).toMatch(/sample_size\s+integer/i);
  });
  it("adds tenants.benchmark_opt_in", () => {
    expect(sql).toMatch(/alter table public\.tenants add column benchmark_opt_in boolean/i);
  });
  it("enables RLS (global / service-role only)", () => {
    expect(sql).toMatch(/alter table public\.benchmark_snapshots enable row level security/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/benchmark-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0032_benchmark_snapshots.sql`**

```sql
-- 0032: Network benchmarking (global, anonymised).
--
-- benchmark_snapshots holds p25/p50/p75 of a metric across opted-in tenants.
-- Global config — RLS enabled, no tenant policy (service-role only). A tenant
-- opt-in flag governs inclusion + (future) visibility of the comparison.

create table public.benchmark_snapshots (
  id           uuid primary key default gen_random_uuid(),
  metric       text not null,
  period_days  integer not null default 30,
  p25          numeric,
  p50          numeric,
  p75          numeric,
  sample_size  integer not null default 0,
  computed_at  timestamptz not null default now()
);
create index benchmark_snapshots_metric_idx on public.benchmark_snapshots (metric, computed_at);

alter table public.tenants add column benchmark_opt_in boolean not null default true;

alter table public.benchmark_snapshots enable row level security;
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/benchmark-migration.test.ts`
Expected: applied; 3 tests PASS. (If `db push` replays a prior migration, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0032_benchmark_snapshots.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0032_benchmark_snapshots.sql tests/benchmark-migration.test.ts
git commit -m "feat(admin): migration 0032 — benchmark_snapshots + tenant opt-in"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure percentiles + benchmark service

**Files:** Create `src/lib/admin/benchmarks.ts`; Test `tests/admin-benchmarks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/admin-benchmarks.test.ts
import { describe, it, expect } from "vitest";
import { percentiles } from "@/lib/admin/benchmarks";

describe("percentiles", () => {
  it("computes p25/p50/p75 (nearest-rank) for a series", () => {
    const p = percentiles([10, 20, 30, 40, 50, 60, 70, 80]);
    expect(p.p50).toBe(40); // nearest-rank median
    expect(p.p25).toBe(20);
    expect(p.p75).toBe(60);
    expect(p.sampleSize).toBe(8);
  });
  it("handles a single value", () => {
    const p = percentiles([42]);
    expect(p.p25).toBe(42);
    expect(p.p50).toBe(42);
    expect(p.p75).toBe(42);
  });
  it("returns nulls + zero sample for an empty series", () => {
    const p = percentiles([]);
    expect(p.p50).toBeNull();
    expect(p.sampleSize).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/admin-benchmarks.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/admin/benchmarks.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface Percentiles { p25: number | null; p50: number | null; p75: number | null; sampleSize: number }

/** Pure: nearest-rank p25/p50/p75 of a numeric series. */
export function percentiles(values: number[]): Percentiles {
  if (values.length === 0) return { p25: null, p50: null, p75: null, sampleSize: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];
  return { p25: at(0.25), p50: at(0.5), p75: at(0.75), sampleSize: sorted.length };
}

export interface SnapshotRow { metric: string; p25: number | null; p50: number | null; p75: number | null; sample_size: number; computed_at: string }

/** Compute per-tenant metric values over the window for opted-in tenants, derive
 *  percentiles across tenants, and write one snapshot row per metric. */
export async function computeSnapshots(periodDays = 30): Promise<{ metrics: number }> {
  const sb = svc();
  const since = new Date(Date.now() - periodDays * 86400_000).toISOString();
  const { data: tenants } = await sb.from("tenants").select("id").eq("benchmark_opt_in", true);
  const tenantIds = (tenants ?? []).map((t) => t.id as string);
  if (tenantIds.length === 0) return { metrics: 0 };

  const revenue: number[] = [];
  const bookings: number[] = [];
  const abandonment: number[] = [];

  for (const id of tenantIds) {
    const { data: bk } = await sb.from("bookings").select("fare").eq("tenant_id", id).gte("created_at", since);
    const rows = bk ?? [];
    revenue.push(rows.reduce((s, r) => s + (Number(r.fare) || 0), 0));
    bookings.push(rows.length);
    const { data: cv } = await sb.from("conversations").select("outcome").eq("tenant_id", id).gte("started_at", since);
    const cvRows = cv ?? [];
    const rate = cvRows.length === 0 ? 0 : +((cvRows.filter((c) => c.outcome === "abandoned").length / cvRows.length) * 100).toFixed(1);
    abandonment.push(rate);
  }

  const metrics: Record<string, number[]> = { revenue_30d: revenue, bookings_30d: bookings, abandonment_pct: abandonment };
  for (const [metric, values] of Object.entries(metrics)) {
    const p = percentiles(values);
    await sb.from("benchmark_snapshots").insert({ metric, period_days: periodDays, p25: p.p25, p50: p.p50, p75: p.p75, sample_size: p.sampleSize });
  }
  return { metrics: Object.keys(metrics).length };
}

/** Latest snapshot per metric. */
export async function listSnapshots(): Promise<SnapshotRow[]> {
  const { data } = await svc().from("benchmark_snapshots").select("metric, p25, p50, p75, sample_size, computed_at").order("computed_at", { ascending: false });
  const seen = new Set<string>();
  const out: SnapshotRow[] = [];
  for (const r of (data ?? []) as SnapshotRow[]) {
    if (seen.has(r.metric)) continue;
    seen.add(r.metric);
    out.push(r);
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/admin-benchmarks.test.ts` — Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/admin/benchmarks.ts tests/admin-benchmarks.test.ts
git commit -m "feat(admin): pure percentiles + benchmark compute/list service"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Admin benchmarks page + action + nav

**Files:** Create `src/app/admin/benchmarks/actions.ts`, `src/app/admin/benchmarks/page.tsx`; Modify `src/components/admin/admin-shell.tsx`

- [ ] **Step 1: Create `src/app/admin/benchmarks/actions.ts`**

```typescript
"use server";
import { requireStaff } from "@/lib/admin/guard";
import { computeSnapshots } from "@/lib/admin/benchmarks";
import { revalidatePath } from "next/cache";

export async function recomputeAction(): Promise<void> {
  await requireStaff();
  await computeSnapshots();
  revalidatePath("/admin/benchmarks");
}
```

- [ ] **Step 2: Create `src/app/admin/benchmarks/page.tsx`**

```tsx
import { requireStaff } from "@/lib/admin/guard";
import { listSnapshots } from "@/lib/admin/benchmarks";
import { recomputeAction } from "./actions";

export const metadata = { title: "Benchmarks — Admin" };

export default async function BenchmarksPage() {
  await requireStaff();
  const snapshots = await listSnapshots();
  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Network benchmarks</h1>
          <p className="text-sm text-slate-500">Anonymised p25/p50/p75 across opted-in tenants (last 30 days).</p>
        </div>
        <form action={recomputeAction}><button type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white">Recompute</button></form>
      </div>
      <table className="min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{["Metric", "p25", "Median", "p75", "Sample", "Computed"].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {snapshots.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No snapshots yet — click Recompute.</td></tr>}
          {snapshots.map((s) => (
            <tr key={s.metric}>
              <td className="px-3 py-2 font-medium text-slate-800">{s.metric}</td>
              <td className="px-3 py-2 text-slate-600">{s.p25 ?? "—"}</td>
              <td className="px-3 py-2 font-semibold text-slate-900">{s.p50 ?? "—"}</td>
              <td className="px-3 py-2 text-slate-600">{s.p75 ?? "—"}</td>
              <td className="px-3 py-2 text-slate-500">{s.sample_size}</td>
              <td className="px-3 py-2 text-slate-400">{new Date(s.computed_at).toLocaleString("en-GB")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Add "Benchmarks" nav entry**

In `src/components/admin/admin-shell.tsx`, add `{ label: "Benchmarks", href: "/admin/benchmarks" }` to `NAV_ITEMS` after "Platform", matching the exact shape.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/admin/benchmarks`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/benchmarks src/components/admin/admin-shell.tsx
git commit -m "feat(admin): network benchmarks page (view + recompute) + nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Integration gate

- [ ] **Step 1: Run benchmark tests + full typecheck**

Run: `npx vitest run tests/admin-benchmarks.test.ts tests/benchmark-migration.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 2: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 3: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(admin): benchmarks gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `benchmark_snapshots` table + tenant opt-in | Task 1 |
| Pure percentile computation | Task 2 |
| Compute snapshots across opted-in tenants | Task 2 |
| Admin view + recompute | Task 3 |
| Admin-only (`requireStaff`) | Task 3 |

**Placeholder scan:** none.

**Type consistency:** `Percentiles`/`SnapshotRow` in benchmarks.ts used by page. `percentiles` pure + tested. `computeSnapshots`/`listSnapshots` service-role. Action gated by `requireStaff`.

**Known limitations (documented):** the **tenant-facing** "you vs network median" comparison widget (gated on the `benchmarking` feature) is a tenant-side follow-up — this epic delivers the admin compute + view; recompute is on-demand (a scheduled job is a follow-up); metrics are revenue/bookings/abandonment (extendable).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-epic-28-benchmarking.md`.

**4 tasks. Task 1 (migration) gates 2; 2 gates 3; 4 last.**
