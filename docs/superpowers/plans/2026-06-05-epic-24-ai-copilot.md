# Epic 24: AI Copilot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give tenants a natural-language "ask your data" copilot over their bookings/conversations — they type a question, get an answer grounded in their real data, with every exchange logged and metered. Gated + quota-enforced by the `ai_copilot` entitlement.

**Architecture:** Migration 0030 adds an append-only `copilot_messages` log (question, answer, tokens, cost). A pure layer classifies a question into a known data-intent (revenue / bookings count / top destinations / abandonment / help) and formats a structured result into a natural-language answer — deterministic, no LLM, so v1 is fully testable (a real LLM call using the tenant's own key is a documented follow-up that slots into the same `askCopilot` seam). A service runs the intent's data query, formats the answer, logs the exchange, and `recordUsage("ai_copilot")` with an estimated token count. A tenant API route (gated by `requireQuota("ai_copilot")` + `blockIfDemo`) answers questions; a tenant dashboard "Copilot" chat page surfaces it, shown only when entitled.

**Tech Stack:** Supabase Postgres (RLS + immutability), TypeScript, Next.js App Router, Vitest. Builds on Epic 13 (`requireFeature`/`requireQuota`/`recordUsage`), Epic 9 (`blockIfDemo`). **This is the final epic in the advanced-feature program (13–24).**

**Dependencies:** Epic 13 (`ai_copilot` metered/`tokens` in catalog; `requireQuota`), Epic 9 (`blockIfDemo`). Mirrors the established epic structure.

---

## File Map

### New — Database
- `supabase/migrations/0030_ai_copilot.sql` — `copilot_messages` (append-only)

### New — Core library (`src/lib/copilot/`)
- `src/lib/copilot/classify.ts` — pure `classifyQuestion(text)` + `formatAnswer(intent, data)` + `estimateTokens(text)`
- `src/lib/copilot/service.ts` — `askCopilot`, `listHistory`

### New — Tenant API
- `src/app/api/orgs/[orgId]/copilot/route.ts` — GET history, POST ask

### New — Tenant UI
- `src/app/dashboard/copilot/page.tsx` — chat (gated)
- `src/app/dashboard/copilot/copilot-client.tsx`

### Modified
- `src/app/dashboard/layout.tsx` — compute `showCopilot = hasFeature(tenant_id, "ai_copilot")`, pass to shell
- `src/components/dashboard/dashboard-shell.tsx` — conditional "Copilot" nav entry

### Test files
- `tests/copilot-classify.test.ts` — pure classification + formatting
- `tests/copilot-migration.test.ts` — 0030 structure
- `tests/copilot-routes.test.ts` — ask route gating (demo + entitlement + quota)

---

## Task 1: Migration 0030 — copilot message log

**Files:** Create `supabase/migrations/0030_ai_copilot.sql`; Test `tests/copilot-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/copilot-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0030_ai_copilot.sql"), "utf8");

describe("0030 ai copilot migration", () => {
  it("creates copilot_messages", () => {
    expect(sql).toMatch(/create table public\.copilot_messages/i);
    expect(sql).toMatch(/question\s+text/i);
    expect(sql).toMatch(/answer\s+text/i);
    expect(sql).toMatch(/tokens\s+integer/i);
  });
  it("makes copilot_messages append-only", () => {
    expect(sql).toMatch(/create trigger copilot_messages_immutable/i);
    expect(sql).toMatch(/before update or delete on public\.copilot_messages/i);
  });
  it("enables RLS + tenant select", () => {
    expect(sql).toMatch(/alter table public\.copilot_messages enable row level security/i);
    expect(sql).toMatch(/copilot_messages_select[\s\S]*current_user_tenants\(\)/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/copilot-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0030_ai_copilot.sql`**

```sql
-- 0030: AI copilot.
--
-- Append-only log of copilot Q&A exchanges (mirrors usage_events immutability).
-- tokens/cost_micros feed the ai_copilot metering reconciliation.

create table public.copilot_messages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid references public.users(id) on delete set null,
  question    text not null,
  answer      text not null,
  intent      text,
  tokens      integer not null default 0,
  cost_micros bigint,
  created_at  timestamptz not null default now()
);
create index copilot_messages_tenant_idx on public.copilot_messages (tenant_id, created_at);

alter table public.copilot_messages enable row level security;

create policy copilot_messages_select on public.copilot_messages
  for select using (tenant_id in (select public.current_user_tenants()));

create or replace function public.prevent_copilot_messages_mutation()
returns trigger language plpgsql as $$
begin raise exception 'copilot_messages is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger copilot_messages_immutable
  before update or delete on public.copilot_messages
  for each row execute function public.prevent_copilot_messages_mutation();
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/copilot-migration.test.ts`
Expected: applied; 3 tests PASS. (If `db push` replays a prior migration, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0030_ai_copilot.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0030_ai_copilot.sql tests/copilot-migration.test.ts
git commit -m "feat(copilot): migration 0030 — append-only copilot message log"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure question classification + answer formatting

**Files:** Create `src/lib/copilot/classify.ts`; Test `tests/copilot-classify.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/copilot-classify.test.ts
import { describe, it, expect } from "vitest";
import { classifyQuestion, formatAnswer, estimateTokens, type CopilotIntent } from "@/lib/copilot/classify";

describe("classifyQuestion", () => {
  it("maps revenue questions", () => {
    expect(classifyQuestion("How much revenue did we make this month?")).toBe("revenue");
    expect(classifyQuestion("what were our earnings")).toBe("revenue");
  });
  it("maps bookings-count questions", () => {
    expect(classifyQuestion("How many bookings did we get?")).toBe("bookings_count");
    expect(classifyQuestion("number of rides last week")).toBe("bookings_count");
  });
  it("maps top-destinations questions", () => {
    expect(classifyQuestion("What are the most popular destinations?")).toBe("top_destinations");
  });
  it("maps abandonment questions", () => {
    expect(classifyQuestion("why are customers dropping off / abandoning?")).toBe("abandonment");
  });
  it("falls back to help for anything else", () => {
    expect(classifyQuestion("tell me a joke")).toBe("help");
  });
});

describe("formatAnswer", () => {
  it("renders revenue with currency", () => {
    const a = formatAnswer("revenue", { total: 1234.5, completed: 40 });
    expect(a).toMatch(/£1,?234.50/);
    expect(a).toMatch(/40/);
  });
  it("renders bookings count", () => {
    expect(formatAnswer("bookings_count", { total: 87 })).toMatch(/87/);
  });
  it("lists top destinations", () => {
    const a = formatAnswer("top_destinations", { items: [{ name: "Heathrow", value: 12 }, { name: "City", value: 5 }] });
    expect(a).toMatch(/Heathrow/);
    expect(a).toMatch(/12/);
  });
  it("help lists example questions", () => {
    expect(formatAnswer("help", {})).toMatch(/revenue|bookings|destinations/i);
  });
});

describe("estimateTokens", () => {
  it("approximates ~1 token per 4 chars, min 1", () => {
    expect(estimateTokens("")).toBe(1);
    expect(estimateTokens("12345678")).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/copilot-classify.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/copilot/classify.ts`**

```typescript
export type CopilotIntent = "revenue" | "bookings_count" | "top_destinations" | "abandonment" | "help";

/** Pure: classify a natural-language question into a known data intent (keyword rules). */
export function classifyQuestion(text: string): CopilotIntent {
  const q = text.toLowerCase();
  if (/(revenue|earning|income|turnover|how much.*(made|make|money))/.test(q)) return "revenue";
  if (/(how many|number of|count).*(booking|ride|job|trip)|booking.*(count|total)/.test(q)) return "bookings_count";
  if (/(top|popular|common|most).*(destination|drop ?off|where)/.test(q)) return "top_destinations";
  if (/(abandon|drop ?off|drop ?out|give up|not finish|incomplete)/.test(q)) return "abandonment";
  return "help";
}

function gbp(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Pure: turn an intent + its fetched data into a natural-language answer. */
export function formatAnswer(intent: CopilotIntent, data: Record<string, unknown>): string {
  switch (intent) {
    case "revenue": {
      const total = Number(data.total ?? 0);
      const completed = Number(data.completed ?? 0);
      return `Over the last 30 days you took ${gbp(total)} across ${completed} completed journeys.`;
    }
    case "bookings_count": {
      return `You've had ${Number(data.total ?? 0)} bookings in the last 30 days.`;
    }
    case "top_destinations": {
      const items = Array.isArray(data.items) ? (data.items as { name: string; value: number }[]) : [];
      if (items.length === 0) return "I couldn't find any destination data for the last 30 days.";
      return `Your top destinations (last 30 days): ${items.map((i) => `${i.name} (${i.value})`).join(", ")}.`;
    }
    case "abandonment": {
      const rate = Number(data.rate ?? 0);
      return `Your abandonment rate over the last 30 days is ${rate}%. ${rate > 15 ? "That's on the high side — consider reviewing the booking prompts." : "That's within a healthy range."}`;
    }
    case "help":
    default:
      return "I can answer questions about your data — try: \"How much revenue this month?\", \"How many bookings last week?\", \"What are my top destinations?\", or \"Why are customers abandoning?\".";
  }
}

/** Pure: rough token estimate (~1 token / 4 chars), minimum 1. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/copilot-classify.test.ts` — Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/copilot/classify.ts tests/copilot-classify.test.ts
git commit -m "feat(copilot): pure question classification + answer formatting"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Copilot service

**Files:** Create `src/lib/copilot/service.ts`

- [ ] **Step 1: Create `src/lib/copilot/service.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { classifyQuestion, formatAnswer, estimateTokens, type CopilotIntent } from "./classify";
import { recordUsage } from "@/lib/entitlements/meter";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface CopilotTurn { id: string; question: string; answer: string; intent: string | null; created_at: string }

const SINCE = () => new Date(Date.now() - 30 * 86400_000).toISOString();

/** Fetch the data needed to answer a given intent for a tenant (last 30 days). */
async function fetchData(tenantId: string, intent: CopilotIntent): Promise<Record<string, unknown>> {
  const sb = svc();
  if (intent === "revenue") {
    const { data } = await sb.from("bookings").select("fare, status").eq("tenant_id", tenantId).gte("created_at", SINCE());
    const rows = data ?? [];
    return { total: rows.reduce((s, r) => s + (Number(r.fare) || 0), 0), completed: rows.filter((r) => r.status === "completed").length };
  }
  if (intent === "bookings_count") {
    const { count } = await sb.from("bookings").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", SINCE());
    return { total: count ?? 0 };
  }
  if (intent === "top_destinations") {
    const { data } = await sb.from("bookings").select("destination_address").eq("tenant_id", tenantId).gte("created_at", SINCE());
    const counts = new Map<string, number>();
    for (const r of data ?? []) {
      const dest = (r.destination_address as { formatted?: string; name?: string } | null);
      const name = dest?.name ?? dest?.formatted;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const items = [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
    return { items };
  }
  if (intent === "abandonment") {
    const { data } = await sb.from("conversations").select("outcome").eq("tenant_id", tenantId).gte("started_at", SINCE());
    const rows = data ?? [];
    const rate = rows.length === 0 ? 0 : +((rows.filter((r) => r.outcome === "abandoned").length / rows.length) * 100).toFixed(1);
    return { rate };
  }
  return {};
}

/**
 * Answer a question: classify → fetch data → format → log the exchange → meter.
 * v1 is deterministic (no LLM). A future LLM path slots in here, using the
 * tenant's own AI key, and would set richer tokens/cost.
 */
export async function askCopilot(tenantId: string, userId: string, question: string): Promise<{ answer: string; intent: CopilotIntent }> {
  const intent = classifyQuestion(question);
  const data = await fetchData(tenantId, intent);
  const answer = formatAnswer(intent, data);
  const tokens = estimateTokens(question) + estimateTokens(answer);
  await svc().from("copilot_messages").insert({ tenant_id: tenantId, user_id: userId, question, answer, intent, tokens });
  await recordUsage({ tenantId, featureKey: "ai_copilot", quantity: tokens, unit: "tokens" });
  return { answer, intent };
}

export async function listHistory(tenantId: string, limit = 30): Promise<CopilotTurn[]> {
  const { data } = await svc().from("copilot_messages").select("id, question, answer, intent, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as CopilotTurn[];
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/copilot/service.ts
git commit -m "feat(copilot): askCopilot (classify → query → format → log → meter) + history"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Tenant API route (gated + quota)

**Files:** Create `src/app/api/orgs/[orgId]/copilot/route.ts`; Test `tests/copilot-routes.test.ts`

- [ ] **Step 1: Write the failing test (ask route gating + quota)**

```typescript
// tests/copilot-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireQuota: vi.fn(async () => null) }));
vi.mock("@/lib/copilot/service", () => ({ askCopilot: vi.fn(async () => ({ answer: "You took £100.", intent: "revenue" })), listHistory: vi.fn(async () => []) }));

import { requireQuota } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { askCopilot } from "@/lib/copilot/service";
import { POST } from "@/app/api/orgs/[orgId]/copilot/route";

const ctx = { params: Promise.resolve({ orgId: "t1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }

describe("POST copilot ask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers when entitled (under quota) + not demo", async () => {
    const res = await POST(req({ question: "revenue this month?" }), ctx);
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.answer).toMatch(/£100/);
    expect(askCopilot).toHaveBeenCalledWith("t1", "u1", "revenue this month?");
  });
  it("400 when question is empty", async () => {
    const res = await POST(req({ question: "" }), ctx);
    expect(res.status).toBe(400);
    expect(askCopilot).not.toHaveBeenCalled();
  });
  it("403/429 from requireQuota short-circuits (feature off or over budget)", async () => {
    vi.mocked(requireQuota).mockResolvedValueOnce(new Response("no", { status: 429 }) as unknown as null);
    const res = await POST(req({ question: "revenue?" }), ctx);
    expect(res.status).toBe(429);
    expect(askCopilot).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req({ question: "revenue?" }), ctx);
    expect(res.status).toBe(403);
    expect(askCopilot).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/copilot-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/copilot/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireQuota } from "@/lib/entitlements/guard";
import { askCopilot, listHistory } from "@/lib/copilot/service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const block = await requireQuota(gate.claims.tenant_id, "ai_copilot");
  if (block) return block;
  return NextResponse.json({ history: await listHistory(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const block = await requireQuota(gate.claims.tenant_id, "ai_copilot");
  if (block) return block;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const question = String(b.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  const result = await askCopilot(orgId, gate.claims.sub, question);
  return NextResponse.json({ ok: true, answer: result.answer, intent: result.intent });
}
```

- [ ] **Step 4: Run routes test + typecheck**

Run: `npx vitest run tests/copilot-routes.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests); no type errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/orgs/[orgId]/copilot" tests/copilot-routes.test.ts
git commit -m "feat(copilot): tenant API — ask + history (gated + quota-enforced)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Tenant Copilot page (gated) + nav

**Files:** Create `src/app/dashboard/copilot/page.tsx`, `src/app/dashboard/copilot/copilot-client.tsx`; Modify `src/app/dashboard/layout.tsx`, `src/components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Create `src/app/dashboard/copilot/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listHistory } from "@/lib/copilot/service";
import { CopilotClient } from "./copilot-client";

export const metadata = { title: "Copilot — BookMyCab" };

export default async function CopilotPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "ai_copilot"))) redirect("/dashboard");
  const history = await listHistory(claims.tenant_id, 10);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Copilot</h1>
      <p className="mb-4 text-sm text-slate-500">Ask questions about your bookings and conversations.</p>
      <CopilotClient orgId={claims.tenant_id} history={history} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/copilot/copilot-client.tsx`**

```tsx
"use client";
import { useState } from "react";

interface Turn { id: string; question: string; answer: string; intent: string | null; created_at: string }
const SUGGESTIONS = ["How much revenue this month?", "How many bookings last week?", "What are my top destinations?", "Why are customers abandoning?"];

export function CopilotClient(props: { orgId: string; history: Turn[]; isDemo: boolean }) {
  const [turns, setTurns] = useState<{ q: string; a: string }[]>(
    [...props.history].reverse().map((t) => ({ q: t.question, a: t.answer })),
  );
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function ask(question: string) {
    if (!question.trim() || props.isDemo) return;
    setBusy(true); setErr(null);
    setTurns((t) => [...t, { q: question, a: "…" }]);
    try {
      const res = await fetch(`/api/orgs/${props.orgId}/copilot`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 429 ? "You've reached your copilot limit for this period." : typeof b.error === "string" ? b.error : `Failed (${res.status})`;
        setErr(msg);
        setTurns((t) => t.slice(0, -1));
      } else {
        setTurns((t) => [...t.slice(0, -1), { q: question, a: String(b.answer ?? "") }]);
      }
    } catch { setErr("Network error."); setTurns((t) => t.slice(0, -1)); } finally { setBusy(false); setQ(""); }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-3 min-h-[200px] space-y-3 rounded-lg border border-slate-200 p-4">
        {turns.length === 0 && <p className="text-sm text-slate-400">Ask your first question below.</p>}
        {turns.map((t, i) => (
          <div key={i} className="space-y-1">
            <p className="text-sm font-medium text-slate-800">🧑 {t.q}</p>
            <p className="text-sm text-blue-800">🤖 {t.a}</p>
          </div>
        ))}
      </div>
      {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
      {props.isDemo ? <p className="text-sm text-slate-400">Disabled in demo.</p> : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your data…" className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm" />
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "…" : "Ask"}</button>
          </form>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <button key={s} disabled={busy} onClick={() => void ask(s)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50">{s}</button>)}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Gate the nav — modify `src/app/dashboard/layout.tsx`**

Add `const showCopilot = claims.tenant_id ? await hasFeature(claims.tenant_id, "ai_copilot") : false;` and pass `showCopilot={showCopilot}` to `<DashboardShell>`. Reuse existing imports; no second auth call.

- [ ] **Step 4: Modify `src/components/dashboard/dashboard-shell.tsx`**

Add a `showCopilot?: boolean` prop and extend `NAV_ITEMS` with `...(showCopilot ? [{ label: "Copilot", href: "/dashboard/copilot" }] : [])`. Match the exact `{ label, href }` shape.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/dashboard/copilot`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/copilot src/app/dashboard/layout.tsx src/components/dashboard/dashboard-shell.tsx
git commit -m "feat(copilot): copilot chat dashboard page + entitlement-gated nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Integration gate (+ program completion)

- [ ] **Step 1: Run the copilot test set**

Run: `npx vitest run tests/copilot-migration.test.ts tests/copilot-classify.test.ts tests/copilot-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 4: Verify the dashboard-structure guard still passes**

Run: `npx vitest run tests/dashboard-structure.test.ts`
Expected: PASS (the copilot page imports only from the service — no service-role key on the page).

- [ ] **Step 5: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(copilot): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Natural-language "ask your data" over real bookings/conversations | Tasks 2, 3 |
| Deterministic v1 (no LLM dependency; LLM follow-up seam) | Tasks 2, 3 |
| Append-only Q&A log | Task 1 |
| Metering of copilot usage (`ai_copilot` tokens) | Task 3 (recordUsage) |
| Quota enforcement (`requireQuota`) | Task 4 |
| Entitlement gate on every surface | Tasks 4, 5 |
| Demo write-block | Task 4 |

**Placeholder scan:** none.

**Type consistency:** `CopilotIntent` (classify.ts) used by service.ts. `CopilotTurn` in service.ts used by route + page. `askCopilot` returns `{ answer, intent }`. `requireQuota(tenantId, "ai_copilot")` (403 when off, 429 over budget) matches Epic 13. Page imports only service functions (no service-role key — dashboard-structure guard).

**Known limitations (documented):** v1 answers a fixed set of intents via keyword classification — an LLM path (using the tenant's own AI key, per the locked Q1 decision) slots into `askCopilot` to handle open-ended questions and set real token/cost figures; token counts are estimated (`estimateTokens`), reconciled against the append-only log later; no conversational memory across turns yet.

---

## Program Completion

**This is the final epic (24 of the advanced-feature program 13–24).** After merge, all 12 advanced epics are complete: a feature-entitlement/metering foundation plus 11 entitlement-gated tenant features and the supporting admin control surfaces.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-epic-24-ai-copilot.md`.

**6 tasks. Task 1 (schema) gates all; Task 2 (pure) independent; Task 3 depends on 1–2; Task 4 depends on 3; Task 5 depends on 3; Task 6 last.**
