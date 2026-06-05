# Epic 23: Integrations & API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give tenants programmatic access — issue/revoke **API keys** (hashed, shown once) and subscribe **outbound webhooks** that receive HMAC-signed event deliveries with an append-only delivery log. Gated by the `api_access` (metered) and `outbound_webhooks` entitlements.

**Architecture:** Migration 0029 adds `api_keys` (only the SHA-256 hash + a display prefix are stored — never the raw key), `outbound_webhooks` (url + subscribed events + signing secret ref), and append-only `webhook_deliveries`. A pure crypto layer generates keys, hashes them, signs webhook payloads (HMAC-SHA256), and matches webhooks to an event. A service issues/verifies/revokes keys (metering `api_access` on verify), manages webhook subscriptions, and dispatches an event to all matching webhooks (sign → POST → record delivery). Tenant API routes (gated by `requireFeature` + `blockIfDemo`) manage keys + webhooks. A tenant dashboard "Integrations" page surfaces it, shown only when entitled.

**Tech Stack:** Supabase Postgres (RLS + immutability), Node `crypto`, TypeScript, Next.js App Router, Vitest. Builds on Epic 13 (`requireFeature`/`recordUsage`), Epic 9 (`blockIfDemo`).

**Dependencies:** Epic 13 (`api_access` metered + `outbound_webhooks` in catalog), Epic 9 (`blockIfDemo`). Mirrors the established epic structure.

> **Scope note:** the broader "governance" bucket (network benchmarking, custom roles/permissions, tenant-visible activity log) is deferred — this epic delivers the Integrations & API core. Those are tracked as Epic-23 follow-ups in the roadmap.

---

## File Map

### New — Database
- `supabase/migrations/0029_integrations_api.sql` — `api_keys`, `outbound_webhooks`, `webhook_deliveries` (append-only)

### New — Core library (`src/lib/integrations/`)
- `src/lib/integrations/crypto.ts` — pure `generateApiKey()`, `hashKey()`, `signWebhook()`, `matchWebhooks()`
- `src/lib/integrations/service.ts` — key issue/verify/revoke + webhook CRUD + `dispatchWebhook`

### New — Tenant API
- `src/app/api/orgs/[orgId]/integrations/keys/route.ts` — GET list, POST issue
- `src/app/api/orgs/[orgId]/integrations/keys/[keyId]/route.ts` — DELETE revoke
- `src/app/api/orgs/[orgId]/integrations/webhooks/route.ts` — GET list, POST create
- `src/app/api/orgs/[orgId]/integrations/webhooks/[webhookId]/route.ts` — DELETE

### New — Tenant UI
- `src/app/dashboard/integrations/page.tsx` — keys + webhooks (gated)
- `src/app/dashboard/integrations/integrations-client.tsx`

### Modified
- `src/app/dashboard/layout.tsx` — compute `showIntegrations = hasFeature(tenant_id, "api_access")`, pass to shell
- `src/components/dashboard/dashboard-shell.tsx` — conditional "Integrations" nav entry

### Test files
- `tests/integrations-crypto.test.ts` — pure key/hash/sign/match
- `tests/integrations-migration.test.ts` — 0029 structure
- `tests/integrations-routes.test.ts` — issue route gating (demo + entitlement)

---

## Task 1: Migration 0029 — keys, webhooks, deliveries

**Files:** Create `supabase/migrations/0029_integrations_api.sql`; Test `tests/integrations-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/integrations-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0029_integrations_api.sql"), "utf8");

describe("0029 integrations api migration", () => {
  it("creates api_keys, outbound_webhooks, webhook_deliveries", () => {
    expect(sql).toMatch(/create table public\.api_keys/i);
    expect(sql).toMatch(/create table public\.outbound_webhooks/i);
    expect(sql).toMatch(/create table public\.webhook_deliveries/i);
  });
  it("stores only a key hash + prefix (never raw)", () => {
    expect(sql).toMatch(/key_hash\s+text/i);
    expect(sql).toMatch(/prefix\s+text/i);
  });
  it("makes webhook_deliveries append-only", () => {
    expect(sql).toMatch(/create trigger webhook_deliveries_immutable/i);
    expect(sql).toMatch(/before update or delete on public\.webhook_deliveries/i);
  });
  it("enables RLS + tenant policies", () => {
    expect(sql).toMatch(/alter table public\.api_keys enable row level security/i);
    expect(sql).toMatch(/api_keys_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/outbound_webhooks_insert/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/integrations-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0029_integrations_api.sql`**

```sql
-- 0029: Integrations & API.
--
-- api_keys store ONLY a SHA-256 hash + a short display prefix — the raw key is
-- shown once at issue time and never persisted. outbound_webhooks subscribe to
-- events; webhook_deliveries is the append-only delivery log.

create table public.api_keys (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  prefix          text not null,
  key_hash        text not null,
  scopes          jsonb not null default '[]'::jsonb,
  rate_limit_tier text not null default 'standard',
  last_used_at    timestamptz,
  created_by      uuid references public.users(id) on delete set null,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index api_keys_tenant_idx on public.api_keys (tenant_id);
create index api_keys_hash_idx on public.api_keys (key_hash);

create table public.outbound_webhooks (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  url           text not null,
  events        jsonb not null default '[]'::jsonb,
  secret        text not null,
  enabled       boolean not null default true,
  failure_count integer not null default 0,
  created_at    timestamptz not null default now()
);
create index outbound_webhooks_tenant_idx on public.outbound_webhooks (tenant_id);

create table public.webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  webhook_id    uuid references public.outbound_webhooks(id) on delete set null,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  event         text not null,
  status        text not null check (status in ('delivered','failed')),
  response_code integer,
  attempts      integer not null default 1,
  delivered_at  timestamptz not null default now()
);
create index webhook_deliveries_tenant_idx on public.webhook_deliveries (tenant_id, delivered_at);

-- RLS ----------------------------------------------------------------------
alter table public.api_keys enable row level security;
alter table public.outbound_webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy api_keys_select on public.api_keys
  for select using (tenant_id in (select public.current_user_tenants()));
create policy outbound_webhooks_select on public.outbound_webhooks
  for select using (tenant_id in (select public.current_user_tenants()));
create policy outbound_webhooks_insert on public.outbound_webhooks
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy webhook_deliveries_select on public.webhook_deliveries
  for select using (tenant_id in (select public.current_user_tenants()));

create or replace function public.prevent_webhook_deliveries_mutation()
returns trigger language plpgsql as $$
begin raise exception 'webhook_deliveries is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger webhook_deliveries_immutable
  before update or delete on public.webhook_deliveries
  for each row execute function public.prevent_webhook_deliveries_mutation();
```

> NOTE: `outbound_webhooks.secret` and `api_keys.key_hash` are sensitive. RLS lets a tenant SELECT them, which is acceptable for the secret (the tenant owns it and needs it to verify signatures) but `key_hash` should NOT be exposed in API responses — the SERVICE select lists must omit `key_hash` (see Task 3). The raw API key is never stored.

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/integrations-migration.test.ts`
Expected: applied; 4 tests PASS. (If `db push` replays a prior migration, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0029_integrations_api.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0029_integrations_api.sql tests/integrations-migration.test.ts
git commit -m "feat(integrations): migration 0029 — api keys, webhooks, deliveries"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure crypto (key gen, hashing, signing, matching)

**Files:** Create `src/lib/integrations/crypto.ts`; Test `tests/integrations-crypto.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/integrations-crypto.test.ts
import { describe, it, expect } from "vitest";
import { generateApiKey, hashKey, signWebhook, matchWebhooks } from "@/lib/integrations/crypto";

describe("generateApiKey", () => {
  it("produces a prefix, raw key starting with the prefix, and a matching hash", () => {
    const k = generateApiKey();
    expect(k.raw.startsWith("cab_")).toBe(true);
    expect(k.prefix.length).toBeGreaterThanOrEqual(8);
    expect(k.raw.startsWith(k.prefix)).toBe(true);
    expect(k.hash).toBe(hashKey(k.raw));
  });
  it("generates distinct keys each call", () => {
    expect(generateApiKey().raw).not.toBe(generateApiKey().raw);
  });
});

describe("hashKey", () => {
  it("is deterministic (sha256 hex, 64 chars)", () => {
    expect(hashKey("cab_abc")).toBe(hashKey("cab_abc"));
    expect(hashKey("cab_abc")).toHaveLength(64);
    expect(hashKey("cab_abc")).not.toBe(hashKey("cab_xyz"));
  });
});

describe("signWebhook", () => {
  it("is a deterministic HMAC-SHA256 hex of the payload+secret", () => {
    const a = signWebhook('{"x":1}', "secret");
    expect(a).toBe(signWebhook('{"x":1}', "secret"));
    expect(a).toHaveLength(64);
    expect(a).not.toBe(signWebhook('{"x":1}', "other"));
  });
});

describe("matchWebhooks", () => {
  const hooks = [
    { id: "1", url: "u1", events: ["booking.created"], enabled: true },
    { id: "2", url: "u2", events: ["booking.cancelled"], enabled: true },
    { id: "3", url: "u3", events: ["booking.created"], enabled: false },
    { id: "4", url: "u4", events: ["*"], enabled: true },
  ];
  it("returns enabled hooks subscribed to the event (or wildcard)", () => {
    const m = matchWebhooks(hooks, "booking.created").map((h) => h.id);
    expect(m).toContain("1");
    expect(m).toContain("4");
    expect(m).not.toContain("2");
    expect(m).not.toContain("3");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/integrations-crypto.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/integrations/crypto.ts`**

```typescript
import { createHash, createHmac, randomBytes } from "node:crypto";

export interface GeneratedKey { raw: string; prefix: string; hash: string }

/** Generate an API key: `cab_<prefix8><secret>`. The raw value is returned once. */
export function generateApiKey(): GeneratedKey {
  const body = randomBytes(24).toString("hex"); // 48 hex chars
  const raw = `cab_${body}`;
  const prefix = raw.slice(0, 12); // "cab_" + first 8 hex
  return { raw, prefix, hash: hashKey(raw) };
}

/** Deterministic SHA-256 hex of a raw key (what we store + look up by). */
export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** HMAC-SHA256 hex signature of a webhook payload with the hook's secret. */
export function signWebhook(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export interface WebhookLike { id: string; url: string; events: string[]; enabled: boolean }

/** Pure: enabled webhooks subscribed to `event` (or the `*` wildcard). */
export function matchWebhooks<T extends WebhookLike>(webhooks: T[], event: string): T[] {
  return webhooks.filter((h) => h.enabled && (h.events.includes(event) || h.events.includes("*")));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/integrations-crypto.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations/crypto.ts tests/integrations-crypto.test.ts
git commit -m "feat(integrations): pure key gen, hashing, webhook signing + matching"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Integrations service

**Files:** Create `src/lib/integrations/service.ts`

- [ ] **Step 1: Create `src/lib/integrations/service.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { generateApiKey, hashKey, signWebhook, matchWebhooks } from "./crypto";
import { recordUsage } from "@/lib/entitlements/meter";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface ApiKeyRow { id: string; name: string; prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string }
export interface WebhookRow { id: string; url: string; events: string[]; enabled: boolean; failure_count: number; created_at: string }

/** List a tenant's keys — NEVER returns key_hash. */
export async function listKeys(tenantId: string): Promise<ApiKeyRow[]> {
  const { data } = await svc().from("api_keys").select("id, name, prefix, last_used_at, revoked_at, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as ApiKeyRow[];
}

/** Issue a key — returns the RAW key exactly once (caller must show + discard). */
export async function issueKey(tenantId: string, name: string, createdBy: string): Promise<{ raw: string; prefix: string }> {
  const k = generateApiKey();
  await svc().from("api_keys").insert({ tenant_id: tenantId, name, prefix: k.prefix, key_hash: k.hash, created_by: createdBy });
  return { raw: k.raw, prefix: k.prefix };
}

export async function revokeKey(tenantId: string, keyId: string): Promise<void> {
  await svc().from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", keyId);
}

/** Verify a raw API key: returns the tenant_id when valid + not revoked, else null. Meters api_access. */
export async function verifyApiKey(raw: string): Promise<{ tenantId: string } | null> {
  const { data } = await svc().from("api_keys").select("id, tenant_id, revoked_at").eq("key_hash", hashKey(raw)).maybeSingle();
  if (!data || data.revoked_at) return null;
  const tenantId = data.tenant_id as string;
  await svc().from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  await recordUsage({ tenantId, featureKey: "api_access", quantity: 1, unit: "calls" });
  return { tenantId };
}

export async function listWebhooks(tenantId: string): Promise<WebhookRow[]> {
  const { data } = await svc().from("outbound_webhooks").select("id, url, events, enabled, failure_count, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as WebhookRow[];
}

export async function createWebhook(tenantId: string, url: string, events: string[]): Promise<void> {
  const secret = generateApiKey().raw.replace("cab_", "whsec_");
  await svc().from("outbound_webhooks").insert({ tenant_id: tenantId, url, events, secret });
}

export async function deleteWebhook(tenantId: string, webhookId: string): Promise<void> {
  await svc().from("outbound_webhooks").delete().eq("tenant_id", tenantId).eq("id", webhookId);
}

/**
 * Dispatch an event to all matching enabled webhooks: sign the payload, POST it,
 * record a delivery row. Best-effort; never throws into the caller.
 */
export async function dispatchWebhook(tenantId: string, event: string, payload: Record<string, unknown>): Promise<{ delivered: number }> {
  const sb = svc();
  const { data } = await sb.from("outbound_webhooks").select("id, url, events, enabled, secret").eq("tenant_id", tenantId);
  const hooks = (data ?? []) as (WebhookRow & { secret: string })[];
  const targets = matchWebhooks(hooks, event);
  const body = JSON.stringify({ event, data: payload, ts: new Date().toISOString() });
  let delivered = 0;

  for (const h of targets) {
    let status: "delivered" | "failed" = "failed";
    let code: number | null = null;
    try {
      const res = await fetch(h.url, { method: "POST", headers: { "content-type": "application/json", "x-bookmycab-signature": signWebhook(body, h.secret), "x-bookmycab-event": event }, body });
      code = res.status;
      status = res.ok ? "delivered" : "failed";
    } catch { status = "failed"; }
    try {
      await sb.from("webhook_deliveries").insert({ webhook_id: h.id, tenant_id: tenantId, event, status, response_code: code });
      if (status === "delivered") delivered++;
      else await sb.from("outbound_webhooks").update({ failure_count: (h.failure_count ?? 0) + 1 }).eq("id", h.id);
    } catch { /* delivery logging best-effort */ }
  }
  return { delivered };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/integrations/service.ts
git commit -m "feat(integrations): key issue/verify/revoke + webhook CRUD + signed dispatch"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Tenant API routes (gated)

**Files:** Create the four route files; Test `tests/integrations-routes.test.ts`

- [ ] **Step 1: Write the failing test (issue-key route gating)**

```typescript
// tests/integrations-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/integrations/service", () => ({ issueKey: vi.fn(async () => ({ raw: "cab_secret", prefix: "cab_12345678" })), listKeys: vi.fn(async () => []) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { issueKey } from "@/lib/integrations/service";
import { POST } from "@/app/api/orgs/[orgId]/integrations/keys/route";

const ctx = { params: Promise.resolve({ orgId: "t1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }

describe("POST issue api key", () => {
  beforeEach(() => vi.clearAllMocks());

  it("issues + returns the raw key once when entitled + not demo", async () => {
    const res = await POST(req({ name: "CI key" }), ctx);
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.raw).toBe("cab_secret");
    expect(issueKey).toHaveBeenCalled();
  });
  it("400 when name missing", async () => {
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(400);
    expect(issueKey).not.toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req({ name: "x" }), ctx);
    expect(res.status).toBe(403);
    expect(issueKey).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req({ name: "x" }), ctx);
    expect(res.status).toBe(403);
    expect(issueKey).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/integrations-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/integrations/keys/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listKeys, issueKey } from "@/lib/integrations/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "api_access");
  if (feat) return feat;
  return NextResponse.json({ keys: await listKeys(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "api_access");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Key name is required." }, { status: 400 });
  const result = await issueKey(orgId, name, gate.claims.sub);
  return NextResponse.json({ ok: true, raw: result.raw, prefix: result.prefix });
}
```

- [ ] **Step 4: Create `src/app/api/orgs/[orgId]/integrations/keys/[keyId]/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { revokeKey } from "@/lib/integrations/service";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; keyId: string }> }) {
  const { orgId, keyId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "api_access");
  if (feat) return feat;
  await revokeKey(orgId, keyId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create `src/app/api/orgs/[orgId]/integrations/webhooks/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { listWebhooks, createWebhook } from "@/lib/integrations/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "outbound_webhooks");
  if (feat) return feat;
  return NextResponse.json({ webhooks: await listWebhooks(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "outbound_webhooks");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const url = String(b.url ?? "").trim();
  const events = Array.isArray(b.events) ? (b.events as string[]).map(String) : [];
  if (!url || events.length === 0) return NextResponse.json({ error: "url and at least one event are required." }, { status: 400 });
  await createWebhook(orgId, url, events);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create `src/app/api/orgs/[orgId]/integrations/webhooks/[webhookId]/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { deleteWebhook } from "@/lib/integrations/service";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; webhookId: string }> }) {
  const { orgId, webhookId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "outbound_webhooks");
  if (feat) return feat;
  await deleteWebhook(orgId, webhookId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Run routes test + typecheck**

Run: `npx vitest run tests/integrations-routes.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests); no type errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/orgs/[orgId]/integrations" tests/integrations-routes.test.ts
git commit -m "feat(integrations): tenant API — api keys + webhooks (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Tenant Integrations page (gated) + nav

**Files:** Create `src/app/dashboard/integrations/page.tsx`, `src/app/dashboard/integrations/integrations-client.tsx`; Modify `src/app/dashboard/layout.tsx`, `src/components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Create `src/app/dashboard/integrations/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listKeys, listWebhooks } from "@/lib/integrations/service";
import { IntegrationsClient } from "./integrations-client";

export const metadata = { title: "Integrations — BookMyCab" };

export default async function IntegrationsPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "api_access"))) redirect("/dashboard");
  const canWebhooks = await hasFeature(claims.tenant_id, "outbound_webhooks");
  const [keys, webhooks] = await Promise.all([
    listKeys(claims.tenant_id),
    canWebhooks ? listWebhooks(claims.tenant_id) : Promise.resolve([]),
  ]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Integrations</h1>
      <p className="mb-4 text-sm text-slate-500">API keys and outbound webhooks for your own systems.</p>
      <IntegrationsClient orgId={claims.tenant_id} keys={keys} webhooks={webhooks} canWebhooks={canWebhooks} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/integrations/integrations-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Key { id: string; name: string; prefix: string; last_used_at: string | null; revoked_at: string | null }
interface Hook { id: string; url: string; events: string[]; enabled: boolean; failure_count: number }
const EVENTS = ["booking.created", "booking.cancelled", "conversation.ended", "*"];

export function IntegrationsClient(props: { orgId: string; keys: Key[]; webhooks: Hook[]; canWebhooks: boolean; isDemo: boolean }) {
  const router = useRouter();
  const base = `/api/orgs/${props.orgId}/integrations`;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);
  const [evs, setEvs] = useState<string[]>([]);

  async function call(url: string, method: string, body?: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`); return null; }
      router.refresh();
      return b;
    } catch { setErr("Network error."); return null; } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">API keys</h2>
        {issued && (
          <div className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            Copy your key now — it won&apos;t be shown again:<br /><code className="break-all font-mono">{issued}</code>
          </div>
        )}
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {props.keys.length === 0 && <li className="py-2 text-slate-400">No keys yet.</li>}
          {props.keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{k.name} <span className="font-mono text-xs text-slate-400">{k.prefix}…</span> {k.revoked_at && <span className="text-xs text-red-600">revoked</span>}</span>
              {!props.isDemo && !k.revoked_at && <button disabled={busy} onClick={() => call(`${base}/keys/${k.id}`, "DELETE")} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Revoke</button>}
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const b = await call(`${base}/keys`, "POST", { name: f.get("name") }); if (b && typeof b.raw === "string") setIssued(b.raw); e.currentTarget.reset(); }} className="flex gap-2">
            <input name="name" required placeholder="Key name" className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Issue key</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Outbound webhooks</h2>
        {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
        {!props.canWebhooks ? <p className="text-sm text-slate-400">Webhooks aren&apos;t on your plan.</p> : (
          <>
            <ul className="mb-3 divide-y divide-slate-100 text-sm">
              {props.webhooks.length === 0 && <li className="py-2 text-slate-400">No webhooks yet.</li>}
              {props.webhooks.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-2">
                  <span className="text-slate-800"><span className="break-all">{h.url}</span> <span className="text-xs text-slate-400">{h.events.join(", ")}</span></span>
                  {!props.isDemo && <button disabled={busy} onClick={() => call(`${base}/webhooks/${h.id}`, "DELETE")} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Delete</button>}
                </li>
              ))}
            </ul>
            {!props.isDemo && (
              <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); if (evs.length) { void call(`${base}/webhooks`, "POST", { url: f.get("url"), events: evs }); e.currentTarget.reset(); setEvs([]); } }} className="space-y-2">
                <input name="url" type="url" required placeholder="https://your-system/webhook" className="w-full rounded border border-slate-300 px-2 py-1 text-sm" />
                <div className="flex flex-wrap gap-2 text-xs">
                  {EVENTS.map((ev) => <label key={ev} className="flex items-center gap-1"><input type="checkbox" checked={evs.includes(ev)} onChange={(e) => setEvs((s) => e.target.checked ? [...s, ev] : s.filter((x) => x !== ev))} /> {ev}</label>)}
                </div>
                <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Add webhook</button>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Gate the nav — modify `src/app/dashboard/layout.tsx`**

Add `const showIntegrations = claims.tenant_id ? await hasFeature(claims.tenant_id, "api_access") : false;` and pass `showIntegrations={showIntegrations}` to `<DashboardShell>`. Reuse existing imports; no second auth call.

- [ ] **Step 4: Modify `src/components/dashboard/dashboard-shell.tsx`**

Add a `showIntegrations?: boolean` prop and extend `NAV_ITEMS` with `...(showIntegrations ? [{ label: "Integrations", href: "/dashboard/integrations" }] : [])`. Match the exact `{ label, href }` shape.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/dashboard/integrations`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/integrations src/app/dashboard/layout.tsx src/components/dashboard/dashboard-shell.tsx
git commit -m "feat(integrations): integrations dashboard page + entitlement-gated nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Integration gate

- [ ] **Step 1: Run the integrations test set**

Run: `npx vitest run tests/integrations-migration.test.ts tests/integrations-crypto.test.ts tests/integrations-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(integrations): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| API keys: issue (raw shown once), list (no hash), revoke, verify | Tasks 1, 2, 3, 4, 5 |
| Key stored as hash + prefix only | Tasks 1, 2, 3 |
| Metering of API calls (`api_access`) | Task 3 (verifyApiKey) |
| Outbound webhooks: subscribe + signed delivery | Tasks 2, 3, 4, 5 |
| Append-only delivery log | Task 1 |
| Webhook signature (HMAC) + event matching | Task 2 |
| Entitlement gates (`api_access`, `outbound_webhooks`) | Tasks 4, 5 |
| Demo write-block | Task 4 |

**Placeholder scan:** none.

**Type consistency:** `GeneratedKey`/`WebhookLike` (crypto.ts) used by service.ts. `ApiKeyRow`/`WebhookRow` in service.ts used by routes + page. `issueKey` returns `{ raw, prefix }`; route returns `raw` once. `verifyApiKey` returns `{ tenantId } | null`. `requireFeature(..., "api_access"/"outbound_webhooks")` matches Epic 13.

**Security notes (built in):** raw key never persisted (only SHA-256 hash + prefix); `listKeys` select omits `key_hash`; webhook payloads HMAC-signed with a per-hook secret; delivery log append-only; all mutating routes demo-blocked + entitlement-gated; `verifyApiKey` checks `revoked_at`.

**Known limitations (documented):** there is no public API endpoint consuming `verifyApiKey` yet (the verification + metering primitive exists for when a `/api/v1/*` surface lands); rate-limiting by `rate_limit_tier` is stored but not enforced; webhook retries/backoff are a follow-up (single attempt + failure_count today); `dispatchWebhook` is exposed for internal callers (booking/conversation events) to invoke — wiring those emit points is a fast-follow. The broader governance bucket (benchmarking, custom roles, tenant activity log) remains a separate follow-up.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-epic-23-integrations-api.md`.

**6 tasks. Task 1 (schema) gates all; Task 2 (pure) independent; Task 3 depends on 1–2; Task 4 depends on 3; Task 5 depends on 3; Task 6 last.**
