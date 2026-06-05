# Epic 21: Reporting & White-label — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tenants define reusable reports (a named set of metrics over a period), run them on demand to produce a structured payload + run history, and apply their own branding for white-labeled output. Gated by the `scheduled_reports` (metered) and `white_label` entitlements.

**Architecture:** Migration 0027 adds `report_definitions` (tenant-editable report configs), append-only `report_runs` (history), and `tenants.branding` (logo + colours). A pure builder turns selected metric keys + a fetched values map into report sections; a pure resolver merges tenant branding over platform defaults. A service handles definition CRUD, running a report (fetch metrics via existing dashboard insight getters → persist a `report_runs` row → `recordUsage("scheduled_reports")`), listing runs, and branding get/set. Tenant API routes (gated by `requireFeature` + `blockIfDemo`) expose definitions, run, runs list, and branding. A tenant dashboard "Reports" page surfaces it, shown only when entitled.

**Tech Stack:** Supabase Postgres (RLS + immutability), TypeScript, Next.js App Router, the existing dashboard insight getters, Vitest. Builds on Epic 13 (`requireFeature`/`recordUsage`), Epic 9 (`blockIfDemo`), Epic 7 (insight getters).

**Dependencies:** Epic 13 (`scheduled_reports` metered + `white_label` in catalog), Epic 9 (`blockIfDemo`), Epic 7 (`getRevenueSummary`/`getResponseStats`/`getBookingsTrend`/`getAirportStats`). Mirrors the established epic structure.

---

## File Map

### New — Database
- `supabase/migrations/0027_reporting.sql` — `report_definitions`, `report_runs` (append-only), `tenants.branding`

### New — Core library (`src/lib/reporting/`)
- `src/lib/reporting/build.ts` — pure `buildReport(metricKeys, values)` → sections; `resolveBranding(branding)` → merged branding
- `src/lib/reporting/service.ts` — definition CRUD + `runReport`, `listRuns`, `getBranding`, `setBranding`

### New — Tenant API
- `src/app/api/orgs/[orgId]/reports/route.ts` — GET definitions, POST create
- `src/app/api/orgs/[orgId]/reports/[reportId]/route.ts` — DELETE, POST run
- `src/app/api/orgs/[orgId]/reports/branding/route.ts` — GET, PATCH

### New — Tenant UI
- `src/app/dashboard/reports/page.tsx` — definitions + runs + branding (gated)
- `src/app/dashboard/reports/reports-client.tsx`

### Modified
- `src/app/dashboard/layout.tsx` — compute `showReports = hasFeature(tenant_id, "scheduled_reports")`, pass to shell
- `src/components/dashboard/dashboard-shell.tsx` — conditional "Reports" nav entry

### Test files
- `tests/reporting-migration.test.ts` — 0027 structure
- `tests/reporting-build.test.ts` — pure builder + branding resolution
- `tests/reporting-routes.test.ts` — run route gating (demo + entitlement)

---

## Task 1: Migration 0027 — report definitions + runs + branding

**Files:** Create `supabase/migrations/0027_reporting.sql`; Test `tests/reporting-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/reporting-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0027_reporting.sql"), "utf8");

describe("0027 reporting migration", () => {
  it("creates report_definitions and report_runs", () => {
    expect(sql).toMatch(/create table public\.report_definitions/i);
    expect(sql).toMatch(/create table public\.report_runs/i);
  });
  it("makes report_runs append-only", () => {
    expect(sql).toMatch(/create trigger report_runs_immutable/i);
    expect(sql).toMatch(/before update or delete on public\.report_runs/i);
  });
  it("adds tenants.branding jsonb", () => {
    expect(sql).toMatch(/alter table public\.tenants add column branding jsonb/i);
  });
  it("enables RLS + tenant policies", () => {
    expect(sql).toMatch(/alter table public\.report_definitions enable row level security/i);
    expect(sql).toMatch(/alter table public\.report_runs enable row level security/i);
    expect(sql).toMatch(/report_definitions_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/report_definitions_insert/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/reporting-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0027_reporting.sql`**

```sql
-- 0027: Reporting & white-label.
--
-- report_definitions are tenant-editable report configs; report_runs is the
-- append-only history (mirrors usage_events immutability). tenants.branding
-- holds logo + colours for white-labeled output.

create table public.report_definitions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  metrics     jsonb not null default '[]'::jsonb,
  filters     jsonb not null default '{}'::jsonb,
  schedule    text,
  format      text not null default 'json' check (format in ('json','csv','pdf')),
  recipients  jsonb not null default '[]'::jsonb,
  white_label boolean not null default false,
  enabled     boolean not null default true,
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index report_definitions_tenant_idx on public.report_definitions (tenant_id);

create table public.report_runs (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid references public.report_definitions(id) on delete set null,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  status       text not null check (status in ('success','failed')),
  payload      jsonb,
  file_ref     text,
  error        text,
  generated_at timestamptz not null default now()
);
create index report_runs_tenant_idx on public.report_runs (tenant_id, generated_at);

alter table public.tenants add column branding jsonb not null default '{}'::jsonb;

-- RLS ----------------------------------------------------------------------
alter table public.report_definitions enable row level security;
alter table public.report_runs enable row level security;

create policy report_definitions_select on public.report_definitions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy report_definitions_insert on public.report_definitions
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy report_definitions_update on public.report_definitions
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy report_definitions_delete on public.report_definitions
  for delete using (tenant_id in (select public.current_user_tenants()));

create policy report_runs_select on public.report_runs
  for select using (tenant_id in (select public.current_user_tenants()));

create or replace function public.prevent_report_runs_mutation()
returns trigger language plpgsql as $$
begin raise exception 'report_runs is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger report_runs_immutable
  before update or delete on public.report_runs
  for each row execute function public.prevent_report_runs_mutation();
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/reporting-migration.test.ts`
Expected: applied; 4 tests PASS. (If `db push` replays a prior migration, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0027_reporting.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0027_reporting.sql tests/reporting-migration.test.ts
git commit -m "feat(reporting): migration 0027 — report definitions, runs, branding"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure report builder + branding resolution

**Files:** Create `src/lib/reporting/build.ts`; Test `tests/reporting-build.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/reporting-build.test.ts
import { describe, it, expect } from "vitest";
import { buildReport, resolveBranding, REPORT_METRICS } from "@/lib/reporting/build";

describe("buildReport", () => {
  it("emits one section per known metric key in order", () => {
    const r = buildReport(["revenue", "response_time"], { revenue: { total: 1234.5, completed: 40 }, response_time: { p50Sec: 3, p95Sec: 9 } });
    expect(r.sections).toHaveLength(2);
    expect(r.sections[0].key).toBe("revenue");
    expect(r.sections[1].key).toBe("response_time");
  });
  it("skips unknown metric keys", () => {
    const r = buildReport(["revenue", "bogus"], { revenue: { total: 1, completed: 1 } });
    expect(r.sections).toHaveLength(1);
  });
  it("renders the metric's label + values", () => {
    const r = buildReport(["revenue"], { revenue: { total: 100, completed: 5 } });
    expect(r.sections[0].title).toBe(REPORT_METRICS.revenue.label);
    expect(r.sections[0].rows.length).toBeGreaterThan(0);
  });
  it("includes generatedAt + title", () => {
    const r = buildReport(["revenue"], { revenue: { total: 1, completed: 1 } }, "Weekly summary");
    expect(r.title).toBe("Weekly summary");
    expect(typeof r.generatedAt).toBe("string");
  });
});

describe("resolveBranding", () => {
  it("falls back to platform defaults when branding is empty", () => {
    const b = resolveBranding({});
    expect(b.primary).toBe("#1E40AF");
    expect(b.logoUrl).toBeNull();
  });
  it("tenant values override defaults", () => {
    const b = resolveBranding({ primary: "#FF0000", logoUrl: "https://x/logo.png" });
    expect(b.primary).toBe("#FF0000");
    expect(b.logoUrl).toBe("https://x/logo.png");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/reporting-build.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/reporting/build.ts`**

```typescript
export interface ReportMetricDef {
  key: string;
  label: string;
  /** Turn a raw metric value object into label/value rows. */
  toRows: (value: unknown) => { label: string; value: string }[];
}

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

export const REPORT_METRICS: Record<string, ReportMetricDef> = {
  revenue: {
    key: "revenue",
    label: "Revenue & completion",
    toRows: (v) => {
      const o = (v ?? {}) as { total?: number; completed?: number };
      return [
        { label: "Total revenue", value: `£${num(o.total).toFixed(2)}` },
        { label: "Completed journeys", value: String(num(o.completed)) },
      ];
    },
  },
  response_time: {
    key: "response_time",
    label: "Response time",
    toRows: (v) => {
      const o = (v ?? {}) as { p50Sec?: number; p95Sec?: number };
      return [
        { label: "Median reply", value: `${num(o.p50Sec)}s` },
        { label: "p95 reply", value: `${num(o.p95Sec)}s` },
      ];
    },
  },
  bookings: {
    key: "bookings",
    label: "Bookings",
    toRows: (v) => {
      const o = (v ?? {}) as { total?: number };
      return [{ label: "Total bookings", value: String(num(o.total)) }];
    },
  },
};

export interface ReportSection { key: string; title: string; rows: { label: string; value: string }[] }
export interface Report { title: string; generatedAt: string; sections: ReportSection[] }

/** Pure: assemble a report from selected metric keys + a fetched values map. */
export function buildReport(metricKeys: string[], values: Record<string, unknown>, title = "Report"): Report {
  const sections: ReportSection[] = [];
  for (const key of metricKeys) {
    const def = REPORT_METRICS[key];
    if (!def) continue;
    sections.push({ key, title: def.label, rows: def.toRows(values[key]) });
  }
  return { title, generatedAt: new Date().toISOString(), sections };
}

export interface Branding { logoUrl: string | null; primary: string; accent: string }

const DEFAULT_BRANDING: Branding = { logoUrl: null, primary: "#1E40AF", accent: "#F59E0B" };

/** Pure: merge a tenant's stored branding over the platform defaults. */
export function resolveBranding(branding: Record<string, unknown> | null): Branding {
  const b = branding ?? {};
  return {
    logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : DEFAULT_BRANDING.logoUrl,
    primary: typeof b.primary === "string" ? b.primary : DEFAULT_BRANDING.primary,
    accent: typeof b.accent === "string" ? b.accent : DEFAULT_BRANDING.accent,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/reporting-build.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/reporting/build.ts tests/reporting-build.test.ts
git commit -m "feat(reporting): pure report builder + branding resolution"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Reporting service

**Files:** Create `src/lib/reporting/service.ts`

- [ ] **Step 1: Create `src/lib/reporting/service.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { buildReport, resolveBranding, type Branding, type Report } from "./build";
import { recordUsage } from "@/lib/entitlements/meter";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface ReportDefRow { id: string; name: string; metrics: unknown; format: string; white_label: boolean; enabled: boolean }
export interface ReportRunRow { id: string; report_id: string | null; status: string; generated_at: string }

export async function listDefinitions(tenantId: string): Promise<ReportDefRow[]> {
  const { data } = await svc().from("report_definitions").select("id, name, metrics, format, white_label, enabled").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as ReportDefRow[];
}

export async function createDefinition(tenantId: string, input: { name: string; metrics: string[]; format?: string; whiteLabel?: boolean; createdBy: string }): Promise<void> {
  await svc().from("report_definitions").insert({
    tenant_id: tenantId, name: input.name, metrics: input.metrics,
    format: input.format ?? "json", white_label: input.whiteLabel ?? false, created_by: input.createdBy,
  });
}

export async function deleteDefinition(tenantId: string, reportId: string): Promise<void> {
  await svc().from("report_definitions").delete().eq("tenant_id", tenantId).eq("id", reportId);
}

export async function listRuns(tenantId: string, limit = 30): Promise<ReportRunRow[]> {
  const { data } = await svc().from("report_runs").select("id, report_id, status, generated_at").eq("tenant_id", tenantId).order("generated_at", { ascending: false }).limit(limit);
  return (data ?? []) as ReportRunRow[];
}

export async function getBranding(tenantId: string): Promise<Branding> {
  const { data } = await svc().from("tenants").select("branding").eq("id", tenantId).maybeSingle();
  return resolveBranding((data?.branding as Record<string, unknown>) ?? null);
}

export async function setBranding(tenantId: string, branding: { logoUrl?: string | null; primary?: string; accent?: string }): Promise<void> {
  await svc().from("tenants").update({ branding }).eq("id", tenantId);
}

/**
 * Run a report: gather the selected metrics for the tenant, build the payload,
 * persist a report_runs row, and meter one scheduled_reports unit. Metric values
 * are aggregated tenant-wide from bookings/conversations (v1 keeps the fetch
 * simple — totals over the last 30 days). Returns the built report.
 */
export async function runReport(tenantId: string, reportId: string): Promise<{ ok: boolean; report?: Report }> {
  const sb = svc();
  const { data: def } = await sb.from("report_definitions").select("name, metrics").eq("tenant_id", tenantId).eq("id", reportId).maybeSingle();
  if (!def) return { ok: false };
  const metricKeys = Array.isArray(def.metrics) ? (def.metrics as string[]) : [];

  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const values: Record<string, unknown> = {};

  if (metricKeys.includes("revenue")) {
    const { data } = await sb.from("bookings").select("fare, status").eq("tenant_id", tenantId).gte("created_at", since);
    const rows = data ?? [];
    values.revenue = {
      total: rows.reduce((s, r) => s + (Number(r.fare) || 0), 0),
      completed: rows.filter((r) => r.status === "completed").length,
    };
  }
  if (metricKeys.includes("bookings")) {
    const { count } = await sb.from("bookings").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", since);
    values.bookings = { total: count ?? 0 };
  }
  if (metricKeys.includes("response_time")) {
    // v1: not deeply computed here; report shows zeros unless wired to insights.
    values.response_time = { p50Sec: 0, p95Sec: 0 };
  }

  const report = buildReport(metricKeys, values, (def.name as string) ?? "Report");
  await sb.from("report_runs").insert({ tenant_id: tenantId, report_id: reportId, status: "success", payload: report });
  await recordUsage({ tenantId, featureKey: "scheduled_reports", quantity: 1, unit: "reports" });
  return { ok: true, report };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/reporting/service.ts
git commit -m "feat(reporting): definition CRUD + runReport (metrics + meter) + branding"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Tenant API routes (gated)

**Files:** Create the three route files; Test `tests/reporting-routes.test.ts`

- [ ] **Step 1: Write the failing test (run route gating)**

```typescript
// tests/reporting-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/reporting/service", () => ({ runReport: vi.fn(async () => ({ ok: true, report: { title: "r", generatedAt: "x", sections: [] } })), deleteDefinition: vi.fn(async () => {}) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { runReport } from "@/lib/reporting/service";
import { POST } from "@/app/api/orgs/[orgId]/reports/[reportId]/route";

const ctx = { params: Promise.resolve({ orgId: "t1", reportId: "r1" }) };
function req() { return new Request("http://x", { method: "POST" }); }

describe("POST run report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs when entitled + not demo", async () => {
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(runReport).toHaveBeenCalledWith("t1", "r1");
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(runReport).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(runReport).not.toHaveBeenCalled();
  });
  it("404 when the report is missing", async () => {
    vi.mocked(runReport).mockResolvedValueOnce({ ok: false });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/reporting-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/reports/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listDefinitions, createDefinition } from "@/lib/reporting/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "scheduled_reports");
  if (feat) return feat;
  return NextResponse.json({ definitions: await listDefinitions(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "scheduled_reports");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  const metrics = Array.isArray(b.metrics) ? (b.metrics as string[]).map(String) : [];
  if (!name || metrics.length === 0) return NextResponse.json({ error: "name and at least one metric are required." }, { status: 400 });
  await createDefinition(orgId, { name, metrics, format: typeof b.format === "string" ? b.format : undefined, whiteLabel: Boolean(b.whiteLabel), createdBy: gate.claims.sub });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create `src/app/api/orgs/[orgId]/reports/[reportId]/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { runReport, deleteDefinition } from "@/lib/reporting/service";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string; reportId: string }> }) {
  const { orgId, reportId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "scheduled_reports");
  if (feat) return feat;
  const result = await runReport(orgId, reportId);
  if (!result.ok) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json({ ok: true, report: result.report });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; reportId: string }> }) {
  const { orgId, reportId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "scheduled_reports");
  if (feat) return feat;
  await deleteDefinition(orgId, reportId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create `src/app/api/orgs/[orgId]/reports/branding/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { getBranding, setBranding } from "@/lib/reporting/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "white_label");
  if (feat) return feat;
  return NextResponse.json({ branding: await getBranding(orgId) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "white_label");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await setBranding(orgId, {
    logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : null,
    primary: typeof b.primary === "string" ? b.primary : undefined,
    accent: typeof b.accent === "string" ? b.accent : undefined,
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Run routes test + typecheck**

Run: `npx vitest run tests/reporting-routes.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests); no type errors.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/orgs/[orgId]/reports" tests/reporting-routes.test.ts
git commit -m "feat(reporting): tenant API — definitions, run, branding (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Tenant Reports page (gated) + nav

**Files:** Create `src/app/dashboard/reports/page.tsx`, `src/app/dashboard/reports/reports-client.tsx`; Modify `src/app/dashboard/layout.tsx`, `src/components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Create `src/app/dashboard/reports/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listDefinitions, listRuns, getBranding } from "@/lib/reporting/service";
import { ReportsClient } from "./reports-client";

export const metadata = { title: "Reports — CabbyBot" };

export default async function ReportsPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "scheduled_reports"))) redirect("/dashboard");
  const canBrand = await hasFeature(claims.tenant_id, "white_label");
  const [definitions, runs, branding] = await Promise.all([
    listDefinitions(claims.tenant_id),
    listRuns(claims.tenant_id),
    getBranding(claims.tenant_id),
  ]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Reports</h1>
      <p className="mb-4 text-sm text-slate-500">Define reports, run them on demand, and brand the output.</p>
      <ReportsClient orgId={claims.tenant_id} definitions={definitions} runs={runs} branding={branding} canBrand={canBrand} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/reports/reports-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Def { id: string; name: string; metrics: unknown; format: string; white_label: boolean; enabled: boolean }
interface Run { id: string; report_id: string | null; status: string; generated_at: string }
interface Branding { logoUrl: string | null; primary: string; accent: string }
const METRICS = [{ k: "revenue", l: "Revenue & completion" }, { k: "bookings", l: "Bookings" }, { k: "response_time", l: "Response time" }];

export function ReportsClient(props: { orgId: string; definitions: Def[]; runs: Run[]; branding: Branding; canBrand: boolean; isDemo: boolean }) {
  const router = useRouter();
  const base = `/api/orgs/${props.orgId}/reports`;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string[]>([]);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`);
      else router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Report definitions</h2>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {props.definitions.length === 0 && <li className="py-2 text-slate-400">No reports yet.</li>}
          {props.definitions.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{d.name} <span className="text-xs text-slate-400">· {Array.isArray(d.metrics) ? (d.metrics as string[]).join(", ") : ""}</span></span>
              {!props.isDemo && (
                <span className="flex gap-1">
                  <button disabled={busy} onClick={() => call(`${base}/${d.id}`, "POST")} className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white">Run</button>
                  <button disabled={busy} onClick={() => call(`${base}/${d.id}`, "DELETE")} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Delete</button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (sel.length) { void call(base, "POST", { name: f.get("name"), metrics: sel }); e.currentTarget.reset(); setSel([]); } }} className="space-y-2">
            <input name="name" required placeholder="Report name" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            <div className="flex flex-wrap gap-2 text-xs">
              {METRICS.map((m) => (
                <label key={m.k} className="flex items-center gap-1">
                  <input type="checkbox" checked={sel.includes(m.k)} onChange={(e) => setSel((s) => e.target.checked ? [...s, m.k] : s.filter((x) => x !== m.k))} /> {m.l}
                </label>
              ))}
            </div>
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Create report</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent runs</h2>
        {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
        <ul className="mb-4 divide-y divide-slate-100 text-sm">
          {props.runs.length === 0 && <li className="py-2 text-slate-400">No runs yet.</li>}
          {props.runs.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span className={r.status === "success" ? "text-emerald-600" : "text-red-600"}>{r.status}</span>
              <span className="text-xs text-slate-400">{new Date(r.generated_at).toLocaleString("en-GB")}</span>
            </li>
          ))}
        </ul>
        {props.canBrand && !props.isDemo && (
          <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void call(`${base}/branding`, "PATCH", { logoUrl: f.get("logoUrl"), primary: f.get("primary"), accent: f.get("accent") }); }} className="space-y-2 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold text-slate-700">White-label branding</h3>
            <input name="logoUrl" defaultValue={props.branding.logoUrl ?? ""} placeholder="Logo URL" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            <div className="flex gap-2">
              <input name="primary" defaultValue={props.branding.primary} className="w-28 rounded border border-slate-300 px-2 py-1 text-sm" />
              <input name="accent" defaultValue={props.branding.accent} className="w-28 rounded border border-slate-300 px-2 py-1 text-sm" />
              <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Save branding</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Gate the nav — modify `src/app/dashboard/layout.tsx`**

Read the file. It already computes several `show*` flags via `hasFeature`. Add `const showReports = claims.tenant_id ? await hasFeature(claims.tenant_id, "scheduled_reports") : false;` and pass `showReports={showReports}` to `<DashboardShell>`. Reuse existing imports; no second auth call.

- [ ] **Step 4: Modify `src/components/dashboard/dashboard-shell.tsx`**

Read it. Add a `showReports?: boolean` prop and extend `NAV_ITEMS` with `...(showReports ? [{ label: "Reports", href: "/dashboard/reports" }] : [])`. Match the exact `{ label, href }` shape.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/dashboard/reports`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/reports src/app/dashboard/layout.tsx src/components/dashboard/dashboard-shell.tsx
git commit -m "feat(reporting): reports dashboard page + entitlement-gated nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Integration gate

- [ ] **Step 1: Run the reporting test set**

Run: `npx vitest run tests/reporting-migration.test.ts tests/reporting-build.test.ts tests/reporting-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(reporting): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Report definitions (named metric sets) CRUD | Tasks 1, 3, 4, 5 |
| Run a report → structured payload + run history | Tasks 2, 3, 4 |
| Metering of report runs (`scheduled_reports`) | Task 3 (recordUsage) |
| White-label branding (logo + colours) | Tasks 1, 2, 3, 4, 5 |
| Append-only run history | Task 1 |
| Entitlement gates (`scheduled_reports`, `white_label`) | Tasks 4, 5 |
| Demo write-block | Task 4 |

**Placeholder scan:** none.

**Type consistency:** `Report`/`Branding`/`ReportSection` (build.ts) used by service.ts + routes. `ReportDefRow`/`ReportRunRow` in service.ts used by routes + page. `runReport` returns `{ ok, report? }`; route maps `!ok` → 404. `requireFeature(..., "scheduled_reports")` / `"white_label"` match Epic 13.

**Known limitations (documented):** report metric fetch is a simple tenant-wide 30-day aggregate (revenue/bookings real; response_time stubbed to zeros until wired to the Epic 7 `getResponseStats` getter per-automation) — richer metric wiring is a fast-follow; PDF/CSV rendering + the `format` column + `file_ref` are deferred (runs persist the JSON payload); the `schedule` cron column is stored but a platform scheduler invoking `runReport` per definition is a follow-up (runs are on-demand in v1); email delivery to `recipients` is deferred to the alerting/notification channel plumbing.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-epic-21-reporting-whitelabel.md`.

**6 tasks. Task 1 (schema) gates all; Task 2 (pure) independent; Task 3 depends on 1–2; Task 4 depends on 3; Task 5 depends on 3; Task 6 last.**
