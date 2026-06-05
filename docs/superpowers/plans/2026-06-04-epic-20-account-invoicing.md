# Epic 20: Account Invoicing & Finance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tenant manage corporate **account customers** and issue them monthly **invoices** aggregated from their `Account`-payment bookings (with optional markup) — distinct from the FlowMo→tenant Stripe billing. Gated by the `account_invoicing` entitlement.

**Architecture:** Migration 0026 adds `account_customers` (corporate accounts a tenant bills), `tenant_invoices` (invoices the tenant issues to those accounts), a nullable `bookings.account_customer_id` + `bookings.payment_status`, and a global `commission_rates` table (FlowMo's cut, admin-set). A pure function computes an invoice (line items + subtotal + markup + total) from a set of bookings. A service handles account-customer CRUD, invoice generation (aggregate a period's account bookings), listing, and marking paid. Tenant API routes (gated by `requireFeature("account_invoicing")` + `blockIfDemo`) expose accounts, invoice generation, and status changes. A tenant dashboard "Invoicing" page surfaces it, shown only when entitled.

**Tech Stack:** Supabase Postgres (RLS), TypeScript, Next.js App Router, Vitest. Builds on Epic 13 (`requireFeature`), Epic 9 (`blockIfDemo`), bookings (0003, `payment_method`/`fare`/`currency`).

**Dependencies:** Epic 13 (`account_invoicing` in catalog), Epic 9 (`blockIfDemo`), bookings schema. Mirrors the established epic structure.

---

## File Map

### New — Database
- `supabase/migrations/0026_account_invoicing.sql` — `account_customers`, `tenant_invoices`, `commission_rates` + `bookings.account_customer_id`/`payment_status`

### New — Core library (`src/lib/invoicing/`)
- `src/lib/invoicing/compute.ts` — pure `computeInvoice(bookings, markupPct)` → `{ lineItems, subtotal, markup, total }`
- `src/lib/invoicing/service.ts` — account CRUD + `generateInvoice`, `listInvoices`, `setInvoiceStatus`

### New — Tenant API
- `src/app/api/orgs/[orgId]/invoicing/accounts/route.ts` — GET list, POST create
- `src/app/api/orgs/[orgId]/invoicing/accounts/[accountId]/route.ts` — PATCH (edit), DELETE
- `src/app/api/orgs/[orgId]/invoicing/generate/route.ts` — POST generate invoice for an account+period
- `src/app/api/orgs/[orgId]/invoicing/[invoiceId]/route.ts` — PATCH set status

### New — Tenant UI
- `src/app/dashboard/invoicing/page.tsx` — accounts + invoices (gated)
- `src/app/dashboard/invoicing/invoicing-client.tsx`

### Modified
- `src/app/dashboard/layout.tsx` — compute `showInvoicing = hasFeature(tenant_id, "account_invoicing")`, pass to shell
- `src/components/dashboard/dashboard-shell.tsx` — conditional "Invoicing" nav entry

### Test files
- `tests/invoicing-migration.test.ts` — 0026 structure
- `tests/invoicing-compute.test.ts` — pure invoice computation
- `tests/invoicing-routes.test.ts` — generate route gating (demo + entitlement)

---

## Task 1: Migration 0026 — accounts, invoices, commission

**Files:** Create `supabase/migrations/0026_account_invoicing.sql`; Test `tests/invoicing-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/invoicing-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0026_account_invoicing.sql"), "utf8");

describe("0026 account invoicing migration", () => {
  it("creates account_customers, tenant_invoices, commission_rates", () => {
    expect(sql).toMatch(/create table public\.account_customers/i);
    expect(sql).toMatch(/create table public\.tenant_invoices/i);
    expect(sql).toMatch(/create table public\.commission_rates/i);
  });
  it("adds account_customer_id + payment_status to bookings", () => {
    expect(sql).toMatch(/alter table public\.bookings add column account_customer_id uuid/i);
    expect(sql).toMatch(/alter table public\.bookings add column payment_status text/i);
  });
  it("tenant_invoices has a status check incl. draft + paid", () => {
    expect(sql).toMatch(/status .*check .*draft/i);
    expect(sql).toMatch(/paid/i);
  });
  it("enables RLS + tenant policies on accounts + invoices", () => {
    expect(sql).toMatch(/alter table public\.account_customers enable row level security/i);
    expect(sql).toMatch(/alter table public\.tenant_invoices enable row level security/i);
    expect(sql).toMatch(/account_customers_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/tenant_invoices_insert/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/invoicing-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0026_account_invoicing.sql`**

```sql
-- 0026: Account invoicing & finance.
--
-- account_customers are corporate accounts a TENANT bills (distinct from the
-- FlowMo→tenant Stripe subscription). tenant_invoices are the invoices the
-- tenant issues to those accounts. commission_rates is FlowMo's cut (global).

create table public.account_customers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  billing_email text,
  credit_terms  integer not null default 30,
  markup_pct    numeric(5,2) not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index account_customers_tenant_idx on public.account_customers (tenant_id);

create table public.tenant_invoices (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  account_customer_id uuid not null references public.account_customers(id) on delete cascade,
  period_start       date not null,
  period_end         date not null,
  line_items         jsonb not null default '[]'::jsonb,
  subtotal           numeric(12,2) not null default 0,
  markup             numeric(12,2) not null default 0,
  total              numeric(12,2) not null default 0,
  currency           text not null default 'GBP',
  status             text not null default 'draft' check (status in ('draft','issued','paid','void')),
  issued_at          timestamptz,
  created_at         timestamptz not null default now()
);
create index tenant_invoices_tenant_idx on public.tenant_invoices (tenant_id, created_at);

create table public.commission_rates (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  pct            numeric(5,2) not null,
  effective_from date not null default current_date
);

alter table public.bookings add column account_customer_id uuid references public.account_customers(id) on delete set null;
alter table public.bookings add column payment_status text;

-- RLS ----------------------------------------------------------------------
alter table public.account_customers enable row level security;
alter table public.tenant_invoices enable row level security;
alter table public.commission_rates enable row level security;

create policy account_customers_select on public.account_customers
  for select using (tenant_id in (select public.current_user_tenants()));
create policy account_customers_insert on public.account_customers
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy account_customers_update on public.account_customers
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy account_customers_delete on public.account_customers
  for delete using (tenant_id in (select public.current_user_tenants()));

create policy tenant_invoices_select on public.tenant_invoices
  for select using (tenant_id in (select public.current_user_tenants()));
create policy tenant_invoices_insert on public.tenant_invoices
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy tenant_invoices_update on public.tenant_invoices
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));

-- commission_rates: tenant may read its own (FlowMo's cut is visible); writes service_role.
create policy commission_rates_select on public.commission_rates
  for select using (tenant_id in (select public.current_user_tenants()));
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/invoicing-migration.test.ts`
Expected: applied; 4 tests PASS. (If `db push` replays a prior migration, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0026_account_invoicing.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0026_account_invoicing.sql tests/invoicing-migration.test.ts
git commit -m "feat(invoicing): migration 0026 — account customers, invoices, commission"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure invoice computation

**Files:** Create `src/lib/invoicing/compute.ts`; Test `tests/invoicing-compute.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/invoicing-compute.test.ts
import { describe, it, expect } from "vitest";
import { computeInvoice, type InvoiceBooking } from "@/lib/invoicing/compute";

const bookings: InvoiceBooking[] = [
  { id: "b1", passenger_name: "Sam", fare: 20, created_at: "2026-05-02T10:00:00Z" },
  { id: "b2", passenger_name: "Lee", fare: 35.5, created_at: "2026-05-10T10:00:00Z" },
  { id: "b3", passenger_name: null, fare: null, created_at: "2026-05-12T10:00:00Z" },
];

describe("computeInvoice", () => {
  it("creates one line item per booking and sums the subtotal", () => {
    const inv = computeInvoice(bookings, 0);
    expect(inv.lineItems).toHaveLength(3);
    expect(inv.subtotal).toBe(55.5);
  });
  it("applies markup percentage to the subtotal", () => {
    const inv = computeInvoice(bookings, 10);
    expect(inv.markup).toBe(5.55);
    expect(inv.total).toBe(61.05);
  });
  it("zero markup yields total == subtotal", () => {
    const inv = computeInvoice(bookings, 0);
    expect(inv.total).toBe(55.5);
  });
  it("treats null fares as 0", () => {
    const inv = computeInvoice([{ id: "x", passenger_name: null, fare: null, created_at: "2026-05-01T00:00:00Z" }], 20);
    expect(inv.subtotal).toBe(0);
    expect(inv.total).toBe(0);
  });
  it("rounds money to 2dp", () => {
    const inv = computeInvoice([{ id: "x", passenger_name: "A", fare: 33.333, created_at: "2026-05-01T00:00:00Z" }], 7.5);
    expect(inv.markup).toBe(2.5);
    expect(inv.total).toBe(35.83);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/invoicing-compute.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/invoicing/compute.ts`**

```typescript
export interface InvoiceBooking {
  id: string;
  passenger_name: string | null;
  fare: number | null;
  created_at: string;
}

export interface InvoiceLineItem {
  bookingId: string;
  description: string;
  date: string;
  amount: number;
}

export interface ComputedInvoice {
  lineItems: InvoiceLineItem[];
  subtotal: number;
  markup: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pure: build invoice line items from bookings and apply a markup percentage.
 * One line per booking; null fares count as 0.
 */
export function computeInvoice(bookings: InvoiceBooking[], markupPct: number): ComputedInvoice {
  const lineItems: InvoiceLineItem[] = bookings.map((b) => ({
    bookingId: b.id,
    description: `Journey — ${b.passenger_name ?? "passenger"}`,
    date: b.created_at.slice(0, 10),
    amount: round2(b.fare ?? 0),
  }));
  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.amount, 0));
  const markup = round2(subtotal * (markupPct / 100));
  const total = round2(subtotal + markup);
  return { lineItems, subtotal, markup, total };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/invoicing-compute.test.ts` — Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoicing/compute.ts tests/invoicing-compute.test.ts
git commit -m "feat(invoicing): pure invoice computation (line items + markup)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Invoicing service

**Files:** Create `src/lib/invoicing/service.ts`

- [ ] **Step 1: Create `src/lib/invoicing/service.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { computeInvoice, type InvoiceBooking } from "./compute";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface AccountRow { id: string; name: string; billing_email: string | null; credit_terms: number; markup_pct: number; active: boolean }
export interface InvoiceRow { id: string; account_customer_id: string; period_start: string; period_end: string; subtotal: number; markup: number; total: number; currency: string; status: string; issued_at: string | null; created_at: string }

export async function listAccounts(tenantId: string): Promise<AccountRow[]> {
  const { data } = await svc().from("account_customers").select("id, name, billing_email, credit_terms, markup_pct, active").eq("tenant_id", tenantId).order("name");
  return (data ?? []) as AccountRow[];
}

export async function createAccount(tenantId: string, input: { name: string; billingEmail?: string; creditTerms?: number; markupPct?: number }): Promise<void> {
  await svc().from("account_customers").insert({
    tenant_id: tenantId, name: input.name, billing_email: input.billingEmail ?? null,
    credit_terms: input.creditTerms ?? 30, markup_pct: input.markupPct ?? 0,
  });
}

export async function updateAccount(tenantId: string, accountId: string, patch: { name?: string; billingEmail?: string | null; creditTerms?: number; markupPct?: number; active?: boolean }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.billingEmail !== undefined) update.billing_email = patch.billingEmail;
  if (patch.creditTerms !== undefined) update.credit_terms = patch.creditTerms;
  if (patch.markupPct !== undefined) update.markup_pct = patch.markupPct;
  if (patch.active !== undefined) update.active = patch.active;
  await svc().from("account_customers").update(update).eq("tenant_id", tenantId).eq("id", accountId);
}

export async function deleteAccount(tenantId: string, accountId: string): Promise<void> {
  await svc().from("account_customers").delete().eq("tenant_id", tenantId).eq("id", accountId);
}

export async function listInvoices(tenantId: string): Promise<InvoiceRow[]> {
  const { data } = await svc().from("tenant_invoices").select("id, account_customer_id, period_start, period_end, subtotal, markup, total, currency, status, issued_at, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as InvoiceRow[];
}

/**
 * Generate a draft invoice for an account over [periodStart, periodEnd]:
 * aggregate that account's bookings in the window, apply its markup, persist.
 * Returns the new invoice id (or null when there are no bookings).
 */
export async function generateInvoice(tenantId: string, accountId: string, periodStart: string, periodEnd: string): Promise<{ id: string | null; total: number }> {
  const sb = svc();
  const { data: account } = await sb.from("account_customers").select("markup_pct").eq("tenant_id", tenantId).eq("id", accountId).maybeSingle();
  if (!account) return { id: null, total: 0 };
  const markupPct = Number(account.markup_pct ?? 0);

  const { data: bookings } = await sb
    .from("bookings")
    .select("id, passenger_name, fare, created_at, currency")
    .eq("tenant_id", tenantId)
    .eq("account_customer_id", accountId)
    .gte("created_at", `${periodStart}T00:00:00Z`)
    .lte("created_at", `${periodEnd}T23:59:59Z`);
  const rows = (bookings ?? []) as (InvoiceBooking & { currency: string | null })[];
  if (rows.length === 0) return { id: null, total: 0 };

  const computed = computeInvoice(rows, markupPct);
  const currency = rows[0].currency ?? "GBP";
  const { data: inserted } = await sb.from("tenant_invoices").insert({
    tenant_id: tenantId, account_customer_id: accountId, period_start: periodStart, period_end: periodEnd,
    line_items: computed.lineItems, subtotal: computed.subtotal, markup: computed.markup, total: computed.total,
    currency, status: "draft",
  }).select("id").single();
  return { id: (inserted?.id as string) ?? null, total: computed.total };
}

export async function setInvoiceStatus(tenantId: string, invoiceId: string, status: "issued" | "paid" | "void"): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "issued") patch.issued_at = new Date().toISOString();
  await svc().from("tenant_invoices").update(patch).eq("tenant_id", tenantId).eq("id", invoiceId);
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/invoicing/service.ts
git commit -m "feat(invoicing): account CRUD + invoice generation/status service"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Tenant API routes (gated)

**Files:** Create the four route files; Test `tests/invoicing-routes.test.ts`

- [ ] **Step 1: Write the failing test (generate route gating)**

```typescript
// tests/invoicing-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/invoicing/service", () => ({ generateInvoice: vi.fn(async () => ({ id: "inv1", total: 100 })) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { generateInvoice } from "@/lib/invoicing/service";
import { POST } from "@/app/api/orgs/[orgId]/invoicing/generate/route";

const ctx = { params: Promise.resolve({ orgId: "t1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }
const body = { accountId: "a1", periodStart: "2026-05-01", periodEnd: "2026-05-31" };

describe("POST generate invoice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates when entitled + not demo", async () => {
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(200);
    expect(generateInvoice).toHaveBeenCalledWith("t1", "a1", "2026-05-01", "2026-05-31");
  });
  it("400 when fields missing", async () => {
    const res = await POST(req({ accountId: "a1" }), ctx);
    expect(res.status).toBe(400);
    expect(generateInvoice).not.toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(403);
    expect(generateInvoice).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(403);
    expect(generateInvoice).not.toHaveBeenCalled();
  });
  it("422 when no bookings in the period", async () => {
    vi.mocked(generateInvoice).mockResolvedValueOnce({ id: null, total: 0 });
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/invoicing-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/invoicing/accounts/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listAccounts, createAccount } from "@/lib/invoicing/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return feat;
  return NextResponse.json({ accounts: await listAccounts(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Account name is required." }, { status: 400 });
  await createAccount(orgId, {
    name, billingEmail: typeof b.billingEmail === "string" ? b.billingEmail : undefined,
    creditTerms: Number(b.creditTerms) || undefined, markupPct: Number(b.markupPct) || 0,
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create `src/app/api/orgs/[orgId]/invoicing/accounts/[accountId]/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { updateAccount, deleteAccount } from "@/lib/invoicing/service";

export const runtime = "nodejs";

async function gateAll(orgId: string) {
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return { res: gate as NextResponse };
  const demo = blockIfDemo(gate.claims);
  if (demo) return { res: demo };
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return { res: feat };
  return { res: null };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string; accountId: string }> }) {
  const { orgId, accountId } = await params;
  const { res } = await gateAll(orgId);
  if (res) return res;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await updateAccount(orgId, accountId, {
    name: typeof b.name === "string" ? b.name : undefined,
    billingEmail: typeof b.billingEmail === "string" ? b.billingEmail : undefined,
    creditTerms: typeof b.creditTerms === "number" ? b.creditTerms : undefined,
    markupPct: typeof b.markupPct === "number" ? b.markupPct : undefined,
    active: typeof b.active === "boolean" ? b.active : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; accountId: string }> }) {
  const { orgId, accountId } = await params;
  const { res } = await gateAll(orgId);
  if (res) return res;
  await deleteAccount(orgId, accountId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create `src/app/api/orgs/[orgId]/invoicing/generate/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { generateInvoice } from "@/lib/invoicing/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const accountId = String(b.accountId ?? "");
  const periodStart = String(b.periodStart ?? "");
  const periodEnd = String(b.periodEnd ?? "");
  if (!accountId || !periodStart || !periodEnd) return NextResponse.json({ error: "accountId, periodStart and periodEnd are required." }, { status: 400 });
  const result = await generateInvoice(orgId, accountId, periodStart, periodEnd);
  if (!result.id) return NextResponse.json({ error: "No account bookings in that period." }, { status: 422 });
  return NextResponse.json({ ok: true, invoiceId: result.id, total: result.total });
}
```

- [ ] **Step 6: Create `src/app/api/orgs/[orgId]/invoicing/[invoiceId]/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { setInvoiceStatus } from "@/lib/invoicing/service";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string; invoiceId: string }> }) {
  const { orgId, invoiceId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "account_invoicing");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(b.status ?? "");
  if (!["issued", "paid", "void"].includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  await setInvoiceStatus(orgId, invoiceId, status as "issued" | "paid" | "void");
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Run routes test + typecheck**

Run: `npx vitest run tests/invoicing-routes.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests); no type errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/orgs/[orgId]/invoicing" tests/invoicing-routes.test.ts
git commit -m "feat(invoicing): tenant API — accounts CRUD, generate, status (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Tenant Invoicing page (gated) + nav

**Files:** Create `src/app/dashboard/invoicing/page.tsx`, `src/app/dashboard/invoicing/invoicing-client.tsx`; Modify `src/app/dashboard/layout.tsx`, `src/components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Create `src/app/dashboard/invoicing/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listAccounts, listInvoices } from "@/lib/invoicing/service";
import { InvoicingClient } from "./invoicing-client";

export const metadata = { title: "Invoicing — CabbyBot" };

export default async function InvoicingPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "account_invoicing"))) redirect("/dashboard");
  const [accounts, invoices] = await Promise.all([listAccounts(claims.tenant_id), listInvoices(claims.tenant_id)]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Account invoicing</h1>
      <p className="mb-4 text-sm text-slate-500">Bill your corporate accounts for their account-paid journeys.</p>
      <InvoicingClient orgId={claims.tenant_id} accounts={accounts} invoices={invoices} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/invoicing/invoicing-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Account { id: string; name: string; billing_email: string | null; credit_terms: number; markup_pct: number; active: boolean }
interface Invoice { id: string; account_customer_id: string; period_start: string; period_end: string; subtotal: number; markup: number; total: number; currency: string; status: string }

export function InvoicingClient(props: { orgId: string; accounts: Account[]; invoices: Invoice[]; isDemo: boolean }) {
  const router = useRouter();
  const base = `/api/orgs/${props.orgId}/invoicing`;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nameById = new Map(props.accounts.map((a) => [a.id, a.name]));

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
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Accounts</h2>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {props.accounts.length === 0 && <li className="py-2 text-slate-400">No accounts yet.</li>}
          {props.accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{a.name} <span className="text-xs text-slate-400">· {a.markup_pct}% markup · {a.credit_terms}d</span></span>
              {!props.isDemo && (
                <GenerateForm onSubmit={(ps, pe) => call(`${base}/generate`, "POST", { accountId: a.id, periodStart: ps, periodEnd: pe })} busy={busy} />
              )}
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form
            onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void call(`${base}/accounts`, "POST", { name: f.get("name"), billingEmail: f.get("billingEmail"), markupPct: Number(f.get("markupPct")) }); e.currentTarget.reset(); }}
            className="flex flex-wrap gap-2"
          >
            <input name="name" required placeholder="Account name" className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
            <input name="billingEmail" type="email" placeholder="billing@…" className="rounded border border-slate-300 px-2 py-1 text-sm" />
            <input name="markupPct" type="number" step="0.1" defaultValue="0" className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Add account</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Invoices</h2>
        {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50"><tr>{["Account", "Period", "Total", "Status", ""].map((h) => <th key={h} className="px-2 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {props.invoices.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-400">No invoices yet.</td></tr>}
            {props.invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="px-2 py-2 text-slate-800">{nameById.get(inv.account_customer_id) ?? "—"}</td>
                <td className="px-2 py-2 text-slate-500">{inv.period_start} → {inv.period_end}</td>
                <td className="px-2 py-2 text-slate-700">£{Number(inv.total).toFixed(2)}</td>
                <td className="px-2 py-2"><span className={inv.status === "paid" ? "text-emerald-600" : inv.status === "issued" ? "text-blue-700" : inv.status === "void" ? "text-slate-400" : "text-amber-600"}>{inv.status}</span></td>
                <td className="px-2 py-2 text-right">
                  {!props.isDemo && inv.status !== "paid" && inv.status !== "void" && (
                    <span className="flex justify-end gap-1">
                      {inv.status === "draft" && <button disabled={busy} onClick={() => call(`${base}/${inv.id}`, "PATCH", { status: "issued" })} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Issue</button>}
                      <button disabled={busy} onClick={() => call(`${base}/${inv.id}`, "PATCH", { status: "paid" })} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Mark paid</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function GenerateForm({ onSubmit, busy }: { onSubmit: (periodStart: string, periodEnd: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Invoice…</button>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSubmit(String(f.get("ps")), String(f.get("pe"))); setOpen(false); }} className="flex items-center gap-1">
      <input name="ps" type="date" required className="rounded border border-slate-300 px-1 py-0.5 text-xs" />
      <input name="pe" type="date" required className="rounded border border-slate-300 px-1 py-0.5 text-xs" />
      <button disabled={busy} type="submit" className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white">Go</button>
    </form>
  );
}
```

- [ ] **Step 3: Gate the nav — modify `src/app/dashboard/layout.tsx`**

Read the file. It already computes several `show*` flags via `hasFeature`. Add `const showInvoicing = claims.tenant_id ? await hasFeature(claims.tenant_id, "account_invoicing") : false;` and pass `showInvoicing={showInvoicing}` to `<DashboardShell>`. Reuse existing imports; no second auth call.

- [ ] **Step 4: Modify `src/components/dashboard/dashboard-shell.tsx`**

Read it. Add a `showInvoicing?: boolean` prop and extend `NAV_ITEMS` with `...(showInvoicing ? [{ label: "Invoicing", href: "/dashboard/invoicing" }] : [])`. Match the exact `{ label, href }` shape.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/dashboard/invoicing`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/invoicing src/app/dashboard/layout.tsx src/components/dashboard/dashboard-shell.tsx
git commit -m "feat(invoicing): invoicing dashboard page + entitlement-gated nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Integration gate

- [ ] **Step 1: Run the invoicing test set**

Run: `npx vitest run tests/invoicing-migration.test.ts tests/invoicing-compute.test.ts tests/invoicing-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(invoicing): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Account customers (corporate accounts) CRUD | Tasks 1, 3, 4, 5 |
| Invoice generation from account bookings + markup | Tasks 2, 3, 4 |
| Invoice listing + status (draft→issued→paid/void) | Tasks 1, 3, 4, 5 |
| `bookings.account_customer_id` + `payment_status` link | Task 1 |
| Commission rates (FlowMo cut) table | Task 1 |
| Entitlement gate (`account_invoicing`) on every surface | Tasks 4, 5 |
| Demo write-block | Task 4 |

**Placeholder scan:** none.

**Type consistency:** `InvoiceBooking`/`ComputedInvoice` (compute.ts) used by service.ts. `AccountRow`/`InvoiceRow` in service.ts used by routes + page. `generateInvoice` returns `{ id, total }`; route maps `!id` → 422. `requireFeature(tenantId, "account_invoicing")` matches Epic 13.

**Known limitations (documented):** bookings are linked to an account via `account_customer_id`, which staff/automation must set (auto-matching `payment_method='Account'` bookings to an account by name/handle is a follow-up — until then the invoice aggregates only explicitly-linked bookings); PDF rendering (`pdf_ref`) is deferred (the invoice is data-complete; the Document Generator integration is a fast-follow); commission_rates table is created + readable but the FlowMo-side admin editor + reporting are deferred to the governance epic; no double-invoicing guard yet (re-generating a period creates a second draft — a uniqueness/supersede rule is a follow-up).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-epic-20-account-invoicing.md`.

**6 tasks. Task 1 (schema) gates all; Task 2 (pure) independent; Task 3 depends on 1–2; Task 4 depends on 3; Task 5 depends on 3; Task 6 last.**
