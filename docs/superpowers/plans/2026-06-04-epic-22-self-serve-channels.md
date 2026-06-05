# Epic 22: Self-serve Channels — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tenants request/connect new channels themselves (instead of being purely admin-provisioned), entering a `pending_review` state that FlowMo staff approve or reject. Gated by the `self_serve_channels` entitlement.

**Architecture:** Migration 0028 adds provenance + provisioning state to `channels` (`created_by`, `provisioning_status`, `is_self_serve`) and a global `platform_apps` table (FlowMo-owned WhatsApp BSP/Meta app config). A pure layer validates a channel request and governs the provisioning state machine (pending_review → approved | rejected). A service handles self-serve requests (creating a `pending_review` channel bound to an automation), tenant channel listing, the admin review queue, and approve/reject. Tenant API routes (gated by `requireFeature("self_serve_channels")` + `blockIfDemo`) expose request + list; an admin API + page handle the review queue. A tenant dashboard "Connect channel" surface shows request + status, only when entitled.

**Tech Stack:** Supabase Postgres (RLS — additive columns under existing channel policies; new global table), TypeScript, Next.js App Router, Vitest. Builds on Epic 13 (`requireFeature`), Epic 9 (`blockIfDemo`), Epic 3 (admin shell), channels (0002).

**Dependencies:** Epic 13 (`self_serve_channels` in catalog), Epic 9 (`blockIfDemo`), Epic 3 (`requireStaff`/admin shell), channels/automations schema. Mirrors the established epic structure.

---

## File Map

### New — Database
- `supabase/migrations/0028_self_serve_channels.sql` — channels provisioning columns + `platform_apps`

### New — Core library (`src/lib/channels/`)
- `src/lib/channels/provision.ts` — pure `validateChannelRequest(input)` + `nextProvisioningState(current, action)`
- `src/lib/channels/service.ts` — `requestChannel`, `listTenantChannels`, `listPendingChannels`, `setProvisioning`

### New — Tenant API
- `src/app/api/orgs/[orgId]/channels/request/route.ts` — POST request a channel
- `src/app/api/orgs/[orgId]/channels/list/route.ts` — GET tenant channels (with provisioning state)

### New — Admin API + page
- `src/app/admin/channel-review/page.tsx` — pending self-serve channel queue
- `src/app/admin/channel-review/actions.ts` — server actions: approveChannelAction / rejectChannelAction (requireStaff)

### New — Tenant UI
- `src/app/dashboard/connect/page.tsx` — request channel + status (gated)
- `src/app/dashboard/connect/connect-client.tsx`

### Modified
- `src/app/dashboard/layout.tsx` — compute `showConnect = hasFeature(tenant_id, "self_serve_channels")`, pass to shell
- `src/components/dashboard/dashboard-shell.tsx` — conditional "Connect" nav entry
- `src/components/admin/admin-shell.tsx` — add "Channel review" nav

### Test files
- `tests/channels-provision.test.ts` — pure validation + state transitions
- `tests/channels-migration.test.ts` — 0028 structure
- `tests/channels-routes.test.ts` — request route gating (demo + entitlement)

---

## Task 1: Migration 0028 — channel provisioning + platform apps

**Files:** Create `supabase/migrations/0028_self_serve_channels.sql`; Test `tests/channels-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/channels-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0028_self_serve_channels.sql"), "utf8");

describe("0028 self-serve channels migration", () => {
  it("adds provisioning columns to channels", () => {
    expect(sql).toMatch(/alter table public\.channels add column created_by uuid/i);
    expect(sql).toMatch(/alter table public\.channels add column provisioning_status text/i);
    expect(sql).toMatch(/alter table public\.channels add column is_self_serve boolean/i);
  });
  it("provisioning_status defaults to approved with a check constraint", () => {
    expect(sql).toMatch(/provisioning_status text .*default 'approved'/i);
    expect(sql).toMatch(/check .*'pending_review'.*'approved'.*'rejected'/i);
  });
  it("creates platform_apps (global)", () => {
    expect(sql).toMatch(/create table public\.platform_apps/i);
    expect(sql).toMatch(/alter table public\.platform_apps enable row level security/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/channels-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0028_self_serve_channels.sql`**

```sql
-- 0028: Self-serve channels.
--
-- Additive provisioning state on channels (existing 0005 RLS covers reads/writes
-- by tenant). Existing channels default to 'approved' so nothing breaks.
-- platform_apps is a global FlowMo-owned table (WhatsApp BSP / Meta app config).

alter table public.channels add column created_by uuid references public.users(id) on delete set null;
alter table public.channels add column provisioning_status text not null default 'approved' check (provisioning_status in ('pending_review','approved','rejected'));
alter table public.channels add column is_self_serve boolean not null default false;
create index channels_provisioning_idx on public.channels (provisioning_status);

create table public.platform_apps (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null,
  identifier    text not null,
  credentials_ref text,
  status        text not null default 'active' check (status in ('active','disabled')),
  created_at    timestamptz not null default now()
);

-- platform_apps is global FlowMo config: service_role only (RLS on, no policy).
alter table public.platform_apps enable row level security;
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/channels-migration.test.ts`
Expected: applied; 3 tests PASS. (If `db push` replays a prior migration, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0028_self_serve_channels.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0028_self_serve_channels.sql tests/channels-migration.test.ts
git commit -m "feat(channels): migration 0028 — provisioning state + platform apps"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure validation + provisioning state machine

**Files:** Create `src/lib/channels/provision.ts`; Test `tests/channels-provision.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/channels-provision.test.ts
import { describe, it, expect } from "vitest";
import { validateChannelRequest, nextProvisioningState, type ProvisioningStatus } from "@/lib/channels/provision";

describe("validateChannelRequest", () => {
  it("accepts a valid whatsapp request", () => {
    const r = validateChannelRequest({ type: "whatsapp", externalId: "+44 7700 900000", automationId: "a1" });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it("rejects an unknown channel type", () => {
    const r = validateChannelRequest({ type: "carrier-pigeon", externalId: "x", automationId: "a1" });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("type");
  });
  it("requires externalId and automationId", () => {
    const r = validateChannelRequest({ type: "telegram", externalId: "", automationId: "" });
    expect(r.errors).toContain("externalId");
    expect(r.errors).toContain("automationId");
  });
});

describe("nextProvisioningState", () => {
  it("approve moves pending_review → approved", () => {
    expect(nextProvisioningState("pending_review", "approve")).toBe("approved");
  });
  it("reject moves pending_review → rejected", () => {
    expect(nextProvisioningState("pending_review", "reject")).toBe("rejected");
  });
  it("is a no-op for already-decided channels", () => {
    const states: ProvisioningStatus[] = ["approved", "rejected"];
    for (const s of states) {
      expect(nextProvisioningState(s, "approve")).toBe(s);
      expect(nextProvisioningState(s, "reject")).toBe(s);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/channels-provision.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/channels/provision.ts`**

```typescript
export type ProvisioningStatus = "pending_review" | "approved" | "rejected";
export type ProvisioningAction = "approve" | "reject";

const CHANNEL_TYPES = ["whatsapp", "telegram", "messenger", "instagram", "widget"];

export interface ChannelRequest {
  type: string;
  externalId: string;
  automationId: string;
}

/** Pure: validate a self-serve channel request. Returns field names that failed. */
export function validateChannelRequest(input: ChannelRequest): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!CHANNEL_TYPES.includes(input.type)) errors.push("type");
  if (!input.externalId || !input.externalId.trim()) errors.push("externalId");
  if (!input.automationId || !input.automationId.trim()) errors.push("automationId");
  return { ok: errors.length === 0, errors };
}

/** Pure: provisioning state machine. Only a pending_review channel can transition. */
export function nextProvisioningState(current: ProvisioningStatus, action: ProvisioningAction): ProvisioningStatus {
  if (current !== "pending_review") return current;
  return action === "approve" ? "approved" : "rejected";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/channels-provision.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/provision.ts tests/channels-provision.test.ts
git commit -m "feat(channels): pure request validation + provisioning state machine"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Channel provisioning service

**Files:** Create `src/lib/channels/service.ts`

- [ ] **Step 1: Create `src/lib/channels/service.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { validateChannelRequest, nextProvisioningState, type ProvisioningStatus, type ProvisioningAction } from "./provision";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface TenantChannelRow {
  id: string; type: string; external_id: string | null; status: string;
  provisioning_status: string; is_self_serve: boolean; automation_id: string; created_at: string;
}
export interface PendingChannelRow extends TenantChannelRow { tenant_id: string }

/**
 * Self-serve channel request: validates, confirms the automation belongs to the
 * tenant, then inserts a pending_review channel. Returns the new id or errors.
 */
export async function requestChannel(args: { tenantId: string; type: string; externalId: string; automationId: string; createdBy: string }): Promise<{ ok: boolean; id?: string; errors?: string[] }> {
  const v = validateChannelRequest({ type: args.type, externalId: args.externalId, automationId: args.automationId });
  if (!v.ok) return { ok: false, errors: v.errors };
  const sb = svc();
  const { data: automation } = await sb.from("automations").select("id").eq("tenant_id", args.tenantId).eq("id", args.automationId).maybeSingle();
  if (!automation) return { ok: false, errors: ["automationId"] };

  const { data, error } = await sb.from("channels").insert({
    tenant_id: args.tenantId, automation_id: args.automationId, type: args.type, external_id: args.externalId,
    webhook_path: `/webhooks/${args.type}/${args.automationId}`, status: "disconnected",
    provisioning_status: "pending_review", is_self_serve: true, created_by: args.createdBy,
  }).select("id").single();
  if (error) return { ok: false, errors: ["insert"] };
  return { ok: true, id: data?.id as string };
}

export async function listTenantChannels(tenantId: string): Promise<TenantChannelRow[]> {
  const { data } = await svc().from("channels").select("id, type, external_id, status, provisioning_status, is_self_serve, automation_id, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as TenantChannelRow[];
}

export async function listPendingChannels(): Promise<PendingChannelRow[]> {
  const { data } = await svc().from("channels").select("id, tenant_id, type, external_id, status, provisioning_status, is_self_serve, automation_id, created_at").eq("provisioning_status", "pending_review").order("created_at");
  return (data ?? []) as PendingChannelRow[];
}

/** Admin approve/reject: transitions a pending channel; approval also marks it active. */
export async function setProvisioning(channelId: string, action: ProvisioningAction): Promise<{ ok: boolean; status?: ProvisioningStatus }> {
  const sb = svc();
  const { data: ch } = await sb.from("channels").select("provisioning_status").eq("id", channelId).maybeSingle();
  if (!ch) return { ok: false };
  const current = (ch.provisioning_status as ProvisioningStatus) ?? "pending_review";
  const next = nextProvisioningState(current, action);
  const patch: Record<string, unknown> = { provisioning_status: next };
  if (next === "approved") patch.status = "active";
  if (next === "rejected") patch.status = "disconnected";
  await sb.from("channels").update(patch).eq("id", channelId);
  return { ok: true, status: next };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/channels/service.ts
git commit -m "feat(channels): self-serve request + admin approve/reject service"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Tenant API routes (gated)

**Files:** Create the two route files; Test `tests/channels-routes.test.ts`

- [ ] **Step 1: Write the failing test (request route gating)**

```typescript
// tests/channels-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/channels/service", () => ({ requestChannel: vi.fn(async () => ({ ok: true, id: "c1" })) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requestChannel } from "@/lib/channels/service";
import { POST } from "@/app/api/orgs/[orgId]/channels/request/route";

const ctx = { params: Promise.resolve({ orgId: "t1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }
const body = { type: "whatsapp", externalId: "+44 7700 900000", automationId: "a1" };

describe("POST request channel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests when entitled + not demo", async () => {
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(200);
    expect(requestChannel).toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(403);
    expect(requestChannel).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(403);
    expect(requestChannel).not.toHaveBeenCalled();
  });
  it("422 with field errors when invalid", async () => {
    vi.mocked(requestChannel).mockResolvedValueOnce({ ok: false, errors: ["type"] });
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(422);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/channels-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/channels/request/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { requestChannel } from "@/lib/channels/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "self_serve_channels");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await requestChannel({
    tenantId: orgId, type: String(b.type ?? ""), externalId: String(b.externalId ?? ""),
    automationId: String(b.automationId ?? ""), createdBy: gate.claims.sub,
  });
  if (!result.ok) return NextResponse.json({ error: "Invalid channel request.", fields: result.errors ?? [] }, { status: 422 });
  return NextResponse.json({ ok: true, id: result.id });
}
```

- [ ] **Step 4: Create `src/app/api/orgs/[orgId]/channels/list/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { requireFeature } from "@/lib/entitlements/guard";
import { listTenantChannels } from "@/lib/channels/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "self_serve_channels");
  if (feat) return feat;
  return NextResponse.json({ channels: await listTenantChannels(orgId) });
}
```

- [ ] **Step 5: Run routes test + typecheck**

Run: `npx vitest run tests/channels-routes.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests); no type errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/orgs/[orgId]/channels" tests/channels-routes.test.ts
git commit -m "feat(channels): tenant API — request + list self-serve channels (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Admin review queue + tenant Connect page + nav

**Files:** Create `src/app/admin/channel-review/page.tsx`, `src/app/admin/channel-review/actions.ts`, `src/app/dashboard/connect/page.tsx`, `src/app/dashboard/connect/connect-client.tsx`; Modify `src/app/dashboard/layout.tsx`, `src/components/dashboard/dashboard-shell.tsx`, `src/components/admin/admin-shell.tsx`

- [ ] **Step 1: Create `src/app/admin/channel-review/actions.ts`**

```typescript
"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setProvisioning } from "@/lib/channels/service";
import { revalidatePath } from "next/cache";

export async function approveChannelAction(formData: FormData): Promise<void> {
  await requireStaff();
  await setProvisioning(String(formData.get("channelId")), "approve");
  revalidatePath("/admin/channel-review");
}

export async function rejectChannelAction(formData: FormData): Promise<void> {
  await requireStaff();
  await setProvisioning(String(formData.get("channelId")), "reject");
  revalidatePath("/admin/channel-review");
}
```

- [ ] **Step 2: Create `src/app/admin/channel-review/page.tsx`**

```tsx
import { requireStaff } from "@/lib/admin/guard";
import { listPendingChannels } from "@/lib/channels/service";
import { approveChannelAction, rejectChannelAction } from "./actions";

export const metadata = { title: "Channel review — Admin" };

export default async function ChannelReviewPage() {
  await requireStaff();
  const pending = await listPendingChannels();
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Channel review</h1>
      <p className="mb-4 text-sm text-slate-500">Approve or reject tenant-requested channels.</p>
      <table className="min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{["Tenant", "Type", "Identifier", "Requested", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {pending.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No channels awaiting review.</td></tr>}
          {pending.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2 text-slate-500">{c.tenant_id.slice(0, 8)}…</td>
              <td className="px-3 py-2 capitalize text-slate-800">{c.type}</td>
              <td className="px-3 py-2 text-slate-700">{c.external_id ?? "—"}</td>
              <td className="px-3 py-2 text-slate-400">{new Date(c.created_at).toLocaleString("en-GB")}</td>
              <td className="px-3 py-2 text-right">
                <span className="flex justify-end gap-1">
                  <form action={approveChannelAction}><input type="hidden" name="channelId" value={c.id} /><button type="submit" className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Approve</button></form>
                  <form action={rejectChannelAction}><input type="hidden" name="channelId" value={c.id} /><button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Reject</button></form>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Add "Channel review" to admin nav**

In `src/components/admin/admin-shell.tsx`, add `{ label: "Channel review", href: "/admin/channel-review" }` to `NAV_ITEMS` after "Guardrails", matching the exact shape.

- [ ] **Step 4: Create `src/app/dashboard/connect/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listTenantChannels } from "@/lib/channels/service";
import { ConnectClient } from "./connect-client";

export const metadata = { title: "Connect a channel — BookMyCab" };

function svc() { return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY); }

export default async function ConnectPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "self_serve_channels"))) redirect("/dashboard");
  const [channels, { data: automations }] = await Promise.all([
    listTenantChannels(claims.tenant_id),
    svc().from("automations").select("id, name").eq("tenant_id", claims.tenant_id).order("name"),
  ]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Connect a channel</h1>
      <p className="mb-4 text-sm text-slate-500">Request a new channel; our team reviews and activates it.</p>
      <ConnectClient orgId={claims.tenant_id} channels={channels} automations={(automations ?? []) as { id: string; name: string }[]} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/dashboard/connect/connect-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Channel { id: string; type: string; external_id: string | null; status: string; provisioning_status: string; is_self_serve: boolean; automation_id: string }
interface Automation { id: string; name: string }
const TYPES = ["whatsapp", "telegram", "messenger", "instagram", "widget"];

export function ConnectClient(props: { orgId: string; channels: Channel[]; automations: Automation[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const autoName = new Map(props.automations.map((a) => [a.id, a.name]));

  async function request(form: HTMLFormElement) {
    const f = new FormData(form);
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/orgs/${props.orgId}/channels/request`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: f.get("type"), externalId: f.get("externalId"), automationId: f.get("automationId") }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setErr(typeof b.error === "string" ? `${b.error}${Array.isArray(b.fields) && b.fields.length ? ` (${b.fields.join(", ")})` : ""}` : `Failed (${res.status})`);
      else { form.reset(); router.refresh(); }
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  function badge(s: string) {
    const cls = s === "approved" ? "bg-emerald-100 text-emerald-700" : s === "pending_review" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
    return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{s.replace("_", " ")}</span>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Your channels</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {props.channels.length === 0 && <li className="py-2 text-slate-400">No channels yet.</li>}
          {props.channels.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800 capitalize">{c.type} <span className="text-xs text-slate-400">{c.external_id ?? ""} · {autoName.get(c.automation_id) ?? ""}</span></span>
              {badge(c.provisioning_status)}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Request a channel</h2>
        {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
        {props.isDemo ? <p className="text-sm text-slate-400">Disabled in demo.</p> : (
          <form onSubmit={(e) => { e.preventDefault(); void request(e.currentTarget); }} className="space-y-2">
            <select name="type" className="w-full rounded border border-slate-300 px-2 py-1 text-sm">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <input name="externalId" required placeholder="Number / handle / widget id" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
            <select name="automationId" required className="w-full rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="">Choose automation…</option>
              {props.automations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Request channel</button>
          </form>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Gate the tenant nav — modify `src/app/dashboard/layout.tsx`**

Add `const showConnect = claims.tenant_id ? await hasFeature(claims.tenant_id, "self_serve_channels") : false;` and pass `showConnect={showConnect}` to `<DashboardShell>`. Reuse existing imports; no second auth call.

- [ ] **Step 7: Modify `src/components/dashboard/dashboard-shell.tsx`**

Add a `showConnect?: boolean` prop and extend `NAV_ITEMS` with `...(showConnect ? [{ label: "Connect", href: "/dashboard/connect" }] : [])`. Match the exact `{ label, href }` shape.

- [ ] **Step 8: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/dashboard/connect` + `/admin/channel-review`.

- [ ] **Step 9: Commit**

```bash
git add src/app/admin/channel-review src/app/dashboard/connect src/app/dashboard/layout.tsx src/components/dashboard/dashboard-shell.tsx src/components/admin/admin-shell.tsx
git commit -m "feat(channels): admin review queue + tenant connect page + gated nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Integration gate

- [ ] **Step 1: Run the channels test set**

Run: `npx vitest run tests/channels-migration.test.ts tests/channels-provision.test.ts tests/channels-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(channels): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Self-serve channel request (pending_review) | Tasks 2, 3, 4, 5 |
| Channel ↔ automation binding validated | Task 3 |
| Admin review queue + approve/reject | Tasks 3, 5 |
| Provisioning state machine | Tasks 2, 3 |
| `platform_apps` global table | Task 1 |
| Entitlement gate (`self_serve_channels`) on tenant surfaces | Tasks 4, 5 |
| Demo write-block | Task 4 |
| Admin gated by `requireStaff` | Task 5 |

**Placeholder scan:** none.

**Type consistency:** `ProvisioningStatus`/`ProvisioningAction`/`ChannelRequest` (provision.ts) used by service.ts. `TenantChannelRow`/`PendingChannelRow` in service.ts used by routes + pages. `requestChannel` returns `{ ok, id?, errors? }`; route maps `!ok` → 422. `setProvisioning` returns `{ ok, status? }`. `requireFeature(..., "self_serve_channels")` matches Epic 13.

**Known limitations (documented):** approval marks the channel `active` but the actual platform wiring (provisioning the WhatsApp/Telegram webhook with the BSP/Meta app in `platform_apps`, storing `credentials_ref` in the vault) is a follow-up — v1 records the request + decision and flips status; per-plan channel-count limits are not enforced yet (`self_serve_channels` gates access; a metered limit or dedicated cap is a follow-up); `platform_apps` table is created + global but its admin editor is deferred.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-epic-22-self-serve-channels.md`.

**6 tasks. Task 1 (schema) gates all; Task 2 (pure) independent; Task 3 depends on 1–2; Task 4 depends on 3; Task 5 depends on 3; Task 6 last.**
