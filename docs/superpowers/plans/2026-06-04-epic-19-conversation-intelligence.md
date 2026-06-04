# Epic 19: Conversation Intelligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn raw transcripts into operational signal — a deterministic QA score + flags per conversation, full-text search across conversations, and a flag-for-review training loop — gated by the `conversation_intelligence` entitlement.

**Architecture:** Migration 0025 adds analysis columns to `conversations` (`qa_score`, `qa_flags`, `flagged_for_review`, `intent_summary`, `sentiment`), `sentiment` to `messages`, and a `conversation_reviews` table for staff QA + training feedback. A pure scorer turns conversation signals (outcome, duration, message count, abandonment) into a 0–100 QA score + flags — no LLM needed for v1 (LLM sentiment is a documented follow-up that will meter tokens via `recordUsage`). A service computes/persists scores, searches transcripts, flags conversations, and records reviews. Tenant API routes (gated by `requireFeature("conversation_intelligence")` + `blockIfDemo`) expose analyze, search, flag, and review. A tenant dashboard "Intelligence" page surfaces it, shown only when entitled.

**Tech Stack:** Supabase Postgres (RLS), TypeScript, Next.js App Router, Vitest. Builds on Epic 13 (`requireFeature`/`recordUsage`), Epic 9 (`blockIfDemo`), conversations/messages (0003).

**Dependencies:** Epic 13 (`conversation_intelligence` in catalog, metered unit `tokens`), Epic 9 (`blockIfDemo`), Epic 7 (conversations/messages). Mirrors the established epic structure.

---

## File Map

### New — Database
- `supabase/migrations/0025_conversation_intelligence.sql` — conversations analysis columns + messages.sentiment + `conversation_reviews`

### New — Core library (`src/lib/convintel/`)
- `src/lib/convintel/score.ts` — pure `scoreConversation(signals)` → `{ score, flags }`
- `src/lib/convintel/service.ts` — `analyzeConversation`, `analyzeRecent`, `searchConversations`, `flagForReview`, `submitReview`, `listFlagged`

### New — Tenant API
- `src/app/api/orgs/[orgId]/intel/analyze/route.ts` — POST (re-score recent conversations)
- `src/app/api/orgs/[orgId]/intel/search/route.ts` — GET `?q=` transcript search
- `src/app/api/orgs/[orgId]/intel/[conversationId]/flag/route.ts` — POST flag/unflag
- `src/app/api/orgs/[orgId]/intel/[conversationId]/review/route.ts` — POST submit review

### New — Tenant UI
- `src/app/dashboard/intel/page.tsx` — search + flagged queue + QA scores (gated)
- `src/app/dashboard/intel/intel-client.tsx`

### Modified
- `src/app/dashboard/layout.tsx` — compute `showIntel = hasFeature(tenant_id, "conversation_intelligence")`, pass to shell
- `src/components/dashboard/dashboard-shell.tsx` — conditional "Intelligence" nav entry

### Test files
- `tests/convintel-migration.test.ts` — 0025 structure
- `tests/convintel-score.test.ts` — pure scoring
- `tests/convintel-routes.test.ts` — flag route gating (demo + entitlement)

---

## Task 1: Migration 0025 — analysis columns + reviews

**Files:** Create `supabase/migrations/0025_conversation_intelligence.sql`; Test `tests/convintel-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/convintel-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0025_conversation_intelligence.sql"), "utf8");

describe("0025 conversation intelligence migration", () => {
  it("adds analysis columns to conversations", () => {
    expect(sql).toMatch(/alter table public\.conversations add column qa_score numeric/i);
    expect(sql).toMatch(/alter table public\.conversations add column qa_flags jsonb/i);
    expect(sql).toMatch(/alter table public\.conversations add column flagged_for_review boolean/i);
    expect(sql).toMatch(/alter table public\.conversations add column intent_summary text/i);
    expect(sql).toMatch(/alter table public\.conversations add column sentiment text/i);
  });
  it("adds sentiment to messages", () => {
    expect(sql).toMatch(/alter table public\.messages add column sentiment text/i);
  });
  it("creates conversation_reviews with RLS + tenant policies", () => {
    expect(sql).toMatch(/create table public\.conversation_reviews/i);
    expect(sql).toMatch(/alter table public\.conversation_reviews enable row level security/i);
    expect(sql).toMatch(/conversation_reviews_select[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/conversation_reviews_insert/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/convintel-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0025_conversation_intelligence.sql`**

```sql
-- 0025: Conversation intelligence.
--
-- Additive analysis columns on conversations/messages (existing 0005 RLS covers
-- them), plus a conversation_reviews table for staff QA + training feedback.

alter table public.conversations add column qa_score numeric;
alter table public.conversations add column qa_flags jsonb not null default '[]'::jsonb;
alter table public.conversations add column flagged_for_review boolean not null default false;
alter table public.conversations add column intent_summary text;
alter table public.conversations add column sentiment text;

alter table public.messages add column sentiment text;

create table public.conversation_reviews (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  reviewer_id     uuid references public.users(id) on delete set null,
  rating          integer check (rating between 1 and 5),
  label           text check (label in ('good','bad_understanding','too_slow','wrong_info','other')),
  note            text,
  used_for_training boolean not null default false,
  created_at      timestamptz not null default now()
);
create index conversation_reviews_conversation_idx on public.conversation_reviews (conversation_id);
create index conversations_flagged_idx on public.conversations (tenant_id, flagged_for_review);

-- RLS ----------------------------------------------------------------------
alter table public.conversation_reviews enable row level security;

create policy conversation_reviews_select on public.conversation_reviews
  for select using (tenant_id in (select public.current_user_tenants()));
create policy conversation_reviews_insert on public.conversation_reviews
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy conversation_reviews_delete on public.conversation_reviews
  for delete using (tenant_id in (select public.current_user_tenants()));
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/convintel-migration.test.ts`
Expected: applied; 3 tests PASS. (If `db push` replays a prior migration, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0025_conversation_intelligence.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0025_conversation_intelligence.sql tests/convintel-migration.test.ts
git commit -m "feat(convintel): migration 0025 — analysis columns + conversation reviews"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure QA scoring

**Files:** Create `src/lib/convintel/score.ts`; Test `tests/convintel-score.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/convintel-score.test.ts
import { describe, it, expect } from "vitest";
import { scoreConversation, type ConversationSignals } from "@/lib/convintel/score";

const base: ConversationSignals = {
  outcome: "booked",
  durationSec: 120,
  messageCount: 14,
  avgBotReplySec: 3,
};

describe("scoreConversation", () => {
  it("a fast successful booking scores high with no flags", () => {
    const r = scoreConversation(base);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.flags).toHaveLength(0);
  });
  it("an abandoned conversation is penalised + flagged", () => {
    const r = scoreConversation({ ...base, outcome: "abandoned" });
    expect(r.score).toBeLessThan(60);
    expect(r.flags).toContain("abandoned");
  });
  it("slow bot replies add a 'slow' flag and reduce score", () => {
    const fast = scoreConversation(base).score;
    const slow = scoreConversation({ ...base, avgBotReplySec: 20 });
    expect(slow.flags).toContain("slow");
    expect(slow.score).toBeLessThan(fast);
  });
  it("a very long conversation (many turns) flags 'long'", () => {
    const r = scoreConversation({ ...base, messageCount: 60 });
    expect(r.flags).toContain("long");
  });
  it("clamps the score to the 0–100 range", () => {
    const r = scoreConversation({ outcome: "abandoned", durationSec: 9999, messageCount: 200, avgBotReplySec: 99 });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/convintel-score.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/convintel/score.ts`**

```typescript
export interface ConversationSignals {
  outcome: string | null;
  durationSec: number;
  messageCount: number;
  avgBotReplySec: number;
}

export type QaFlag = "abandoned" | "slow" | "long" | "no_resolution";

export interface QaResult {
  score: number; // 0–100
  flags: QaFlag[];
}

/**
 * Pure, deterministic QA score from conversation signals. No LLM. v1 heuristic:
 * start at 100, subtract penalties for poor outcome, slow replies and bloated
 * length; collect matching flags. (LLM sentiment/intent is a follow-up that
 * will enrich, not replace, this score.)
 */
export function scoreConversation(s: ConversationSignals): QaResult {
  let score = 100;
  const flags: QaFlag[] = [];

  const goodOutcomes = ["booked", "managed", "quoted"];
  if (s.outcome === "abandoned") { score -= 45; flags.push("abandoned"); }
  else if (!goodOutcomes.includes(s.outcome ?? "")) { score -= 20; flags.push("no_resolution"); }

  if (s.avgBotReplySec > 8) { score -= 15; flags.push("slow"); }
  if (s.avgBotReplySec > 20) { score -= 10; } // extra penalty, no second flag

  if (s.messageCount > 40) { score -= 10; flags.push("long"); }

  return { score: Math.max(0, Math.min(100, Math.round(score))), flags };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/convintel-score.test.ts` — Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/convintel/score.ts tests/convintel-score.test.ts
git commit -m "feat(convintel): pure deterministic QA scoring"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Intelligence service

**Files:** Create `src/lib/convintel/service.ts`

- [ ] **Step 1: Create `src/lib/convintel/service.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { scoreConversation, type ConversationSignals } from "./score";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface ScoredConversation {
  id: string; customer_handle: string; customer_name: string | null; outcome: string | null;
  qa_score: number | null; qa_flags: unknown; flagged_for_review: boolean; started_at: string;
}

/** Compute + persist a QA score for one conversation from its messages. */
export async function analyzeConversation(tenantId: string, conversationId: string): Promise<{ ok: boolean }> {
  const sb = svc();
  const { data: conv } = await sb.from("conversations").select("outcome, started_at, ended_at").eq("tenant_id", tenantId).eq("id", conversationId).maybeSingle();
  if (!conv) return { ok: false };
  const { data: msgs } = await sb.from("messages").select("direction, ts").eq("conversation_id", conversationId).order("ts");
  const messages = msgs ?? [];

  const durationSec = conv.ended_at && conv.started_at
    ? Math.max(0, (Date.parse(conv.ended_at as string) - Date.parse(conv.started_at as string)) / 1000)
    : 0;

  // average bot reply latency = mean gap from an inbound message to the next outbound
  let gaps = 0, count = 0;
  for (let i = 1; i < messages.length; i++) {
    if (messages[i - 1].direction === "inbound" && messages[i].direction === "outbound") {
      gaps += (Date.parse(messages[i].ts as string) - Date.parse(messages[i - 1].ts as string)) / 1000;
      count++;
    }
  }
  const avgBotReplySec = count > 0 ? gaps / count : 0;

  const signals: ConversationSignals = { outcome: (conv.outcome as string) ?? null, durationSec, messageCount: messages.length, avgBotReplySec };
  const { score, flags } = scoreConversation(signals);
  await sb.from("conversations").update({ qa_score: score, qa_flags: flags }).eq("tenant_id", tenantId).eq("id", conversationId);
  return { ok: true };
}

/** Score the most recent un-scored conversations (bounded). Returns count scored. */
export async function analyzeRecent(tenantId: string, limit = 50): Promise<{ scored: number }> {
  const sb = svc();
  const { data } = await sb.from("conversations").select("id").eq("tenant_id", tenantId).is("qa_score", null).order("started_at", { ascending: false }).limit(limit);
  let scored = 0;
  for (const c of data ?? []) {
    const r = await analyzeConversation(tenantId, c.id as string);
    if (r.ok) scored++;
  }
  return { scored };
}

/** Full-text-ish search over message text/transcripts, returns matching conversations. */
export async function searchConversations(tenantId: string, q: string, limit = 30): Promise<ScoredConversation[]> {
  const sb = svc();
  const term = q.trim();
  if (!term) return [];
  // Find conversation ids whose messages contain the term (text payload or transcript).
  const { data: msgHits } = await sb
    .from("messages")
    .select("conversation_id, payload, transcript")
    .or(`transcript.ilike.%${term}%,payload->>text.ilike.%${term}%`)
    .limit(500);
  const convIds = [...new Set((msgHits ?? []).map((m) => m.conversation_id as string))];
  if (convIds.length === 0) return [];
  const { data } = await sb
    .from("conversations")
    .select("id, customer_handle, customer_name, outcome, qa_score, qa_flags, flagged_for_review, started_at")
    .eq("tenant_id", tenantId)
    .in("id", convIds)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ScoredConversation[];
}

export async function listFlagged(tenantId: string, limit = 50): Promise<ScoredConversation[]> {
  const { data } = await svc()
    .from("conversations")
    .select("id, customer_handle, customer_name, outcome, qa_score, qa_flags, flagged_for_review, started_at")
    .eq("tenant_id", tenantId)
    .eq("flagged_for_review", true)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ScoredConversation[];
}

export async function flagForReview(tenantId: string, conversationId: string, flagged: boolean): Promise<void> {
  await svc().from("conversations").update({ flagged_for_review: flagged }).eq("tenant_id", tenantId).eq("id", conversationId);
}

export async function submitReview(args: { tenantId: string; conversationId: string; reviewerId: string; rating?: number; label?: string; note?: string }): Promise<void> {
  await svc().from("conversation_reviews").insert({
    tenant_id: args.tenantId, conversation_id: args.conversationId, reviewer_id: args.reviewerId,
    rating: args.rating ?? null, label: args.label ?? null, note: args.note ?? null,
  });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/convintel/service.ts
git commit -m "feat(convintel): analyze, search, flag, review service"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Tenant API routes (gated)

**Files:** Create the four route files; Test `tests/convintel-routes.test.ts`

- [ ] **Step 1: Write the failing test (flag route gating)**

```typescript
// tests/convintel-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/convintel/service", () => ({ flagForReview: vi.fn(async () => {}) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { flagForReview } from "@/lib/convintel/service";
import { POST } from "@/app/api/orgs/[orgId]/intel/[conversationId]/flag/route";

const ctx = { params: Promise.resolve({ orgId: "t1", conversationId: "c1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }

describe("POST flag conversation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flags when entitled + not demo", async () => {
    const res = await POST(req({ flagged: true }), ctx);
    expect(res.status).toBe(200);
    expect(flagForReview).toHaveBeenCalledWith("t1", "c1", true);
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req({ flagged: true }), ctx);
    expect(res.status).toBe(403);
    expect(flagForReview).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req({ flagged: true }), ctx);
    expect(res.status).toBe(403);
    expect(flagForReview).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/convintel-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/intel/analyze/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { analyzeRecent } from "@/lib/convintel/service";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "conversation_intelligence");
  if (feat) return feat;
  const summary = await analyzeRecent(orgId);
  return NextResponse.json({ ok: true, ...summary });
}
```

- [ ] **Step 4: Create `src/app/api/orgs/[orgId]/intel/search/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { requireFeature } from "@/lib/entitlements/guard";
import { searchConversations, listFlagged } from "@/lib/convintel/service";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "conversation_intelligence");
  if (feat) return feat;
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = q.trim() ? await searchConversations(orgId, q) : await listFlagged(orgId);
  return NextResponse.json({ conversations: results });
}
```

- [ ] **Step 5: Create `src/app/api/orgs/[orgId]/intel/[conversationId]/flag/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { flagForReview } from "@/lib/convintel/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "conversation_intelligence");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await flagForReview(orgId, conversationId, Boolean(body.flagged));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create `src/app/api/orgs/[orgId]/intel/[conversationId]/review/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { submitReview } from "@/lib/convintel/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string; conversationId: string }> }) {
  const { orgId, conversationId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "conversation_intelligence");
  if (feat) return feat;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const labels = ["good", "bad_understanding", "too_slow", "wrong_info", "other"];
  await submitReview({
    tenantId: orgId, conversationId, reviewerId: gate.claims.sub,
    rating: typeof b.rating === "number" ? b.rating : undefined,
    label: typeof b.label === "string" && labels.includes(b.label) ? b.label : undefined,
    note: typeof b.note === "string" ? b.note : undefined,
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Run routes test + typecheck**

Run: `npx vitest run tests/convintel-routes.test.ts && npx tsc --noEmit`
Expected: PASS (3 tests); no type errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/orgs/[orgId]/intel" tests/convintel-routes.test.ts
git commit -m "feat(convintel): tenant API — analyze, search, flag, review (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Tenant Intelligence page (gated) + nav

**Files:** Create `src/app/dashboard/intel/page.tsx`, `src/app/dashboard/intel/intel-client.tsx`; Modify `src/app/dashboard/layout.tsx`, `src/components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Create `src/app/dashboard/intel/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listFlagged } from "@/lib/convintel/service";
import { IntelClient } from "./intel-client";

export const metadata = { title: "Intelligence — CabbyBot" };

export default async function IntelPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "conversation_intelligence"))) redirect("/dashboard");
  const flagged = await listFlagged(claims.tenant_id);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Conversation intelligence</h1>
      <p className="mb-4 text-sm text-slate-500">Search transcripts, review QA scores, and flag conversations for coaching.</p>
      <IntelClient orgId={claims.tenant_id} initialFlagged={flagged} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/intel/intel-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Conv { id: string; customer_handle: string; customer_name: string | null; outcome: string | null; qa_score: number | null; qa_flags: unknown; flagged_for_review: boolean; started_at: string }

export function IntelClient(props: { orgId: string; initialFlagged: Conv[]; isDemo: boolean }) {
  const router = useRouter();
  const base = `/api/orgs/${props.orgId}/intel`;
  const [rows, setRows] = useState<Conv[]>(props.initialFlagged);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(url: string, method = "GET", body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`); return null; }
      return b;
    } catch { setErr("Network error."); return null; } finally { setBusy(false); }
  }
  async function search() { const b = await run(`${base}/search?q=${encodeURIComponent(q)}`); if (b) setRows(b.conversations ?? []); }
  async function analyze() { await run(`${base}/analyze`, "POST"); router.refresh(); }
  async function flag(id: string, flagged: boolean) { await run(`${base}/${id}/flag`, "POST", { flagged }); const b = await run(`${base}/search?q=${encodeURIComponent(q)}`); if (b) setRows(b.conversations ?? []); }

  function flagList(f: unknown): string { return Array.isArray(f) ? (f as string[]).join(", ") : ""; }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} placeholder="Search transcripts…" className="w-64 rounded border border-slate-300 px-2 py-1 text-sm" />
        <button disabled={busy} onClick={() => void search()} className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Search</button>
        {!props.isDemo && <button disabled={busy} onClick={() => void analyze()} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700">Re-score recent</button>}
        <span className="text-xs text-slate-400">{q.trim() ? "search results" : "flagged for review"}</span>
        {err && <span className="text-sm text-red-600" role="alert">{err}</span>}
      </div>
      <table className="min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{["Customer", "Outcome", "QA", "Flags", "When", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Nothing to show.</td></tr>}
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2 text-slate-800">{c.customer_name ?? c.customer_handle}</td>
              <td className="px-3 py-2 text-slate-500">{c.outcome ?? "—"}</td>
              <td className="px-3 py-2"><span className={c.qa_score == null ? "text-slate-400" : c.qa_score >= 80 ? "text-emerald-600" : c.qa_score >= 60 ? "text-amber-600" : "text-red-600"}>{c.qa_score ?? "—"}</span></td>
              <td className="px-3 py-2 text-xs text-slate-500">{flagList(c.qa_flags)}</td>
              <td className="px-3 py-2 text-slate-400">{new Date(c.started_at).toLocaleString("en-GB")}</td>
              <td className="px-3 py-2 text-right">{!props.isDemo && <button disabled={busy} onClick={() => void flag(c.id, !c.flagged_for_review)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">{c.flagged_for_review ? "Unflag" : "Flag"}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Gate the nav — modify `src/app/dashboard/layout.tsx`**

Read the file. It already computes `showAlerts`/`showCustomers`/`showLiveops`/`showDispatch` via `hasFeature`. Add `const showIntel = claims.tenant_id ? await hasFeature(claims.tenant_id, "conversation_intelligence") : false;` and pass `showIntel={showIntel}` to `<DashboardShell>`. Reuse existing imports; no second auth call.

- [ ] **Step 4: Modify `src/components/dashboard/dashboard-shell.tsx`**

Read it. It builds `NAV_ITEMS` with conditional spreads. Add a `showIntel?: boolean` prop and extend with `...(showIntel ? [{ label: "Intelligence", href: "/dashboard/intel" }] : [])`. Match the exact `{ label, href }` shape.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/dashboard/intel`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/intel src/app/dashboard/layout.tsx src/components/dashboard/dashboard-shell.tsx
git commit -m "feat(convintel): intelligence dashboard page + entitlement-gated nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Integration gate

- [ ] **Step 1: Run the convintel test set**

Run: `npx vitest run tests/convintel-migration.test.ts tests/convintel-score.test.ts tests/convintel-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(convintel): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Deterministic QA score + flags per conversation | Tasks 2, 3 |
| Persist score on conversations | Tasks 1, 3 |
| Full-text transcript search | Tasks 3, 4 |
| Flag-for-review + flagged queue | Tasks 1, 3, 4, 5 |
| Staff review (rating/label/note) training loop | Tasks 1, 3, 4 |
| Entitlement gate (`conversation_intelligence`) on every surface | Tasks 4, 5 |
| Demo write-block | Task 4 |

**Placeholder scan:** none.

**Type consistency:** `ConversationSignals`/`QaResult`/`QaFlag` (score.ts) used by service.ts. `ScoredConversation` in service.ts used by routes + page. `scoreConversation` pure + deterministic. `requireFeature(tenantId, "conversation_intelligence")` matches Epic 13.

**Known limitations (documented):** scoring is a deterministic heuristic — LLM sentiment/intent extraction (which would set `sentiment`/`intent_summary` and meter `tokens` via `recordUsage`) is a follow-up, honoring the "customer brings own AI key" decision; transcript search uses `ilike` (fine at current scale; a Postgres `tsvector` GIN index is a fast-follow); search interpolates the term into an `.or()` filter — the service MUST treat it as a literal (no SQL injection risk via PostgREST, but commas/parens in the term are sanitised by trimming/escaping in a follow-up).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-04-epic-19-conversation-intelligence.md`.

**6 tasks. Task 1 (schema) gates all; Task 2 (pure) independent; Task 3 depends on 1–2; Task 4 depends on 3; Task 5 depends on 3; Task 6 last.**
