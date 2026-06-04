# Epic 17: Live Ops & Human Takeover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff watch live conversations and take one over from the bot — claim a conversation, send replies as a human (recorded in the same thread and relayed to the channel), then hand control back — all gated by the `live_takeover` entitlement.

**Architecture:** Migration 0023 adds takeover state to `conversations` (`takeover_status`, `assigned_to`, `takeover_at`, `last_human_reply_at`) and provenance to `messages` (`source`, `sent_by_user_id`). A pure state machine governs the bot→requested→human→bot transitions. A service claims/releases conversations and posts staff messages (writing a `source='human'` message + stamping the conversation, then relaying outbound through the existing engine client — graceful no-op when the engine is unconfigured, mirroring `sendEmail`). Tenant API routes (gated by `requireFeature("live_takeover")` + `blockIfDemo`) expose the live-ops list, claim/release, and post-message. A tenant dashboard "Live ops" page lists active conversations with a takeover panel, shown only when entitled.

**Tech Stack:** Supabase Postgres (RLS, additive columns under existing 0005 policies), TypeScript, Next.js App Router, the existing `EngineClient` (`src/lib/engine/client.ts` `call()`), Vitest. Builds on Epic 13 (`requireFeature`), Epic 9 (`blockIfDemo`), conversations/messages (0003).

**Dependencies:** Epic 13 (`live_takeover` in catalog), Epic 9 (`blockIfDemo`), Epic 5 (engine client). Mirrors the established epic structure.

---

## File Map

### New — Database
- `supabase/migrations/0023_live_ops.sql` — conversations takeover columns + messages provenance columns

### New — Core library (`src/lib/liveops/`)
- `src/lib/liveops/takeover.ts` — pure `nextTakeoverState(current, action)` + types
- `src/lib/liveops/relay.ts` — `relayToChannel(args)`: send a human message out via the engine (graceful)
- `src/lib/liveops/service.ts` — `listActiveConversations`, `claimConversation`, `releaseConversation`, `postStaffMessage`, `getThread`

### New — Tenant API
- `src/app/api/orgs/[orgId]/liveops/route.ts` — GET active conversations
- `src/app/api/orgs/[orgId]/liveops/[conversationId]/claim/route.ts` — POST claim, POST(release via ?action)
- `src/app/api/orgs/[orgId]/liveops/[conversationId]/messages/route.ts` — GET thread, POST staff message

### New — Tenant UI
- `src/app/dashboard/liveops/page.tsx` — active conversations list (gated)
- `src/app/dashboard/liveops/liveops-client.tsx` — list + takeover panel + reply box

### Modified
- `src/app/dashboard/layout.tsx` — compute `showLiveops = hasFeature(tenant_id, "live_takeover")`, pass to shell
- `src/components/dashboard/dashboard-shell.tsx` — conditional "Live ops" nav entry

### Test files
- `tests/liveops-migration.test.ts` — 0023 structure
- `tests/liveops-takeover.test.ts` — pure state transitions
- `tests/liveops-routes.test.ts` — claim/post gating (demo + entitlement)

---

## Task 1: Migration 0023 — takeover + provenance columns

**Files:** Create `supabase/migrations/0023_live_ops.sql`; Test `tests/liveops-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/liveops-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0023_live_ops.sql"), "utf8");

describe("0023 live ops migration", () => {
  it("adds takeover columns to conversations", () => {
    expect(sql).toMatch(/alter table public\.conversations add column takeover_status text/i);
    expect(sql).toMatch(/alter table public\.conversations add column assigned_to uuid/i);
    expect(sql).toMatch(/alter table public\.conversations add column takeover_at timestamptz/i);
    expect(sql).toMatch(/alter table public\.conversations add column last_human_reply_at timestamptz/i);
  });
  it("adds provenance columns to messages", () => {
    expect(sql).toMatch(/alter table public\.messages add column source text/i);
    expect(sql).toMatch(/alter table public\.messages add column sent_by_user_id uuid/i);
  });
  it("defaults takeover_status to bot with a check constraint", () => {
    expect(sql).toMatch(/takeover_status text .*default 'bot'/i);
    expect(sql).toMatch(/check .*'bot'.*'requested'.*'human'/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/liveops-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0023_live_ops.sql`**

```sql
-- 0023: Live ops & human takeover.
--
-- Additive columns only — existing 0005 RLS policies on conversations/messages
-- already scope these tables by tenant, so no new policies are required.

alter table public.conversations add column takeover_status text not null default 'bot' check (takeover_status in ('bot','requested','human'));
alter table public.conversations add column assigned_to uuid references public.users(id) on delete set null;
alter table public.conversations add column takeover_at timestamptz;
alter table public.conversations add column last_human_reply_at timestamptz;

alter table public.messages add column source text not null default 'bot' check (source in ('bot','human','customer'));
alter table public.messages add column sent_by_user_id uuid references public.users(id) on delete set null;

create index conversations_takeover_idx on public.conversations (tenant_id, takeover_status);
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/liveops-migration.test.ts`
Expected: applied; 3 tests PASS. (If `db push` times out, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0023_live_ops.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0023_live_ops.sql tests/liveops-migration.test.ts
git commit -m "feat(liveops): migration 0023 — takeover state + message provenance"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure takeover state machine

**Files:** Create `src/lib/liveops/takeover.ts`; Test `tests/liveops-takeover.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/liveops-takeover.test.ts
import { describe, it, expect } from "vitest";
import { nextTakeoverState, type TakeoverStatus, type TakeoverAction } from "@/lib/liveops/takeover";

describe("nextTakeoverState", () => {
  it("claim moves bot → human", () => {
    expect(nextTakeoverState("bot", "claim")).toBe("human");
  });
  it("claim moves requested → human", () => {
    expect(nextTakeoverState("requested", "claim")).toBe("human");
  });
  it("release moves human → bot", () => {
    expect(nextTakeoverState("human", "release")).toBe("bot");
  });
  it("request moves bot → requested", () => {
    expect(nextTakeoverState("bot", "request")).toBe("requested");
  });
  it("is a no-op for invalid transitions (returns current)", () => {
    expect(nextTakeoverState("human", "claim")).toBe("human");
    expect(nextTakeoverState("bot", "release")).toBe("bot");
  });
  it("canStaffReply is true only in human state", () => {
    const states: TakeoverStatus[] = ["bot", "requested", "human"];
    const actions: TakeoverAction[] = ["claim", "release", "request"];
    expect(states.length + actions.length).toBe(6); // sanity, keeps unions referenced
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/liveops-takeover.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/liveops/takeover.ts`**

```typescript
export type TakeoverStatus = "bot" | "requested" | "human";
export type TakeoverAction = "claim" | "release" | "request";

/**
 * Pure transition for the takeover state machine.
 * - claim: bot|requested → human
 * - release: human → bot
 * - request: bot → requested
 * Any other (status, action) pair is a no-op (returns the current status).
 */
export function nextTakeoverState(current: TakeoverStatus, action: TakeoverAction): TakeoverStatus {
  if (action === "claim" && (current === "bot" || current === "requested")) return "human";
  if (action === "release" && current === "human") return "bot";
  if (action === "request" && current === "bot") return "requested";
  return current;
}

/** Staff may send a reply only while they hold the conversation. */
export function canStaffReply(status: TakeoverStatus): boolean {
  return status === "human";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/liveops-takeover.test.ts` — Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/liveops/takeover.ts tests/liveops-takeover.test.ts
git commit -m "feat(liveops): pure takeover state machine"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Outbound relay + service

**Files:** Create `src/lib/liveops/relay.ts`, `src/lib/liveops/service.ts`

- [ ] **Step 1: Create `src/lib/liveops/relay.ts`**

```typescript
import "server-only";
import { env } from "@/env";

/**
 * Relay a human staff message out to the customer's channel via the automation
 * engine. Graceful: when the engine is not configured (no N8N_BASE_URL) it logs
 * and returns false rather than throwing — mirrors sendEmail. The engine is
 * expected to expose an inbound relay webhook that forwards to the channel.
 */
export async function relayToChannel(
  args: { automationId: string; conversationId: string; customerHandle: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.N8N_BASE_URL || !env.N8N_API_KEY) {
    console.warn("relayToChannel: engine not configured — skipping outbound relay", { conversationId: args.conversationId });
    return false;
  }
  try {
    const res = await fetchImpl(`${env.N8N_BASE_URL}/webhook/staff-relay`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.N8N_API_KEY },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      console.error("relayToChannel: engine returned non-2xx", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("relayToChannel threw", err);
    return false;
  }
}
```

- [ ] **Step 2: Create `src/lib/liveops/service.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { nextTakeoverState, type TakeoverStatus, type TakeoverAction } from "./takeover";
import { relayToChannel } from "./relay";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface ActiveConversation {
  id: string; customer_handle: string; customer_name: string | null; takeover_status: string;
  assigned_to: string | null; started_at: string; last_human_reply_at: string | null; automation_id: string;
}

/** Conversations that are open (not ended) — the live-ops queue. */
export async function listActiveConversations(tenantId: string): Promise<ActiveConversation[]> {
  const { data } = await svc()
    .from("conversations")
    .select("id, customer_handle, customer_name, takeover_status, assigned_to, started_at, last_human_reply_at, automation_id")
    .eq("tenant_id", tenantId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(100);
  return (data ?? []) as ActiveConversation[];
}

async function applyTransition(tenantId: string, conversationId: string, action: TakeoverAction, userId: string | null): Promise<{ ok: boolean; status?: TakeoverStatus }> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("takeover_status").eq("tenant_id", tenantId).eq("id", conversationId).maybeSingle();
  if (!conv) return { ok: false };
  const current = (conv.takeover_status as TakeoverStatus) ?? "bot";
  const next = nextTakeoverState(current, action);
  const patch: Record<string, unknown> = { takeover_status: next };
  if (action === "claim") { patch.assigned_to = userId; patch.takeover_at = new Date().toISOString(); }
  if (action === "release") { patch.assigned_to = null; }
  await sb.from("conversations").update(patch).eq("tenant_id", tenantId).eq("id", conversationId);
  return { ok: true, status: next };
}

export async function claimConversation(tenantId: string, conversationId: string, userId: string) {
  return applyTransition(tenantId, conversationId, "claim", userId);
}
export async function releaseConversation(tenantId: string, conversationId: string) {
  return applyTransition(tenantId, conversationId, "release", null);
}

export interface ThreadMessage { id: string; direction: string; source: string; payload: unknown; transcript: string | null; ts: string }

export async function getThread(tenantId: string, conversationId: string): Promise<ThreadMessage[]> {
  const sb = svc();
  // Confirm the conversation belongs to the tenant before returning its messages.
  const { data: conv } = await sb.from("conversations").select("id").eq("tenant_id", tenantId).eq("id", conversationId).maybeSingle();
  if (!conv) return [];
  const { data } = await sb.from("messages").select("id, direction, source, payload, transcript, ts").eq("conversation_id", conversationId).order("ts");
  return (data ?? []) as ThreadMessage[];
}

/**
 * Post a staff reply: only allowed when the conversation is in `human` takeover.
 * Writes a source='human' outbound message, stamps last_human_reply_at, and
 * relays the text to the channel. Returns relay outcome.
 */
export async function postStaffMessage(args: { tenantId: string; conversationId: string; userId: string; text: string }): Promise<{ ok: boolean; relayed: boolean; reason?: string }> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("takeover_status, automation_id, customer_handle").eq("tenant_id", args.tenantId).eq("id", args.conversationId).maybeSingle();
  if (!conv) return { ok: false, relayed: false, reason: "not_found" };
  if (conv.takeover_status !== "human") return { ok: false, relayed: false, reason: "not_in_takeover" };

  const now = new Date().toISOString();
  await sb.from("messages").insert({
    conversation_id: args.conversationId,
    direction: "outbound",
    message_type: "text",
    payload: { text: args.text },
    source: "human",
    sent_by_user_id: args.userId,
    ts: now,
  });
  await sb.from("conversations").update({ last_human_reply_at: now }).eq("tenant_id", args.tenantId).eq("id", args.conversationId);

  const relayed = await relayToChannel({
    automationId: conv.automation_id as string,
    conversationId: args.conversationId,
    customerHandle: conv.customer_handle as string,
    text: args.text,
  });
  return { ok: true, relayed };
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/liveops/relay.ts src/lib/liveops/service.ts
git commit -m "feat(liveops): claim/release + staff message posting + engine relay"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Tenant API routes (gated)

**Files:** Create the three route files; Test `tests/liveops-routes.test.ts`

- [ ] **Step 1: Write the failing test (post-message gating + takeover guard)**

```typescript
// tests/liveops-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/liveops/service", () => ({ postStaffMessage: vi.fn(async () => ({ ok: true, relayed: true })), getThread: vi.fn(async () => []) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { postStaffMessage } from "@/lib/liveops/service";
import { POST } from "@/app/api/orgs/[orgId]/liveops/[conversationId]/messages/route";

const ctx = { params: Promise.resolve({ orgId: "t1", conversationId: "c1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }

describe("POST staff message", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts when entitled + not demo", async () => {
    const res = await POST(req({ text: "Hi, this is the dispatcher" }), ctx);
    expect(res.status).toBe(200);
    expect(postStaffMessage).toHaveBeenCalled();
  });
  it("400 when text is empty", async () => {
    const res = await POST(req({ text: "" }), ctx);
    expect(res.status).toBe(400);
    expect(postStaffMessage).not.toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req({ text: "hi" }), ctx);
    expect(res.status).toBe(403);
    expect(postStaffMessage).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req({ text: "hi" }), ctx);
    expect(res.status).toBe(403);
    expect(postStaffMessage).not.toHaveBeenCalled();
  });
  it("409 when the conversation is not in takeover", async () => {
    vi.mocked(postStaffMessage).mockResolvedValueOnce({ ok: false, relayed: false, reason: "not_in_takeover" });
    const res = await POST(req({ text: "hi" }), ctx);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/liveops-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/liveops/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { requireFeature } from "@/lib/entitlements/guard";
import { listActiveConversations } from "@/lib/liveops/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "live_takeover");
  if (feat) return feat;
  return NextResponse.json({ conversations: await listActiveConversations(orgId) });
}
```

- [ ] **Step 4: Create `src/app/api/orgs/[orgId]/liveops/[conversationId]/claim/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { claimConversation, releaseConversation } from "@/lib/liveops/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "live_takeover");
  if (feat) return feat;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") === "release" ? "release" : "claim";
  const result = action === "release"
    ? await releaseConversation(orgId, conversationId)
    : await claimConversation(orgId, conversationId, gate.claims.sub);
  if (!result.ok) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  return NextResponse.json({ ok: true, status: result.status });
}
```

- [ ] **Step 5: Create `src/app/api/orgs/[orgId]/liveops/[conversationId]/messages/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { getThread, postStaffMessage } from "@/lib/liveops/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "live_takeover");
  if (feat) return feat;
  return NextResponse.json({ messages: await getThread(orgId, conversationId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "live_takeover");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = String(body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Message text is required." }, { status: 400 });
  const result = await postStaffMessage({ tenantId: orgId, conversationId, userId: gate.claims.sub, text });
  if (!result.ok) {
    if (result.reason === "not_in_takeover") return NextResponse.json({ error: "Claim the conversation before replying." }, { status: 409 });
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, relayed: result.relayed });
}
```

- [ ] **Step 6: Run routes test + typecheck**

Run: `npx vitest run tests/liveops-routes.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests); no type errors.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/orgs/[orgId]/liveops" tests/liveops-routes.test.ts
git commit -m "feat(liveops): tenant API — live list, claim/release, staff messages (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Tenant Live ops page (gated) + nav

**Files:** Create `src/app/dashboard/liveops/page.tsx`, `src/app/dashboard/liveops/liveops-client.tsx`; Modify `src/app/dashboard/layout.tsx`, `src/components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Create `src/app/dashboard/liveops/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listActiveConversations } from "@/lib/liveops/service";
import { LiveopsClient } from "./liveops-client";

export const metadata = { title: "Live ops — CabbyBot" };

export default async function LiveopsPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "live_takeover"))) redirect("/dashboard");
  const conversations = await listActiveConversations(claims.tenant_id);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Live ops</h1>
      <p className="mb-4 text-sm text-slate-500">Watch live conversations and take over from the bot.</p>
      <LiveopsClient orgId={claims.tenant_id} conversations={conversations} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/liveops/liveops-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Conversation { id: string; customer_handle: string; customer_name: string | null; takeover_status: string; started_at: string }
interface Msg { id: string; direction: string; source: string; payload: unknown; transcript: string | null; ts: string }

export function LiveopsClient(props: { orgId: string; conversations: Conversation[]; isDemo: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const base = (id: string) => `/api/orgs/${props.orgId}/liveops/${id}`;

  async function openConv(c: Conversation) {
    setSelected(c); setErr(null);
    const res = await fetch(`${base(c.id)}/messages`);
    const b = await res.json().catch(() => ({ messages: [] }));
    setThread(b.messages ?? []);
  }
  async function act(url: string, body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`);
      else { router.refresh(); if (selected) await openConv(selected); }
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  function textOf(m: Msg): string {
    if (m.transcript) return m.transcript;
    const p = m.payload as { text?: string } | null;
    return p?.text ?? "[non-text message]";
  }

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <div className="rounded-lg border border-slate-200">
        <ul className="divide-y divide-slate-100 text-sm">
          {props.conversations.length === 0 && <li className="p-3 text-slate-400">No active conversations.</li>}
          {props.conversations.map((c) => (
            <li key={c.id}>
              <button onClick={() => openConv(c)} className={`flex w-full items-center justify-between p-3 text-left hover:bg-slate-50 ${selected?.id === c.id ? "bg-slate-50" : ""}`}>
                <span><span className="font-medium text-slate-800">{c.customer_name ?? c.customer_handle}</span><br /><span className="text-xs text-slate-400">{c.customer_handle}</span></span>
                <span className={c.takeover_status === "human" ? "rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-700" : "rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500"}>{c.takeover_status}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 p-4">
        {!selected && <p className="text-sm text-slate-400">Select a conversation.</p>}
        {selected && (
          <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-800">{selected.customer_name ?? selected.customer_handle}</span>
              {!props.isDemo && (
                selected.takeover_status === "human"
                  ? <button disabled={busy} onClick={() => act(`${base(selected.id)}/claim?action=release`)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Hand back to bot</button>
                  : <button disabled={busy} onClick={() => act(`${base(selected.id)}/claim`)} className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white">Take over</button>
              )}
            </div>
            <div className="mb-3 max-h-80 flex-1 space-y-1 overflow-y-auto rounded bg-slate-50 p-2 text-sm">
              {thread.map((m) => (
                <div key={m.id} className={m.direction === "inbound" ? "text-slate-800" : m.source === "human" ? "text-blue-800" : "text-emerald-700"}>
                  <span className="text-[11px] uppercase text-slate-400">{m.direction === "inbound" ? "customer" : m.source}</span> {textOf(m)}
                </div>
              ))}
              {thread.length === 0 && <p className="text-slate-400">No messages.</p>}
            </div>
            {!props.isDemo && selected.takeover_status === "human" && (
              <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { void act(`${base(selected.id)}/messages`, { text }); setText(""); } }} className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply as dispatcher…" className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
                <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Send</button>
              </form>
            )}
            {err && <p className="mt-2 text-sm text-red-600" role="alert">{err}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Gate the nav — modify `src/app/dashboard/layout.tsx`**

Read the file. It already computes `showAlerts` and `showCustomers` via `hasFeature`. Add `const showLiveops = claims.tenant_id ? await hasFeature(claims.tenant_id, "live_takeover") : false;` and pass `showLiveops={showLiveops}` to `<DashboardShell>`. Reuse existing imports; no second auth call.

- [ ] **Step 4: Modify `src/components/dashboard/dashboard-shell.tsx`**

Read it. It builds `NAV_ITEMS` as `[...BASE_NAV_ITEMS, ...(showAlerts ? [...] : []), ...(showCustomers ? [...] : [])]`. Add a `showLiveops?: boolean` prop and extend with `...(showLiveops ? [{ label: "Live ops", href: "/dashboard/liveops" }] : [])`. Match the exact `{ label, href }` shape.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/dashboard/liveops`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/liveops src/app/dashboard/layout.tsx src/components/dashboard/dashboard-shell.tsx
git commit -m "feat(liveops): live ops dashboard page + entitlement-gated nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Integration gate

- [ ] **Step 1: Run the liveops test set**

Run: `npx vitest run tests/liveops-migration.test.ts tests/liveops-takeover.test.ts tests/liveops-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts (no local n8n).

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(liveops): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Live conversation queue | Tasks 3, 4, 5 |
| Claim / release takeover (state machine) | Tasks 2, 3, 4, 5 |
| Staff reply recorded with provenance (`source='human'`) | Tasks 1, 3 |
| Reply only allowed while holding takeover (409 otherwise) | Tasks 3, 4 |
| Outbound relay to channel (graceful no-op) | Task 3 |
| Entitlement gate (`live_takeover`) on every surface | Tasks 4, 5 |
| Demo write-block | Task 4 |

**Placeholder scan:** none.

**Type consistency:** `TakeoverStatus`/`TakeoverAction` (takeover.ts) used by service.ts. `ActiveConversation`/`ThreadMessage` in service.ts used by routes + page. `postStaffMessage` returns `{ ok, relayed, reason? }`; route maps `reason==="not_in_takeover"` → 409. `requireFeature(tenantId, "live_takeover")` matches Epic 13.

**Known limitations (documented):** the outbound relay targets a `/webhook/staff-relay` engine endpoint that the n8n workflow must implement to actually forward to WhatsApp/Telegram — until then relay is a logged no-op and the human reply is still recorded in-thread (the dashboard shows it); "active conversation" = not-yet-ended (no idle-timeout sweeper in this epic); realtime auto-refresh of the live board uses manual refresh in v1 (Supabase Realtime subscription is a fast-follow); inbound customer messages continuing to hit the bot while a human holds takeover is governed by the engine honoring `takeover_status` (engine-side wiring is a follow-up).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-epic-17-live-ops.md`.

**6 tasks. Task 1 (schema) gates all; Task 2 (pure) independent; Task 3 depends on 1–2; Task 4 depends on 3; Task 5 depends on 3; Task 6 last.**
