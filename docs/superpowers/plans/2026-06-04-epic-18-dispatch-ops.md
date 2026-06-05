# Epic 18: Dispatch & Fulfilment Ops — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give tenants visibility and control over dispatch fulfilment — an append-only log of every dispatch attempt, per-adapter health (success rate + p95 latency), a failed-dispatch queue, and one-click retry — gated by the `dispatch_retry` entitlement.

**Architecture:** Migration 0024 adds append-only `dispatch_attempts` (one row per call to a dispatch adapter, with status/latency/error), a global `adapter_status` cache, `automations.dispatch_mode` (sandbox|live), and `bookings.quoted_fare`. A pure reducer aggregates attempts into health stats. A service records attempts, lists failed dispatches, computes health, and retries a failed booking by re-invoking the existing dispatch adapter (`src/lib/dispatch/factory.ts`) — graceful, recording a fresh attempt either way. Tenant API routes (gated by `requireFeature("dispatch_retry")` + `blockIfDemo`) expose health, the failed queue, and retry. A tenant dashboard "Dispatch" page surfaces it, shown only when entitled.

**Tech Stack:** Supabase Postgres (RLS + immutability trigger), TypeScript, Next.js App Router, the existing dispatch factory/adapters, Vitest. Builds on Epic 13 (`requireFeature`), Epic 9 (`blockIfDemo`), Epic 6 (dispatch layer), bookings (0003).

**Dependencies:** Epic 13 (`dispatch_retry` in catalog), Epic 9 (`blockIfDemo`), Epic 6 (`DispatchAdapter` + factory). Mirrors the established epic structure.

---

## File Map

### New — Database
- `supabase/migrations/0024_dispatch_ops.sql` — `dispatch_attempts` (append-only) + `adapter_status` + `automations.dispatch_mode` + `bookings.quoted_fare`

### New — Core library (`src/lib/dispatchops/`)
- `src/lib/dispatchops/health.ts` — pure `reduceAdapterHealth(attempts)` → `{ adapter, total, succeeded, failed, successRate, p95LatencyMs }[]`
- `src/lib/dispatchops/service.ts` — `recordAttempt`, `listFailedDispatches`, `getHealth`, `retryDispatch`

### New — Tenant API
- `src/app/api/orgs/[orgId]/dispatch/health/route.ts` — GET adapter health
- `src/app/api/orgs/[orgId]/dispatch/failures/route.ts` — GET failed-dispatch queue
- `src/app/api/orgs/[orgId]/dispatch/failures/[bookingId]/retry/route.ts` — POST retry

### New — Tenant UI
- `src/app/dashboard/dispatch/page.tsx` — health + failed queue (gated)
- `src/app/dashboard/dispatch/dispatch-client.tsx` — health cards + retry table

### Modified
- `src/app/dashboard/layout.tsx` — compute `showDispatch = hasFeature(tenant_id, "dispatch_retry")`, pass to shell
- `src/components/dashboard/dashboard-shell.tsx` — conditional "Dispatch" nav entry

### Test files
- `tests/dispatchops-migration.test.ts` — 0024 structure
- `tests/dispatchops-health.test.ts` — pure health aggregation
- `tests/dispatchops-routes.test.ts` — retry route gating (demo + entitlement)

---

## Task 1: Migration 0024 — dispatch attempts + health + columns

**Files:** Create `supabase/migrations/0024_dispatch_ops.sql`; Test `tests/dispatchops-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/dispatchops-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0024_dispatch_ops.sql"), "utf8");

describe("0024 dispatch ops migration", () => {
  it("creates dispatch_attempts and adapter_status", () => {
    expect(sql).toMatch(/create table public\.dispatch_attempts/i);
    expect(sql).toMatch(/create table public\.adapter_status/i);
  });
  it("makes dispatch_attempts append-only", () => {
    expect(sql).toMatch(/create trigger dispatch_attempts_immutable/i);
    expect(sql).toMatch(/before update or delete on public\.dispatch_attempts/i);
  });
  it("adds automations.dispatch_mode and bookings.quoted_fare", () => {
    expect(sql).toMatch(/alter table public\.automations add column dispatch_mode text/i);
    expect(sql).toMatch(/alter table public\.bookings add column quoted_fare numeric/i);
  });
  it("enables RLS + tenant select on dispatch_attempts", () => {
    expect(sql).toMatch(/alter table public\.dispatch_attempts enable row level security/i);
    expect(sql).toMatch(/dispatch_attempts_select[\s\S]*current_user_tenants\(\)/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dispatchops-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0024_dispatch_ops.sql`**

```sql
-- 0024: Dispatch & fulfilment ops.
--
-- dispatch_attempts is the append-only record of every call to a dispatch
-- adapter (mirrors usage_events immutability from 0018). adapter_status is a
-- global health cache. dispatch_mode lets an automation run sandbox vs live.

create table public.dispatch_attempts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete set null,
  booking_id    uuid references public.bookings(id) on delete set null,
  adapter       text not null,
  operation     text not null default 'create',
  status        text not null check (status in ('success','failed','retrying')),
  latency_ms    integer,
  attempt_no    integer not null default 1,
  request       jsonb,
  response      jsonb,
  error         text,
  created_at    timestamptz not null default now()
);
create index dispatch_attempts_tenant_idx on public.dispatch_attempts (tenant_id, created_at);
create index dispatch_attempts_booking_idx on public.dispatch_attempts (booking_id);

create table public.adapter_status (
  adapter       text primary key,
  healthy       boolean not null default true,
  latency_p95_ms integer,
  last_check    timestamptz not null default now()
);

alter table public.automations add column dispatch_mode text not null default 'live' check (dispatch_mode in ('sandbox','live'));
alter table public.bookings add column quoted_fare numeric(10,2);

-- RLS ----------------------------------------------------------------------
alter table public.dispatch_attempts enable row level security;
alter table public.adapter_status enable row level security;

create policy dispatch_attempts_select on public.dispatch_attempts
  for select using (tenant_id in (select public.current_user_tenants()));

-- adapter_status is global platform health: authenticated read, service_role write.
create policy adapter_status_select on public.adapter_status
  for select using (auth.uid() is not null);

-- dispatch_attempts is append-only (block UPDATE/DELETE for everyone incl. service_role).
create or replace function public.prevent_dispatch_attempts_mutation()
returns trigger language plpgsql as $$
begin raise exception 'dispatch_attempts is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger dispatch_attempts_immutable
  before update or delete on public.dispatch_attempts
  for each row execute function public.prevent_dispatch_attempts_mutation();
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/dispatchops-migration.test.ts`
Expected: applied; 4 tests PASS. (If `db push` times out / replays a prior migration, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0024_dispatch_ops.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0024_dispatch_ops.sql tests/dispatchops-migration.test.ts
git commit -m "feat(dispatchops): migration 0024 — dispatch attempts, adapter status, modes"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure dispatch-health aggregation

**Files:** Create `src/lib/dispatchops/health.ts`; Test `tests/dispatchops-health.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/dispatchops-health.test.ts
import { describe, it, expect } from "vitest";
import { reduceAdapterHealth, type AttemptLite } from "@/lib/dispatchops/health";

const attempts: AttemptLite[] = [
  { adapter: "autocab", status: "success", latency_ms: 100 },
  { adapter: "autocab", status: "success", latency_ms: 200 },
  { adapter: "autocab", status: "failed", latency_ms: 5000 },
  { adapter: "icabbi", status: "success", latency_ms: 50 },
];

describe("reduceAdapterHealth", () => {
  it("groups by adapter with totals + success rate", () => {
    const h = reduceAdapterHealth(attempts);
    const ac = h.find((x) => x.adapter === "autocab")!;
    expect(ac.total).toBe(3);
    expect(ac.succeeded).toBe(2);
    expect(ac.failed).toBe(1);
    expect(ac.successRate).toBeCloseTo(66.7, 1);
  });
  it("computes p95 latency per adapter", () => {
    const ac = reduceAdapterHealth(attempts).find((x) => x.adapter === "autocab")!;
    // p95 of [100,200,5000] → index ceil(0.95*3)-1 = 2 → 5000
    expect(ac.p95LatencyMs).toBe(5000);
  });
  it("sorts adapters by total desc", () => {
    const h = reduceAdapterHealth(attempts);
    expect(h[0].adapter).toBe("autocab");
  });
  it("handles empty input", () => {
    expect(reduceAdapterHealth([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dispatchops-health.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/dispatchops/health.ts`**

```typescript
export interface AttemptLite {
  adapter: string;
  status: "success" | "failed" | "retrying";
  latency_ms: number | null;
}

export interface AdapterHealth {
  adapter: string;
  total: number;
  succeeded: number;
  failed: number;
  successRate: number; // percentage, 1dp
  p95LatencyMs: number | null;
}

/** Pure: p95 of a numeric array (nearest-rank). */
function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx];
}

/** Pure: aggregate dispatch attempts into per-adapter health, sorted by total desc. */
export function reduceAdapterHealth(attempts: AttemptLite[]): AdapterHealth[] {
  const byAdapter = new Map<string, AttemptLite[]>();
  for (const a of attempts) {
    const list = byAdapter.get(a.adapter) ?? [];
    list.push(a);
    byAdapter.set(a.adapter, list);
  }
  const out: AdapterHealth[] = [];
  for (const [adapter, list] of byAdapter) {
    const succeeded = list.filter((a) => a.status === "success").length;
    const failed = list.filter((a) => a.status === "failed").length;
    const total = list.length;
    const latencies = list.map((a) => a.latency_ms).filter((n): n is number => typeof n === "number");
    out.push({
      adapter,
      total,
      succeeded,
      failed,
      successRate: total === 0 ? 0 : +((succeeded / total) * 100).toFixed(1),
      p95LatencyMs: p95(latencies),
    });
  }
  return out.sort((a, b) => b.total - a.total);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/dispatchops-health.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dispatchops/health.ts tests/dispatchops-health.test.ts
git commit -m "feat(dispatchops): pure adapter-health aggregation"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Dispatch ops service (record / list / health / retry)

**Files:** Create `src/lib/dispatchops/service.ts`

- [ ] **Step 1: Create `src/lib/dispatchops/service.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { reduceAdapterHealth, type AdapterHealth, type AttemptLite } from "./health";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface FailedDispatch {
  booking_id: string | null; adapter: string; operation: string; error: string | null;
  attempt_no: number; created_at: string; passenger_name: string | null;
}

/** Append a dispatch attempt row. Best-effort; never throws into the caller. */
export async function recordAttempt(args: {
  tenantId: string; automationId?: string | null; bookingId?: string | null;
  adapter: string; operation?: string; status: "success" | "failed" | "retrying";
  latencyMs?: number; attemptNo?: number; request?: unknown; response?: unknown; error?: string | null;
}): Promise<void> {
  try {
    await svc().from("dispatch_attempts").insert({
      tenant_id: args.tenantId, automation_id: args.automationId ?? null, booking_id: args.bookingId ?? null,
      adapter: args.adapter, operation: args.operation ?? "create", status: args.status,
      latency_ms: args.latencyMs ?? null, attempt_no: args.attemptNo ?? 1,
      request: args.request ?? null, response: args.response ?? null, error: args.error ?? null,
    });
  } catch (e) {
    console.error("recordAttempt failed", e);
  }
}

/** Per-adapter health over the trailing `windowHours` for a tenant. */
export async function getHealth(tenantId: string, windowHours = 24): Promise<AdapterHealth[]> {
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const { data } = await svc()
    .from("dispatch_attempts")
    .select("adapter, status, latency_ms")
    .eq("tenant_id", tenantId)
    .gte("created_at", since);
  return reduceAdapterHealth((data ?? []) as AttemptLite[]);
}

/**
 * The failed-dispatch queue: the most recent failed attempt per booking that
 * has no later success. v1 approximation: list recent failed attempts joined to
 * the booking's passenger name.
 */
export async function listFailedDispatches(tenantId: string, limit = 50): Promise<FailedDispatch[]> {
  const sb = svc();
  const { data: fails } = await sb
    .from("dispatch_attempts")
    .select("booking_id, adapter, operation, error, attempt_no, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (fails ?? []) as Omit<FailedDispatch, "passenger_name">[];
  const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter((x): x is string => !!x))];
  const names = new Map<string, string | null>();
  if (bookingIds.length > 0) {
    const { data: bookings } = await sb.from("bookings").select("id, passenger_name").in("id", bookingIds);
    for (const b of bookings ?? []) names.set(b.id as string, (b.passenger_name as string) ?? null);
  }
  return rows.map((r) => ({ ...r, passenger_name: r.booking_id ? names.get(r.booking_id) ?? null : null }));
}

/**
 * Retry dispatch for a booking by re-invoking the adapter's createBooking via
 * the dispatch factory, recording a fresh attempt. Graceful: any failure is
 * caught and recorded as a failed attempt. Returns the outcome.
 *
 * NOTE (v1): the retry reconstructs a minimal booking request from the stored
 * address JSON. Full payload fidelity (driver notes, references, flight) is a
 * follow-up; the goal here is to re-trigger the dispatch and record the result.
 */
export async function retryDispatch(tenantId: string, bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = svc();
  const { data: booking } = await sb.from("bookings").select("*").eq("tenant_id", tenantId).eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "not_found" };

  // Count prior attempts to set attempt_no.
  const { count } = await sb.from("dispatch_attempts").select("id", { count: "exact", head: true }).eq("booking_id", bookingId);
  const attemptNo = (count ?? 0) + 1;
  const adapter = (booking.dispatch_adapter as string) ?? "autocab";

  const start = Date.now();
  try {
    // Lazy import to avoid loading the dispatch layer in non-retry paths.
    const { getAdapter } = await import("@/lib/dispatch/factory");
    const client = getAdapter(adapter as never);
    const res = await client.createBooking({
      pickup: booking.pickup_address as never,
      destination: booking.destination_address as never,
      passengerName: (booking.passenger_name as string) ?? "",
      passengerPhone: (booking.customer_handle as string) ?? "",
      vehicleType: (booking.vehicle_type as string) ?? "saloon",
      pickupAtUtc: (booking.pickup_at_utc as string) ?? new Date().toISOString(),
    } as never);
    const latencyMs = Date.now() - start;
    await recordAttempt({ tenantId, automationId: booking.automation_id as string, bookingId, adapter, operation: "create", status: "success", latencyMs, attemptNo, response: res as unknown });
    const ref = (res as { reference?: string } | null)?.reference;
    if (ref) await sb.from("bookings").update({ dispatch_ref: ref, status: "dispatched" }).eq("id", bookingId);
    return { ok: true };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const error = e instanceof Error ? e.message : String(e);
    await recordAttempt({ tenantId, automationId: booking.automation_id as string, bookingId, adapter, operation: "create", status: "failed", latencyMs, attemptNo, error });
    return { ok: false, error };
  }
}
```

> NOTE for the implementer: if `@/lib/dispatch/factory` does not export `getAdapter` with that exact name/signature, READ `src/lib/dispatch/factory.ts` and adapt the import + call to the real factory function (e.g. `createAdapter`, or a per-tenant resolver). Keep the try/catch + recordAttempt structure identical; only the adapter acquisition + `createBooking` argument shape may change to match the real `DispatchAdapter` interface in `src/lib/dispatch/types.ts`. Record whatever you changed.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — Expected: no errors. (Adjust the adapter call to the real factory/interface if tsc flags it, per the note above.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/dispatchops/service.ts
git commit -m "feat(dispatchops): record/list/health + best-effort retry via dispatch factory"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Tenant API routes (gated)

**Files:** Create the three route files; Test `tests/dispatchops-routes.test.ts`

- [ ] **Step 1: Write the failing test (retry route gating)**

```typescript
// tests/dispatchops-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/dispatchops/service", () => ({ retryDispatch: vi.fn(async () => ({ ok: true })) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { retryDispatch } from "@/lib/dispatchops/service";
import { POST } from "@/app/api/orgs/[orgId]/dispatch/failures/[bookingId]/retry/route";

const ctx = { params: Promise.resolve({ orgId: "t1", bookingId: "b1" }) };
function req() { return new Request("http://x", { method: "POST" }); }

describe("POST retry dispatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retries when entitled + not demo", async () => {
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(retryDispatch).toHaveBeenCalledWith("t1", "b1");
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(retryDispatch).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(retryDispatch).not.toHaveBeenCalled();
  });
  it("502 when retry fails", async () => {
    vi.mocked(retryDispatch).mockResolvedValueOnce({ ok: false, error: "adapter down" });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/dispatchops-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/dispatch/health/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { requireFeature } from "@/lib/entitlements/guard";
import { getHealth } from "@/lib/dispatchops/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "dispatch_retry");
  if (feat) return feat;
  return NextResponse.json({ health: await getHealth(orgId) });
}
```

- [ ] **Step 4: Create `src/app/api/orgs/[orgId]/dispatch/failures/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { requireFeature } from "@/lib/entitlements/guard";
import { listFailedDispatches } from "@/lib/dispatchops/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "dispatch_retry");
  if (feat) return feat;
  return NextResponse.json({ failures: await listFailedDispatches(orgId) });
}
```

- [ ] **Step 5: Create `src/app/api/orgs/[orgId]/dispatch/failures/[bookingId]/retry/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { retryDispatch } from "@/lib/dispatchops/service";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string; bookingId: string }> }) {
  const { orgId, bookingId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "dispatch_retry");
  if (feat) return feat;
  const result = await retryDispatch(orgId, bookingId);
  if (!result.ok) {
    if (result.error === "not_found") return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    return NextResponse.json({ ok: false, error: result.error ?? "Retry failed." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Run routes test + typecheck**

Run: `npx vitest run tests/dispatchops-routes.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests); no type errors.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/orgs/[orgId]/dispatch" tests/dispatchops-routes.test.ts
git commit -m "feat(dispatchops): tenant API — health, failed queue, retry (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Tenant Dispatch page (gated) + nav

**Files:** Create `src/app/dashboard/dispatch/page.tsx`, `src/app/dashboard/dispatch/dispatch-client.tsx`; Modify `src/app/dashboard/layout.tsx`, `src/components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Create `src/app/dashboard/dispatch/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { getHealth, listFailedDispatches } from "@/lib/dispatchops/service";
import { DispatchClient } from "./dispatch-client";

export const metadata = { title: "Dispatch — BookMyCab" };

export default async function DispatchPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "dispatch_retry"))) redirect("/dashboard");
  const [health, failures] = await Promise.all([getHealth(claims.tenant_id), listFailedDispatches(claims.tenant_id)]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Dispatch</h1>
      <p className="mb-4 text-sm text-slate-500">Adapter health and failed-dispatch recovery (last 24h).</p>
      <DispatchClient orgId={claims.tenant_id} health={health} failures={failures} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/dispatch/dispatch-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Health { adapter: string; total: number; succeeded: number; failed: number; successRate: number; p95LatencyMs: number | null }
interface Failure { booking_id: string | null; adapter: string; operation: string; error: string | null; attempt_no: number; created_at: string; passenger_name: string | null }

export function DispatchClient(props: { orgId: string; health: Health[]; failures: Failure[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function retry(bookingId: string) {
    setBusy(bookingId); setErr(null);
    try {
      const res = await fetch(`/api/orgs/${props.orgId}/dispatch/failures/${bookingId}/retry`, { method: "POST" });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setErr(typeof b.error === "string" ? b.error : `Retry failed (${res.status})`);
      else router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(null); }
  }

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {props.health.length === 0 && <p className="text-sm text-slate-400">No dispatch activity in the last 24h.</p>}
        {props.health.map((h) => (
          <div key={h.adapter} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold capitalize text-slate-800">{h.adapter}</span>
              <span className={h.successRate >= 95 ? "text-sm font-medium text-emerald-600" : h.successRate >= 80 ? "text-sm font-medium text-amber-600" : "text-sm font-medium text-red-600"}>{h.successRate}%</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{h.succeeded}/{h.total} ok · {h.failed} failed · p95 {h.p95LatencyMs ?? "—"}ms</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-900">Failed dispatches</h2>
      {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
      <table className="min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{["When", "Passenger", "Adapter", "Attempt", "Error", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {props.failures.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No failed dispatches 🎉</td></tr>}
          {props.failures.map((f, i) => (
            <tr key={`${f.booking_id}-${i}`}>
              <td className="px-3 py-2 text-slate-400">{new Date(f.created_at).toLocaleString("en-GB")}</td>
              <td className="px-3 py-2 text-slate-800">{f.passenger_name ?? "—"}</td>
              <td className="px-3 py-2 capitalize text-slate-600">{f.adapter}</td>
              <td className="px-3 py-2 text-slate-500">#{f.attempt_no}</td>
              <td className="px-3 py-2 text-red-600">{f.error ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                {!props.isDemo && f.booking_id && <button disabled={busy === f.booking_id} onClick={() => retry(f.booking_id!)} className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">{busy === f.booking_id ? "Retrying…" : "Retry"}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Gate the nav — modify `src/app/dashboard/layout.tsx`**

Read the file. It already computes `showAlerts`/`showCustomers`/`showLiveops` via `hasFeature`. Add `const showDispatch = claims.tenant_id ? await hasFeature(claims.tenant_id, "dispatch_retry") : false;` and pass `showDispatch={showDispatch}` to `<DashboardShell>`. Reuse existing imports; no second auth call.

- [ ] **Step 4: Modify `src/components/dashboard/dashboard-shell.tsx`**

Read it. It builds `NAV_ITEMS` with conditional spreads for alerts/customers/liveops. Add a `showDispatch?: boolean` prop and extend with `...(showDispatch ? [{ label: "Dispatch", href: "/dashboard/dispatch" }] : [])`. Match the exact `{ label, href }` shape.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/dashboard/dispatch`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/dispatch src/app/dashboard/layout.tsx src/components/dashboard/dashboard-shell.tsx
git commit -m "feat(dispatchops): dispatch ops dashboard page + entitlement-gated nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Integration gate

- [ ] **Step 1: Run the dispatchops test set**

Run: `npx vitest run tests/dispatchops-migration.test.ts tests/dispatchops-health.test.ts tests/dispatchops-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts (no local n8n).

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(dispatchops): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Append-only dispatch attempts log | Task 1 |
| Per-adapter health (success rate + p95) | Tasks 2, 3, 5 |
| Failed-dispatch queue | Tasks 3, 4, 5 |
| One-click retry via adapter | Tasks 3, 4, 5 |
| Sandbox vs live dispatch mode column | Task 1 |
| `quoted_fare` vs final fare column | Task 1 |
| Entitlement gate (`dispatch_retry`) on every surface | Tasks 4, 5 |
| Demo write-block on retry | Task 4 |

**Placeholder scan:** none.

**Type consistency:** `AttemptLite`/`AdapterHealth` (health.ts) used by service.ts + routes + page. `FailedDispatch` in service.ts used by route + page. `retryDispatch` returns `{ ok, error? }`; route maps `not_found`→404, other→502. `requireFeature(tenantId, "dispatch_retry")` matches Epic 13.

**Known limitations (documented):** dispatch_attempts are written by `recordAttempt`, which the booking-creation path + retry call — wiring the *original* (non-retry) booking flow and the n8n engine to call `recordAttempt` on every dispatch is a follow-up (until then the log is populated by retries + any explicit calls); the failed-queue is a recent-failed list, not a strict "failed with no later success" set (a reconcile refinement is a fast-follow); retry reconstructs a minimal booking request (full payload fidelity is a follow-up); `adapter_status` global cache table is created but a platform health sweeper + admin view are deferred to the governance epic.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-epic-18-dispatch-ops.md`.

**6 tasks. Task 1 (schema) gates all; Task 2 (pure) independent; Task 3 depends on 1–2; Task 4 depends on 3; Task 5 depends on 3; Task 6 last.**
