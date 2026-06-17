# AI Voice Prompt-Tuning Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Failure reasons over time" section on the AI Voice **Agent quality** page with a **Prompt-tuning suggestions** section (below the Call Inspector) that runs a *suggest → preview → request → approve → measure → rollback* loop: a detector clusters a rising failure reason and drafts a revised system prompt via LLM, the tenant operator previews the diff + evidence and **raises it to FlowMo admin**, and only FlowMo staff apply it (PATCH Vapi) — writing a versioned, reversible `prompt_revision` trail with one-click rollback.

**Architecture:** Two new Supabase tables — `prompt_suggestions` (the detector's drafts + the operator→admin handoff) and `prompt_revisions` (the applied, versioned, reversible change log per Vapi assistant). A new server-only Vapi REST client reads/patches the assistant system prompt. The detector reuses the existing call-flagging logic (`reviewReasons`) to cluster failures per agent, then drafts a revision with Gemini (same pattern as the weekly briefing). The tenant panel previews + raises; a new `/admin/prompt-tuning` console lets staff apply/roll back; the admin notification bell surfaces new requests; a cron route detects new suggestions and measures/auto-rolls-back applied revisions.

**Tech Stack:** Next.js 15 App Router (RSC + server actions), TypeScript, Supabase (PostgreSQL + RLS, service-role writes), `@google/genai` (Gemini structured output), Vapi REST API, Tailwind v4 Neo-Brutalism tokens, Vitest.

---

## Context the engineer needs before starting

**The page being changed:** [src/app/dashboard/voice/quality/page.tsx](src/app/dashboard/voice/quality/page.tsx). It renders an `AgentQualityBoard` that pairs `FailureClusters` ("Failure reasons over time") with the `CallInspector`. We remove `FailureClusters` + `AgentQualityBoard`, render `CallInspector` directly, and add the new `PromptTuningPanel` below it.

**Data layer:** [src/lib/voice/quality.ts](src/lib/voice/quality.ts) computes `getVoiceQuality()`. Its private `reviewReasons()` (lines 115-124) maps a call row to flag reasons + severity (the five reasons: `System error`, `Caller abandoned`, `Repeated address confusion`, `Unusually long`, `Goal not met`). We **export** it and reuse it in the detector. We **remove** the `failures`/`FailureSummary`/`FailureCluster` machinery (only `FailureClusters`/`AgentQualityBoard`/the page consume it — confirmed by grep).

**Voice agent ↔ Vapi:** `voice_agents` (migration [0035](supabase/migrations/0035_voice_agents.sql)) is 1:1 with a `type='Voice'` automation; it carries `vapi_assistant_id` (added in [0047](supabase/migrations/0047_vapi_call_analysis.sql)). `calls.automation_id` ties each call to its agent. There is **no** Vapi client yet — only the assistant id is stored.

**Patterns to mirror:**
- LLM call + structured output + graceful no-op when no key: [src/lib/voice/briefing.ts](src/lib/voice/briefing.ts).
- Cron route auth (bearer == `VOICE_INGEST_SECRET`): [src/app/api/voice/briefing/generate/route.ts](src/app/api/voice/briefing/generate/route.ts) + `bearerMatches` in [src/lib/voice/ingest-auth.ts](src/lib/voice/ingest-auth.ts).
- Service-role write client + `requireStaff` + `writeAudit`: [src/app/admin/tenants/[tenantId]/actions.ts](src/app/admin/tenants/[tenantId]/actions.ts) (`serviceClient()`, lines 29-34), [src/lib/admin/guard.ts](src/lib/admin/guard.ts), [src/lib/admin/audit.ts](src/lib/admin/audit.ts).
- Tenant server action shape (`requireUser`, `is_demo` block, service-role write, `revalidatePath`): [src/app/dashboard/voice/quality/actions.ts](src/app/dashboard/voice/quality/actions.ts) (`updateCallReviewStatus`).
- RLS pattern (tenant `select` via `current_user_tenants()`, no write policy): [0062_call_reviews.sql](supabase/migrations/0062_call_reviews.sql).
- Admin nav: [src/components/admin/admin-shell.tsx](src/components/admin/admin-shell.tsx) (`NAV_GROUPS`). Admin notifications: [src/app/admin/api/notifications/route.ts](src/app/admin/api/notifications/route.ts) + `NotifKind` in [src/components/dashboard/notification-bell.tsx](src/components/dashboard/notification-bell.tsx).

**Design tokens (globals.css):** ink `#0a0a0a`, paper `#fff`, accents `bg-brut-{yellow,lime,cyan,violet,orange,red,pink,blue}`; brutalist frames use `border-[3px] border-ink shadow-brut`; helpers `brut-focus`, `brut-press`. **Always dark ink text on yellow.** This page's sections use `bg-brut-orange`/`bg-brut-yellow` headers — give the new panel a distinct `bg-brut-violet` header.

**Claims shape** ([src/middleware/access.ts](src/middleware/access.ts)): `{ sub, tenant_id, role: "Owner"|"Admin"|"Viewer"|null, is_flowmo_staff, is_demo, ... }`.

**Verification rule (project memory):** after server-action / route / `"use server"` changes, run `npm run build` — `tsc` alone misses Next's server constraints.

**Migrations are plain SQL files** applied out-of-band; the next number is **0067**. There is no local DB in this loop — verify migrations with a **structural test** (see existing [tests/voice-metering-migration.test.ts](tests/voice-metering-migration.test.ts)).

---

## File Structure

**Create:**
- `supabase/migrations/0067_prompt_tuning.sql` — `prompt_suggestions` + `prompt_revisions` tables, RLS, indexes.
- `src/lib/voice/vapi.ts` — server-only Vapi REST client (get/patch assistant system prompt).
- `src/lib/voice/prompt-diff.ts` — pure line-diff (`diffLines`).
- `src/lib/voice/prompt-tuning.ts` — types, pure `pickRisingReason`, detector, reads, apply/rollback/measure.
- `src/components/dashboard/voice/prompt-diff.tsx` — renders a `diffLines` result.
- `src/components/dashboard/voice/prompt-tuning-panel.tsx` — tenant "Prompt-tuning suggestions" section.
- `src/app/admin/prompt-tuning/page.tsx` — staff inbox (requests + active revisions).
- `src/app/admin/prompt-tuning/prompt-request-board.tsx` — client board with Apply / Roll back.
- `src/app/admin/prompt-tuning/actions.ts` — `applyPromptSuggestion`, `rollbackPromptRevision`, `declinePromptSuggestion` (staff-only).
- `src/app/api/voice/prompt-tuning/cron/route.ts` — detect + measure sweep (bearer-gated).
- Tests: `tests/prompt-tuning-migration.test.ts`, `tests/vapi-client.test.ts`, `tests/prompt-diff.test.ts`, `tests/prompt-tuning-detector.test.ts`.

**Modify:**
- `src/env.ts` — add `VAPI_API_KEY`, `VAPI_BASE_URL` (+ `rawSource`).
- `src/lib/voice/quality.ts` — export `reviewReasons` + its row-pick type; remove `failures`/`FailureSummary`/`FailureCluster`.
- `src/app/dashboard/voice/quality/page.tsx` — drop `AgentQualityBoard`; render `CallInspector` + `PromptTuningPanel`.
- `src/app/dashboard/voice/quality/actions.ts` — add `runPromptDetection`, `requestPromptSuggestion`, `dismissPromptSuggestion`.
- `src/components/admin/admin-shell.tsx` — add "Prompt tuning" nav item.
- `src/app/admin/api/notifications/route.ts` — surface `prompt_request` items.
- `src/components/dashboard/notification-bell.tsx` — add `prompt_request` kind (accent + icon).

**Delete:**
- `src/components/dashboard/voice/failure-clusters.tsx`
- `src/components/dashboard/voice/agent-quality-board.tsx`

---

## Task 1: Database migration — prompt_suggestions + prompt_revisions

**Files:**
- Create: `supabase/migrations/0067_prompt_tuning.sql`
- Test: `tests/prompt-tuning-migration.test.ts`

- [ ] **Step 1: Write the failing structural test**

```typescript
// tests/prompt-tuning-migration.test.ts
// Structural assertions for 0067 prompt-tuning tables. Runtime behaviour is
// verified out-of-band at apply time; this guards the contract the app code
// relies on (column names, statuses, RLS shape).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0067_prompt_tuning.sql"),
  "utf8",
);

describe("0067 prompt tuning", () => {
  it("creates prompt_suggestions with the handoff lifecycle", () => {
    expect(sql).toMatch(/create table public\.prompt_suggestions/i);
    expect(sql).toMatch(/status\s+text not null default 'draft'/i);
    expect(sql).toMatch(/check \(status in \('draft','requested','applied','dismissed','superseded'\)\)/i);
    expect(sql).toMatch(/evidence_call_ids\s+uuid\[\]/i);
    expect(sql).toMatch(/old_prompt\s+text not null/i);
    expect(sql).toMatch(/new_prompt\s+text not null/i);
    expect(sql).toMatch(/operator_note\s+text/i);
    expect(sql).toMatch(/requested_by\s+uuid/i);
  });

  it("keeps only one open suggestion per agent + reason", () => {
    expect(sql).toMatch(/create unique index prompt_suggestions_open_uniq[\s\S]*\(automation_id, reason\)[\s\S]*where status in \('draft','requested'\)/i);
  });

  it("creates prompt_revisions as a versioned, reversible trail", () => {
    expect(sql).toMatch(/create table public\.prompt_revisions/i);
    expect(sql).toMatch(/revision\s+integer not null/i);
    expect(sql).toMatch(/kind\s+text not null default 'apply'[\s\S]*check \(kind in \('apply','rollback'\)\)/i);
    expect(sql).toMatch(/status\s+text not null default 'active'[\s\S]*check \(status in \('active','superseded','rolled_back'\)\)/i);
    expect(sql).toMatch(/parent_revision_id\s+uuid references public\.prompt_revisions/i);
    expect(sql).toMatch(/baseline_flagged_rate\s+numeric/i);
    expect(sql).toMatch(/measured_flagged_rate\s+numeric/i);
    expect(sql).toMatch(/create unique index prompt_revisions_assistant_rev_uniq on public\.prompt_revisions \(vapi_assistant_id, revision\)/i);
  });

  it("enables RLS with tenant select + no write policy on both tables", () => {
    expect(sql).toMatch(/alter table public\.prompt_suggestions enable row level security/i);
    expect(sql).toMatch(/alter table public\.prompt_revisions enable row level security/i);
    expect(sql).toMatch(/create policy prompt_suggestions_select on public\.prompt_suggestions[\s\S]*current_user_tenants\(\)/i);
    expect(sql).toMatch(/create policy prompt_revisions_select on public\.prompt_revisions[\s\S]*current_user_tenants\(\)/i);
    // No write policies → writes are service-role only.
    expect(sql).not.toMatch(/for insert|for update|for delete/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/prompt-tuning-migration.test.ts`
Expected: FAIL — `ENOENT` (the migration file does not exist yet).

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/0067_prompt_tuning.sql
-- 0067: AI Voice prompt-tuning loop (suggest → request → apply → measure → rollback).
--
-- prompt_suggestions: the detector's drafted prompt revisions per Voice agent,
-- plus the operator→FlowMo handoff (a tenant operator "raises" a draft to admin;
-- only FlowMo staff resolve it). prompt_revisions: the versioned, reversible log
-- of prompt changes actually applied to a Vapi assistant (who/when/why/diff),
-- with measurement fields for one-click + auto rollback. Both are tenant-readable
-- (RLS select) but write-only via the service role (server actions / cron).

create table public.prompt_suggestions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  automation_id     uuid not null references public.automations(id) on delete cascade,
  vapi_assistant_id text,
  reason            text not null,
  reason_count      integer not null default 0,
  reason_delta_pct  integer,
  baseline_flagged_rate numeric,
  old_prompt        text not null,
  new_prompt        text not null,
  rationale         text,
  evidence_call_ids uuid[] not null default '{}',
  model             text,
  status            text not null default 'draft'
                    check (status in ('draft','requested','applied','dismissed','superseded')),
  -- operator → admin handoff
  requested_by      uuid,
  requested_at      timestamptz,
  operator_note     text,
  -- admin resolution
  resolved_by       uuid,
  resolved_at       timestamptz,
  revision_id       uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- One live suggestion per agent+reason so re-detection refreshes rather than piling up.
create unique index prompt_suggestions_open_uniq
  on public.prompt_suggestions (automation_id, reason)
  where status in ('draft','requested');
create index prompt_suggestions_tenant_status_idx on public.prompt_suggestions (tenant_id, status);
create index prompt_suggestions_requested_idx on public.prompt_suggestions (status, requested_at desc);

create table public.prompt_revisions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  automation_id         uuid not null references public.automations(id) on delete cascade,
  vapi_assistant_id     text not null,
  revision              integer not null,
  old_prompt            text not null,
  new_prompt            text not null,
  reason                text,
  rationale             text,
  source_suggestion_id  uuid references public.prompt_suggestions(id) on delete set null,
  kind                  text not null default 'apply' check (kind in ('apply','rollback')),
  parent_revision_id    uuid references public.prompt_revisions(id) on delete set null,
  status                text not null default 'active' check (status in ('active','superseded','rolled_back')),
  baseline_flagged_rate numeric,
  measured_flagged_rate numeric,
  measured_at           timestamptz,
  applied_by            uuid,
  applied_at            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);
create unique index prompt_revisions_assistant_rev_uniq on public.prompt_revisions (vapi_assistant_id, revision);
create index prompt_revisions_assistant_status_idx on public.prompt_revisions (vapi_assistant_id, status);
create index prompt_revisions_tenant_idx on public.prompt_revisions (tenant_id);

-- prompt_suggestions.revision_id points at the revision created on apply.
alter table public.prompt_suggestions
  add constraint prompt_suggestions_revision_fk
  foreign key (revision_id) references public.prompt_revisions(id) on delete set null;

-- RLS: tenant may read its own rows; all writes go through the service role
-- (server actions + cron). No insert/update/delete policies on purpose.
alter table public.prompt_suggestions enable row level security;
alter table public.prompt_revisions enable row level security;

create policy prompt_suggestions_select on public.prompt_suggestions
  for select using (tenant_id in (select public.current_user_tenants()));
create policy prompt_revisions_select on public.prompt_revisions
  for select using (tenant_id in (select public.current_user_tenants()));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/prompt-tuning-migration.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0067_prompt_tuning.sql tests/prompt-tuning-migration.test.ts
git commit -m "feat(voice): prompt-tuning tables (suggestions + reversible revisions)"
```

---

## Task 2: Vapi client + env

**Files:**
- Modify: `src/env.ts:42-44` (after `BRIEFING_MODEL`) and `src/env.ts:98-99` (`rawSource`)
- Create: `src/lib/voice/vapi.ts`
- Test: `tests/vapi-client.test.ts`

- [ ] **Step 1: Add the env vars**

In [src/env.ts](src/env.ts), inside the `schema` object, immediately after the `BRIEFING_MODEL` line (line 44), add:

```typescript
  // Vapi — server-only key for reading/patching a Voice agent's system prompt
  // when FlowMo staff apply a prompt-tuning revision. Optional: absent → the
  // apply/rollback actions report "Vapi is not configured" instead of crashing.
  VAPI_API_KEY: z.string().optional(),
  VAPI_BASE_URL: z.string().url().default("https://api.vapi.ai"),
```

In the `rawSource` object, after the `BRIEFING_MODEL` line (line 99), add:

```typescript
  VAPI_API_KEY: process.env.VAPI_API_KEY,
  VAPI_BASE_URL: process.env.VAPI_BASE_URL,
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/vapi-client.test.ts
// The Vapi client merges a new system prompt into the assistant's existing
// model.messages without dropping other roles/config, and PATCHes it back.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// env validates at import; give it the minimum so importing the module works.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://x.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "service";
process.env.VOICE_INGEST_SECRET ||= "secret";
process.env.VAPI_API_KEY = "vapi-test-key";

import { extractSystemPrompt, setSystemPrompt, getSystemPrompt } from "@/lib/voice/vapi";

describe("vapi client", () => {
  it("extracts the system message content", () => {
    const a = { id: "a1", model: { messages: [{ role: "system", content: "old" }, { role: "user", content: "hi" }] } };
    expect(extractSystemPrompt(a)).toBe("old");
  });

  it("returns '' when there is no system message", () => {
    expect(extractSystemPrompt({ id: "a1", model: { messages: [{ role: "user", content: "hi" }] } })).toBe("");
    expect(extractSystemPrompt({ id: "a1" })).toBe("");
  });

  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { fetchSpy = vi.spyOn(globalThis, "fetch"); });
  afterEach(() => { fetchSpy.mockRestore(); });

  it("getSystemPrompt GETs the assistant with bearer auth", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "a1", model: { messages: [{ role: "system", content: "live" }] } }), { status: 200 }),
    );
    const prompt = await getSystemPrompt("a1");
    expect(prompt).toBe("live");
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/assistant/a1");
    expect((init as RequestInit).method ?? "GET").toBe("GET");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer vapi-test-key" });
  });

  it("setSystemPrompt GETs then PATCHes a merged model.messages", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          id: "a1",
          model: { provider: "openai", model: "gpt-4o", messages: [{ role: "system", content: "old" }, { role: "user", content: "ctx" }] },
        }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await setSystemPrompt("a1", "brand new prompt");

    const [, patchInit] = fetchSpy.mock.calls[1];
    expect((patchInit as RequestInit).method).toBe("PATCH");
    const body = JSON.parse((patchInit as RequestInit).body as string);
    // Preserves other model fields + the non-system message, swaps system content.
    expect(body.model.provider).toBe("openai");
    expect(body.model.messages).toEqual([
      { role: "system", content: "brand new prompt" },
      { role: "user", content: "ctx" },
    ]);
  });

  it("throws a clear error on a non-2xx Vapi response", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 404 }));
    await expect(getSystemPrompt("missing")).rejects.toThrow(/Vapi/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/vapi-client.test.ts`
Expected: FAIL — cannot resolve `@/lib/voice/vapi`.

- [ ] **Step 4: Write the Vapi client**

```typescript
// src/lib/voice/vapi.ts
import "server-only";
import { env } from "@/env";

export interface VapiMessage {
  role: string;
  content: string;
  [k: string]: unknown;
}
export interface VapiAssistant {
  id: string;
  model?: { messages?: VapiMessage[]; [k: string]: unknown };
  [k: string]: unknown;
}

/** True when a Vapi key is configured; callers degrade gracefully when false. */
export function vapiConfigured(): boolean {
  return Boolean(env.VAPI_API_KEY);
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" };
}

async function vapiFetch(path: string, init?: RequestInit): Promise<unknown> {
  if (!env.VAPI_API_KEY) throw new Error("Vapi is not configured (VAPI_API_KEY missing).");
  const res = await fetch(`${env.VAPI_BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vapi ${init?.method ?? "GET"} ${path} failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

/** Fetch the full assistant object. */
export async function getAssistant(assistantId: string): Promise<VapiAssistant> {
  return (await vapiFetch(`/assistant/${assistantId}`)) as VapiAssistant;
}

/** The current system-prompt text, or "" if the assistant has no system message. */
export function extractSystemPrompt(a: VapiAssistant): string {
  return a.model?.messages?.find((m) => m.role === "system")?.content ?? "";
}

export async function getSystemPrompt(assistantId: string): Promise<string> {
  return extractSystemPrompt(await getAssistant(assistantId));
}

/**
 * Replace the assistant's system prompt. Vapi's `model` is a nested object, so we
 * GET it first, swap the system message in `model.messages` (preserving every
 * other field + message), and PATCH the whole `model` back.
 */
export async function setSystemPrompt(assistantId: string, prompt: string): Promise<void> {
  const a = await getAssistant(assistantId);
  const messages: VapiMessage[] = [...(a.model?.messages ?? [])];
  const i = messages.findIndex((m) => m.role === "system");
  if (i >= 0) messages[i] = { ...messages[i], content: prompt };
  else messages.unshift({ role: "system", content: prompt });
  await vapiFetch(`/assistant/${assistantId}`, {
    method: "PATCH",
    body: JSON.stringify({ model: { ...(a.model ?? {}), messages } }),
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/vapi-client.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/env.ts src/lib/voice/vapi.ts tests/vapi-client.test.ts
git commit -m "feat(voice): Vapi client for reading/patching the assistant system prompt"
```

---

## Task 3: Remove "Failure reasons over time" from Agent quality

**Files:**
- Modify: `src/lib/voice/quality.ts` (export `reviewReasons` + row-pick type; remove `failures` machinery)
- Modify: `src/app/dashboard/voice/quality/page.tsx`
- Delete: `src/components/dashboard/voice/failure-clusters.tsx`, `src/components/dashboard/voice/agent-quality-board.tsx`

- [ ] **Step 1: Export `reviewReasons` + add a shared row-pick type in quality.ts**

In [src/lib/voice/quality.ts](src/lib/voice/quality.ts), add an exported type above `reviewReasons` (after the `Row` type, line 108) and export the function. Replace the function signature line 115:

```typescript
/** The minimal call fields the flagging logic needs (shared with the detector). */
export type FlagInput = Pick<Row, "outcome" | "duration_s" | "success" | "address_lookups">;

/** Flags + severity for a struggled call. Empty array = not flagged. */
export function reviewReasons(r: FlagInput): { reasons: string[]; severity: number } {
```

(Leave the body unchanged.) Update the two internal call sites that used the inline `Pick<...>` type for `priorRows` (line 159) to use `FlagInput`:

```typescript
  const priorRows = (priorRes.data ?? []) as FlagInput[];
```

- [ ] **Step 2: Remove the `failures` machinery from quality.ts**

Delete the `FailureCluster` interface (lines 66-77) and `FailureSummary` interface (lines 79-84). In the `VoiceQuality` interface, remove the `failures: FailureSummary;` line (line 93). Delete the entire "Failure-reason clustering over time" block (lines 285-319, from the comment `// ---- Failure-reason clustering over time ----` through `const failures: FailureSummary = ...`). Update the final return (line 321) to drop `failures`:

```typescript
  return { rangeDays: cycle ? cycle.days : rangeDays, performance, review, sentiment, loyalty, recent };
```

The `priorRes` query (lines 152-156) is now only used for nothing else — **keep it removed too**: delete the third element of the `Promise.all` (the prior-window `calls` query) and the `priorRows` line, and change the destructure to `const [callsRes, reviewsRes] = await Promise.all([...])`. Also delete the now-unused `priorStartIso`/`windowStartIso`/`windowDays` computation (lines 139-142). Run `npm run typecheck` after to confirm no other references remain.

- [ ] **Step 3: Update the page to drop FailureClusters and render CallInspector directly**

In [src/app/dashboard/voice/quality/page.tsx](src/app/dashboard/voice/quality/page.tsx), replace the `AgentQualityBoard` import (line 7) with:

```typescript
import { CallInspector } from "@/components/dashboard/voice/call-inspector";
```

Replace the board usage (line 68) with the Call Inspector alone (the new panel is added in Task 6):

```tsx
          <CallInspector items={data.recent} windowLabel={cycleLabel} />
```

- [ ] **Step 4: Delete the two dead components**

```bash
git rm src/components/dashboard/voice/failure-clusters.tsx src/components/dashboard/voice/agent-quality-board.tsx
```

- [ ] **Step 5: Verify the build (tsc misses Next server constraints)**

Run: `npm run build`
Expected: build succeeds, no references to `failures` / `AgentQualityBoard` / `FailureClusters` remain. If the build flags an unused `failures`-related symbol, remove it.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(voice): drop 'Failure reasons over time' from Agent quality"
```

---

## Task 4: Prompt-diff (pure) + its renderer

**Files:**
- Create: `src/lib/voice/prompt-diff.ts`
- Create: `src/components/dashboard/voice/prompt-diff.tsx`
- Test: `tests/prompt-diff.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/prompt-diff.test.ts
import { describe, it, expect } from "vitest";
import { diffLines } from "@/lib/voice/prompt-diff";

describe("diffLines", () => {
  it("marks unchanged lines as same", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ]);
  });

  it("marks a changed line as remove then add", () => {
    expect(diffLines("a\nb\nc", "a\nB\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "remove", text: "b" },
      { type: "add", text: "B" },
      { type: "same", text: "c" },
    ]);
  });

  it("handles pure insertions and deletions", () => {
    expect(diffLines("a", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "add", text: "b" },
    ]);
    expect(diffLines("a\nb", "a")).toEqual([
      { type: "same", text: "a" },
      { type: "remove", text: "b" },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/prompt-diff.test.ts`
Expected: FAIL — cannot resolve `@/lib/voice/prompt-diff`.

- [ ] **Step 3: Write the pure line diff (LCS-based)**

```typescript
// src/lib/voice/prompt-diff.ts
export type DiffLine = { type: "same" | "add" | "remove"; text: string };

/**
 * Minimal line-level diff via a longest-common-subsequence table. Returns the
 * old/new lines interleaved: unchanged lines as `same`, removed lines as
 * `remove`, added lines as `add` (removals before additions at a change point).
 * Good enough for previewing a system-prompt revision; no external deps.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = LCS length of a[i:] and b[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++; j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "remove", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "remove", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/prompt-diff.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the renderer component**

```tsx
// src/components/dashboard/voice/prompt-diff.tsx
import { diffLines } from "@/lib/voice/prompt-diff";

const ROW: Record<string, string> = {
  same: "text-gray-600",
  add: "bg-brut-lime/40 text-ink",
  remove: "bg-brut-red/30 text-ink line-through decoration-ink/40",
};
const GUTTER: Record<string, string> = { same: " ", add: "+", remove: "-" };

/** Old → new system-prompt diff on a hairline ink frame. Read-only, monospace. */
export function PromptDiff({ oldPrompt, newPrompt }: { oldPrompt: string; newPrompt: string }) {
  const lines = diffLines(oldPrompt, newPrompt);
  return (
    <div className="scrollbar-ink max-h-72 overflow-auto border-2 border-ink bg-paper font-mono text-[11px] leading-relaxed">
      {lines.map((l, idx) => (
        <div key={idx} className={`flex gap-2 px-2 ${ROW[l.type]}`}>
          <span aria-hidden="true" className="w-3 shrink-0 select-none text-ink/40">{GUTTER[l.type]}</span>
          <span className="whitespace-pre-wrap break-words">{l.text || " "}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/voice/prompt-diff.ts src/components/dashboard/voice/prompt-diff.tsx tests/prompt-diff.test.ts
git commit -m "feat(voice): prompt diff (pure LCS line diff + renderer)"
```

---

## Task 5: Prompt-tuning detector + reads (the "suggest" half)

**Files:**
- Create: `src/lib/voice/prompt-tuning.ts`
- Test: `tests/prompt-tuning-detector.test.ts`

This module is the heart of the loop. This task implements the **pure selection helper**, the **types**, the **detector** (cluster rising reason → draft via Gemini → upsert a `draft` suggestion) and the **read** functions. Apply/rollback/measure land in Task 8.

- [ ] **Step 1: Write the failing test for the pure selector**

```typescript
// tests/prompt-tuning-detector.test.ts
import { describe, it, expect } from "vitest";
import { pickRisingReason } from "@/lib/voice/prompt-tuning";

describe("pickRisingReason", () => {
  const total = 50;
  it("returns null when nothing meets the minimum count", () => {
    expect(pickRisingReason({ "Goal not met": 2 }, {}, total, 3)).toBeNull();
  });

  it("prefers the reason with the largest rise vs the prior window", () => {
    const cur = { "Goal not met": 8, "Unusually long": 10 };
    const prev = { "Goal not met": 2, "Unusually long": 9 }; // +300% vs +11%
    const r = pickRisingReason(cur, prev, total, 3);
    expect(r?.reason).toBe("Goal not met");
    expect(r?.count).toBe(8);
    expect(r?.deltaPct).toBe(300);
    expect(r?.flaggedRate).toBeCloseTo(8 / 50, 5);
  });

  it("treats a brand-new reason (no prior) as rising when it clears the minimum", () => {
    const r = pickRisingReason({ "Repeated address confusion": 5 }, {}, total, 3);
    expect(r?.reason).toBe("Repeated address confusion");
    expect(r?.deltaPct).toBeNull();
  });

  it("ignores reasons that fell or held flat", () => {
    expect(pickRisingReason({ "Goal not met": 4 }, { "Goal not met": 9 }, total, 3)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/prompt-tuning-detector.test.ts`
Expected: FAIL — cannot resolve `@/lib/voice/prompt-tuning`.

- [ ] **Step 3: Write the detector module**

```typescript
// src/lib/voice/prompt-tuning.ts
import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/env";
import { reviewReasons, type FlagInput } from "@/lib/voice/quality";
import { vapiConfigured, getSystemPrompt } from "@/lib/voice/vapi";

const WINDOW_DAYS = 30;
const MIN_COUNT = 3; // a cluster must have at least this many flagged calls to suggest
const EVIDENCE_LIMIT = 5;

/* ------------------------------------------------------------------- types */

export interface RisingReason {
  reason: string;
  count: number;
  /** % change vs the prior equal-length window; null = brand new (no baseline). */
  deltaPct: number | null;
  /** count / totalCallsInWindow — the baseline flagged-rate stored on the suggestion. */
  flaggedRate: number;
}

export interface EvidenceCall {
  id: string;
  startedAt: string;
  outcome: string;
  callerName: string | null;
  summary: string | null;
}

export interface PromptSuggestion {
  id: string;
  tenantId: string;
  automationId: string;
  agentName: string;
  reason: string;
  reasonCount: number;
  reasonDeltaPct: number | null;
  oldPrompt: string;
  newPrompt: string;
  rationale: string | null;
  evidence: EvidenceCall[];
  status: "draft" | "requested" | "applied" | "dismissed" | "superseded";
  operatorNote: string | null;
  requestedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  /** Joined for the admin inbox. */
  tenantName?: string;
}

export interface PromptRevision {
  id: string;
  tenantId: string;
  automationId: string;
  agentName: string;
  vapiAssistantId: string;
  revision: number;
  oldPrompt: string;
  newPrompt: string;
  reason: string | null;
  rationale: string | null;
  kind: "apply" | "rollback";
  status: "active" | "superseded" | "rolled_back";
  baselineFlaggedRate: number | null;
  measuredFlaggedRate: number | null;
  measuredAt: string | null;
  appliedAt: string;
  tenantName?: string;
}

/* --------------------------------------------------------- pure selection */

/**
 * Pick the single failure reason that is rising hardest and worth drafting a fix
 * for. A reason qualifies when its current count ≥ `minCount` AND it rose vs the
 * prior window (or is brand new). Ranked by % rise (new reasons rank above any
 * finite rise). Returns null when nothing qualifies.
 */
export function pickRisingReason(
  cur: Record<string, number>,
  prev: Record<string, number>,
  totalCalls: number,
  minCount = MIN_COUNT,
): RisingReason | null {
  let best: RisingReason | null = null;
  let bestRank = -Infinity;
  for (const [reason, count] of Object.entries(cur)) {
    if (count < minCount) continue;
    const prevCount = prev[reason] ?? 0;
    const isNew = prevCount === 0;
    const deltaPct = isNew ? null : Math.round(((count - prevCount) / prevCount) * 100);
    const rising = isNew || (deltaPct ?? 0) > 0;
    if (!rising) continue;
    // New reasons rank above any finite rise; otherwise rank by % rise.
    const rank = isNew ? Number.MAX_SAFE_INTEGER : (deltaPct ?? 0);
    if (rank > bestRank) {
      bestRank = rank;
      best = { reason, count, deltaPct, flaggedRate: totalCalls > 0 ? count / totalCalls : 0 };
    }
  }
  return best;
}

/* ------------------------------------------------------------- LLM draft */

const DRAFT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    new_prompt: { type: Type.STRING, description: "The full revised system prompt. Keep the agent's voice, scope and structure; change only what reduces the named failure reason." },
    rationale: { type: Type.STRING, description: "One plain sentence naming what you changed and why it should reduce the failure." },
  },
  required: ["new_prompt", "rationale"],
  propertyOrdering: ["new_prompt", "rationale"],
};

const DRAFT_SYSTEM = [
  "You tune the system prompt of an AI phone agent for a UK private-hire (taxi) firm.",
  "You are given the agent's CURRENT system prompt, a rising failure reason, and short summaries of real calls that failed for that reason.",
  "Return a REVISED full system prompt that targets that one failure reason. Preserve everything that already works (tone, scope, structure, business rules); make the smallest change that plausibly reduces the failure.",
  "Plain British English. No buzzwords, no em dashes. Do not invent business facts not present in the current prompt.",
].join(" ");

async function draftRevision(
  oldPrompt: string,
  reason: RisingReason,
  evidence: EvidenceCall[],
): Promise<{ newPrompt: string; rationale: string; model: string } | null> {
  if (!env.GEMINI_API_KEY) return null;
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const isFlash = env.BRIEFING_MODEL.includes("flash");
  const payload = {
    failure_reason: reason.reason,
    occurrences: reason.count,
    change_vs_prior_pct: reason.deltaPct,
    example_calls: evidence.map((e) => ({ outcome: e.outcome, summary: e.summary ?? "(no summary)" })),
    current_system_prompt: oldPrompt,
  };
  try {
    const res = await ai.models.generateContent({
      model: env.BRIEFING_MODEL,
      contents: `Revise the system prompt to reduce this failure.\n\n${JSON.stringify(payload)}`,
      config: {
        systemInstruction: DRAFT_SYSTEM,
        maxOutputTokens: isFlash ? 4096 : 8192,
        ...(isFlash ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        responseMimeType: "application/json",
        responseSchema: DRAFT_SCHEMA,
      },
    });
    const parsed = JSON.parse(res.text ?? "") as { new_prompt: string; rationale: string };
    if (!parsed.new_prompt?.trim()) return null;
    return { newPrompt: parsed.new_prompt, rationale: parsed.rationale ?? "", model: env.BRIEFING_MODEL };
  } catch (e) {
    console.error("prompt-tuning draft failed", { reason: reason.reason, error: String((e as Error)?.message ?? e) });
    return null;
  }
}

/* ----------------------------------------------------------- the detector */

type AgentRow = { automation_id: string; display_name: string; vapi_assistant_id: string | null };
type CallRow = FlagInput & { id: string; started_at: string; caller_name: string | null; summary: string | null };

/**
 * Detect prompt-tuning suggestions for one tenant. For each Voice agent with a
 * Vapi assistant: cluster this window's flagged calls by reason vs the prior
 * window, pick the reason rising hardest, gather up to 5 evidence calls, fetch
 * the live system prompt, draft a revision with Gemini, and upsert a `draft`
 * suggestion (refreshing the open draft for that agent+reason; never clobbering a
 * suggestion already `requested` by the operator). Best-effort; never throws.
 */
export async function detectPromptSuggestions(tenantId: string): Promise<{ drafted: number; skipped: string[] }> {
  const skipped: string[] = [];
  if (!env.GEMINI_API_KEY) return { drafted: 0, skipped: ["no_gemini_key"] };
  if (!vapiConfigured()) return { drafted: 0, skipped: ["no_vapi_key"] };

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: agentData } = await db
    .from("voice_agents")
    .select("automation_id, display_name, vapi_assistant_id")
    .eq("tenant_id", tenantId);
  const agents = ((agentData ?? []) as AgentRow[]).filter((a) => a.vapi_assistant_id);
  if (agents.length === 0) return { drafted: 0, skipped: ["no_wired_agents"] };

  const now = Date.now();
  const windowStart = new Date(now - WINDOW_DAYS * 86_400_000).toISOString();
  const priorStart = new Date(now - 2 * WINDOW_DAYS * 86_400_000).toISOString();

  let drafted = 0;
  for (const agent of agents) {
    const { data: callData } = await db
      .from("calls")
      .select("id, started_at, outcome, duration_s, success, address_lookups, caller_name, summary")
      .eq("tenant_id", tenantId)
      .eq("automation_id", agent.automation_id)
      .gte("started_at", priorStart)
      .order("started_at", { ascending: false });
    const rows = (callData ?? []) as CallRow[];
    const cur = rows.filter((r) => r.started_at >= windowStart);
    const prev = rows.filter((r) => r.started_at < windowStart);

    const curCounts: Record<string, number> = {};
    for (const r of cur) for (const reason of reviewReasons(r).reasons) curCounts[reason] = (curCounts[reason] ?? 0) + 1;
    const prevCounts: Record<string, number> = {};
    for (const r of prev) for (const reason of reviewReasons(r).reasons) prevCounts[reason] = (prevCounts[reason] ?? 0) + 1;

    const rising = pickRisingReason(curCounts, prevCounts, cur.length);
    if (!rising) { skipped.push(`${agent.automation_id}:nothing_rising`); continue; }

    const evidence: EvidenceCall[] = cur
      .filter((r) => reviewReasons(r).reasons.includes(rising.reason))
      .sort((a, b) => reviewReasons(b).severity - reviewReasons(a).severity || (a.started_at < b.started_at ? 1 : -1))
      .slice(0, EVIDENCE_LIMIT)
      .map((r) => ({ id: r.id, startedAt: r.started_at, outcome: r.outcome, callerName: r.caller_name, summary: r.summary }));

    let oldPrompt: string;
    try {
      oldPrompt = await getSystemPrompt(agent.vapi_assistant_id as string);
    } catch (e) {
      console.error("prompt-tuning: getSystemPrompt failed", { assistant: agent.vapi_assistant_id, error: String((e as Error)?.message ?? e) });
      skipped.push(`${agent.automation_id}:vapi_read_failed`);
      continue;
    }

    const draft = await draftRevision(oldPrompt, rising, evidence);
    if (!draft) { skipped.push(`${agent.automation_id}:draft_failed`); continue; }

    // Refresh the open draft for this agent+reason; never clobber a 'requested' one.
    const { data: existing } = await db
      .from("prompt_suggestions")
      .select("id, status")
      .eq("automation_id", agent.automation_id)
      .eq("reason", rising.reason)
      .in("status", ["draft", "requested"])
      .maybeSingle();
    if (existing?.status === "requested") { skipped.push(`${agent.automation_id}:awaiting_admin`); continue; }

    const fields = {
      tenant_id: tenantId,
      automation_id: agent.automation_id,
      vapi_assistant_id: agent.vapi_assistant_id,
      reason: rising.reason,
      reason_count: rising.count,
      reason_delta_pct: rising.deltaPct,
      baseline_flagged_rate: rising.flaggedRate,
      old_prompt: oldPrompt,
      new_prompt: draft.newPrompt,
      rationale: draft.rationale,
      evidence_call_ids: evidence.map((e) => e.id),
      model: draft.model,
      status: "draft" as const,
      updated_at: new Date().toISOString(),
    };
    const res = existing
      ? await db.from("prompt_suggestions").update(fields).eq("id", existing.id)
      : await db.from("prompt_suggestions").insert(fields);
    if (res.error) { skipped.push(`${agent.automation_id}:write_failed`); continue; }
    drafted++;
  }
  return { drafted, skipped };
}

/** Detect across every tenant with a wired Voice agent (cron entrypoint). */
export async function detectAllPromptSuggestions(): Promise<{ tenants: number; drafted: number }> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db.from("voice_agents").select("tenant_id").not("vapi_assistant_id", "is", null);
  const tenantIds = [...new Set(((data ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id))];
  let drafted = 0;
  for (const id of tenantIds) drafted += (await detectPromptSuggestions(id)).drafted;
  return { tenants: tenantIds.length, drafted };
}

/* ------------------------------------------------------------------ reads */

type SuggestionRow = {
  id: string; tenant_id: string; automation_id: string; reason: string;
  reason_count: number; reason_delta_pct: number | null; old_prompt: string;
  new_prompt: string; rationale: string | null; evidence_call_ids: string[];
  status: PromptSuggestion["status"]; operator_note: string | null;
  requested_at: string | null; resolved_at: string | null; created_at: string;
  voice_agents?: { display_name: string } | null;
  tenants?: { name: string } | null;
};

async function hydrateEvidence(
  db: ReturnType<typeof createSupabaseJS>,
  ids: string[],
): Promise<Map<string, EvidenceCall>> {
  if (ids.length === 0) return new Map();
  const { data } = await db
    .from("calls")
    .select("id, started_at, outcome, caller_name, summary")
    .in("id", ids);
  return new Map(
    ((data ?? []) as { id: string; started_at: string; outcome: string; caller_name: string | null; summary: string | null }[]).map(
      (r) => [r.id, { id: r.id, startedAt: r.started_at, outcome: r.outcome, callerName: r.caller_name, summary: r.summary }],
    ),
  );
}

function toSuggestion(row: SuggestionRow, evidence: EvidenceCall[]): PromptSuggestion {
  return {
    id: row.id, tenantId: row.tenant_id, automationId: row.automation_id,
    agentName: row.voice_agents?.display_name ?? "Voice agent",
    reason: row.reason, reasonCount: row.reason_count, reasonDeltaPct: row.reason_delta_pct,
    oldPrompt: row.old_prompt, newPrompt: row.new_prompt, rationale: row.rationale,
    evidence, status: row.status, operatorNote: row.operator_note,
    requestedAt: row.requested_at, resolvedAt: row.resolved_at, createdAt: row.created_at,
    tenantName: row.tenants?.name,
  };
}

const SUGGESTION_COLS =
  "id, tenant_id, automation_id, reason, reason_count, reason_delta_pct, old_prompt, new_prompt, rationale, evidence_call_ids, status, operator_note, requested_at, resolved_at, created_at, voice_agents(display_name)";

/** Active suggestions for the tenant panel (draft + requested + recently applied). */
export async function getPromptSuggestions(tenantId: string): Promise<PromptSuggestion[]> {
  const supabase = await createClient(); // RLS-scoped
  const { data } = await supabase
    .from("prompt_suggestions")
    .select(SUGGESTION_COLS)
    .eq("tenant_id", tenantId)
    .in("status", ["draft", "requested", "applied"])
    .order("created_at", { ascending: false })
    .limit(20);
  const rows = (data ?? []) as SuggestionRow[];
  const svc = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const ev = await hydrateEvidence(svc, [...new Set(rows.flatMap((r) => r.evidence_call_ids))]);
  return rows.map((r) => toSuggestion(r, r.evidence_call_ids.map((id) => ev.get(id)).filter((x): x is EvidenceCall => !!x)));
}

/** Every requested suggestion across all tenants — the admin inbox. Service role. */
export async function getRequestedSuggestions(): Promise<PromptSuggestion[]> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db
    .from("prompt_suggestions")
    .select(`${SUGGESTION_COLS}, tenants(name)`)
    .eq("status", "requested")
    .order("requested_at", { ascending: true });
  const rows = (data ?? []) as SuggestionRow[];
  const ev = await hydrateEvidence(db, [...new Set(rows.flatMap((r) => r.evidence_call_ids))]);
  return rows.map((r) => toSuggestion(r, r.evidence_call_ids.map((id) => ev.get(id)).filter((x): x is EvidenceCall => !!x)));
}
```

> Note: `getPromptSuggestions` uses the RLS-scoped server client for the suggestion rows (tenant can only see its own), then a service-role read for evidence call summaries (already proven same-tenant by the suggestion row). This mirrors `getCallTranscript` in the quality actions, which signs artifacts via service role after an RLS read.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/prompt-tuning-detector.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds (server-only imports resolve; no client leakage).

- [ ] **Step 6: Commit**

```bash
git add src/lib/voice/prompt-tuning.ts tests/prompt-tuning-detector.test.ts
git commit -m "feat(voice): prompt-tuning detector (cluster rising reason → LLM draft)"
```

---

## Task 6: Tenant actions — detect on demand, raise to admin, dismiss

**Files:**
- Modify: `src/app/dashboard/voice/quality/actions.ts` (append)

- [ ] **Step 1: Append the three server actions**

Add to the imports at the top of [src/app/dashboard/voice/quality/actions.ts](src/app/dashboard/voice/quality/actions.ts):

```typescript
import { detectPromptSuggestions } from "@/lib/voice/prompt-tuning";
```

Append at the end of the file:

```typescript
export type PromptActionState = { ok: boolean; error?: string; message?: string };

/**
 * Run the prompt-tuning detector for the caller's tenant on demand (the panel's
 * "Check for suggestions" button). Owner/Admin only, never in demo. Best-effort:
 * surfaces a friendly message rather than throwing.
 */
export async function runPromptDetection(): Promise<PromptActionState> {
  const claims = await requireUser();
  if (!claims.tenant_id) return { ok: false, error: "No organisation linked." };
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };
  if (claims.role === "Viewer") return { ok: false, error: "Owners and admins can run prompt tuning." };

  const res = await detectPromptSuggestions(claims.tenant_id);
  revalidatePath("/dashboard/voice/quality");
  if (res.drafted > 0) return { ok: true, message: `${res.drafted} suggestion${res.drafted === 1 ? "" : "s"} ready to review.` };
  if (res.skipped.includes("no_gemini_key") || res.skipped.includes("no_vapi_key"))
    return { ok: true, message: "Prompt tuning isn't configured yet — contact FlowMo." };
  return { ok: true, message: "No new tuning suggestions right now." };
}

const requestSchema = z.object({
  suggestionId: z.string().uuid(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Operator raises a draft suggestion to FlowMo admin for approval. Moves the
 * suggestion draft → requested, stamping who/when + an optional note. Only FlowMo
 * staff can actually apply it (that PATCHes Vapi). Owner/Admin only, never demo.
 */
export async function requestPromptSuggestion(input: { suggestionId: string; note?: string }): Promise<PromptActionState> {
  const claims = await requireUser();
  if (!claims.tenant_id) return { ok: false, error: "No organisation linked." };
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };
  if (claims.role === "Viewer") return { ok: false, error: "Owners and admins can raise a change." };

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const svc = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sug } = await svc
    .from("prompt_suggestions")
    .select("id, status")
    .eq("id", parsed.data.suggestionId)
    .eq("tenant_id", claims.tenant_id)
    .maybeSingle();
  if (!sug) return { ok: false, error: "Suggestion not found." };
  if (sug.status !== "draft") return { ok: false, error: "This suggestion has already been sent." };

  const { error } = await svc
    .from("prompt_suggestions")
    .update({
      status: "requested",
      requested_by: claims.sub,
      requested_at: new Date().toISOString(),
      operator_note: parsed.data.note ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.suggestionId);
  if (error) return { ok: false, error: "Could not send the request." };

  revalidatePath("/dashboard/voice/quality");
  return { ok: true, message: "Sent to FlowMo for review." };
}

/** Operator dismisses a draft they don't want. Draft → dismissed. */
export async function dismissPromptSuggestion(input: { suggestionId: string }): Promise<PromptActionState> {
  const claims = await requireUser();
  if (!claims.tenant_id) return { ok: false, error: "No organisation linked." };
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };
  if (claims.role === "Viewer") return { ok: false, error: "Owners and admins can dismiss a suggestion." };

  const parsed = z.object({ suggestionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const svc = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await svc
    .from("prompt_suggestions")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.suggestionId)
    .eq("tenant_id", claims.tenant_id)
    .eq("status", "draft");
  if (error) return { ok: false, error: "Could not dismiss." };

  revalidatePath("/dashboard/voice/quality");
  return { ok: true };
}
```

- [ ] **Step 2: Verify the build (server actions need a real build)**

Run: `npm run build`
Expected: build succeeds. (`createSupabaseJS`, `env`, `z`, `requireUser`, `revalidatePath` are already imported in this file.)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/voice/quality/actions.ts
git commit -m "feat(voice): tenant actions to detect, raise, and dismiss prompt suggestions"
```

---

## Task 7: Tenant "Prompt-tuning suggestions" panel + wire into the page

**Files:**
- Create: `src/components/dashboard/voice/prompt-tuning-panel.tsx`
- Modify: `src/app/dashboard/voice/quality/page.tsx`

- [ ] **Step 1: Build the panel component**

```tsx
// src/components/dashboard/voice/prompt-tuning-panel.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PromptDiff } from "./prompt-diff";
import {
  runPromptDetection,
  requestPromptSuggestion,
  dismissPromptSuggestion,
  type PromptActionState,
} from "@/app/dashboard/voice/quality/actions";
import type { PromptSuggestion } from "@/lib/voice/prompt-tuning";

const REASON_STYLE: Record<string, string> = {
  "System error": "bg-brut-red",
  "Caller abandoned": "bg-brut-orange",
  "Repeated address confusion": "bg-brut-violet",
  "Unusually long": "bg-brut-cyan",
  "Goal not met": "bg-brut-yellow",
};
const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function DeltaChip({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null)
    return <span className="border-2 border-ink bg-brut-orange px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">New</span>;
  return (
    <span className="border-2 border-ink bg-brut-red px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">
      ▲ {deltaPct}%
    </span>
  );
}

function SuggestionCard({ s }: { s: PromptSuggestion }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<PromptActionState>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.error ?? res.message ?? null);
      if (res.ok) router.refresh();
    });

  return (
    <li className="border-2 border-ink bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-gray-50 px-4 py-2.5">
        <span className={`h-3 w-3 shrink-0 border-2 border-ink ${REASON_STYLE[s.reason] ?? "bg-gray-200"}`} aria-hidden="true" />
        <span className="text-sm font-bold text-ink">{s.reason}</span>
        <span className="font-mono text-xs font-bold tabular-nums text-ink/70">{s.reasonCount} calls</span>
        <DeltaChip deltaPct={s.reasonDeltaPct} />
        <span className="ml-auto text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">{s.agentName}</span>
        {s.status === "requested" ? (
          <span className="border-2 border-ink bg-brut-cyan px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">
            Sent to FlowMo{s.requestedAt ? ` · ${when(s.requestedAt)}` : ""}
          </span>
        ) : null}
        {s.status === "applied" ? (
          <span className="border-2 border-ink bg-brut-lime px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">
            Applied{s.resolvedAt ? ` · ${when(s.resolvedAt)}` : ""}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 px-4 py-3">
        {s.rationale ? <p className="max-w-prose text-sm leading-relaxed text-gray-700">{s.rationale}</p> : null}

        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Proposed prompt change</p>
          <PromptDiff oldPrompt={s.oldPrompt} newPrompt={s.newPrompt} />
        </div>

        {s.evidence.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Evidence · {s.evidence.length} call{s.evidence.length === 1 ? "" : "s"}</p>
            <ul className="divide-y-2 divide-gray-100 border-2 border-ink">
              {s.evidence.map((e) => (
                <li key={e.id} className="flex items-start gap-2 px-2.5 py-1.5">
                  <span className="font-mono text-[10px] tabular-nums text-gray-500">{when(e.startedAt)}</span>
                  <span className="border border-ink bg-gray-100 px-1 text-[9px] font-bold uppercase text-ink">{e.outcome}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{e.summary ?? "No summary"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {s.status === "draft" ? (
          <div className="space-y-2 border-t-2 border-gray-100 pt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for FlowMo (what you're seeing, any context)…"
              rows={2}
              className="brut-focus w-full border-2 border-ink bg-paper px-2 py-1.5 text-xs text-ink placeholder:text-gray-400"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => requestPromptSuggestion({ suggestionId: s.id, note: note.trim() || undefined }))}
                className="brut-press brut-focus inline-flex h-10 items-center border-[3px] border-ink bg-brut-yellow px-4 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut disabled:opacity-50"
              >
                Send to FlowMo to apply
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => dismissPromptSuggestion({ suggestionId: s.id }))}
                className="brut-press brut-focus inline-flex h-10 items-center border-2 border-ink bg-paper px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-gray-500 disabled:opacity-50"
              >
                Dismiss
              </button>
              {msg ? <span className="text-xs font-semibold text-gray-600">{msg}</span> : null}
            </div>
          </div>
        ) : msg ? (
          <p className="text-xs font-semibold text-gray-600">{msg}</p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Prompt-tuning suggestions — the lever for improving the agent. The detector
 * clusters a rising failure reason and drafts a revised system prompt; the
 * operator previews the diff + evidence and raises it to FlowMo, who apply it.
 */
export function PromptTuningPanel({ suggestions }: { suggestions: PromptSuggestion[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const check = () =>
    start(async () => {
      const res = await runPromptDetection();
      setMsg(res.error ?? res.message ?? null);
      if (res.ok) router.refresh();
    });

  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b-[3px] border-ink bg-brut-violet px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Prompt-tuning suggestions</h2>
          <span className="border-2 border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{suggestions.length}</span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={check}
          className="brut-press brut-focus inline-flex h-9 items-center border-2 border-ink bg-paper px-3 text-[11px] font-bold uppercase tracking-[0.05em] text-ink disabled:opacity-50"
        >
          {pending ? "Checking…" : "Check for suggestions"}
        </button>
      </header>

      {suggestions.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-gray-600">No tuning suggestions right now. When a failure reason starts rising, a drafted prompt fix will appear here to preview and send to FlowMo.</p>
          {msg ? <p className="mt-2 text-xs font-semibold text-gray-500">{msg}</p> : null}
        </div>
      ) : (
        <>
          {msg ? <p className="border-b-2 border-gray-100 px-5 py-2 text-xs font-semibold text-gray-600">{msg}</p> : null}
          <ul className="space-y-4 p-4">
            {suggestions.map((s) => (
              <SuggestionCard key={s.id} s={s} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire the panel into the Agent quality page**

In [src/app/dashboard/voice/quality/page.tsx](src/app/dashboard/voice/quality/page.tsx), add imports near the top:

```typescript
import { PromptTuningPanel } from "@/components/dashboard/voice/prompt-tuning-panel";
import { getPromptSuggestions } from "@/lib/voice/prompt-tuning";
```

In the component body, fetch the suggestions next to the quality data (after line 29):

```typescript
  const suggestions = await getPromptSuggestions(claims.tenant_id);
```

In the JSX, place the panel **below** the `CallInspector` (the section added in Task 3). The block becomes:

```tsx
          <CallInspector items={data.recent} windowLabel={cycleLabel} />

          <PromptTuningPanel suggestions={suggestions} />

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <SentimentPanel s={data.sentiment} />
            <LoyaltyPanel l={data.loyalty} />
          </div>
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds; the Agent quality page compiles with the new panel.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/voice/prompt-tuning-panel.tsx src/app/dashboard/voice/quality/page.tsx
git commit -m "feat(voice): tenant Prompt-tuning suggestions panel below Call Inspector"
```

---

## Task 8: Apply / rollback / measure (the "approve → measure → rollback" half)

**Files:**
- Modify: `src/lib/voice/prompt-tuning.ts` (append apply/rollback/measure + revision reads)

- [ ] **Step 1: Append the revision read + the mutating operations**

Add to [src/lib/voice/prompt-tuning.ts](src/lib/voice/prompt-tuning.ts):

```typescript
import { setSystemPrompt } from "@/lib/voice/vapi";
```

(extend the existing `vapi` import line to also import `setSystemPrompt`.)

Append at the end of the file:

```typescript
/* ----------------------------------------------------- revisions (reads) */

type RevisionRow = {
  id: string; tenant_id: string; automation_id: string; vapi_assistant_id: string;
  revision: number; old_prompt: string; new_prompt: string; reason: string | null;
  rationale: string | null; kind: PromptRevision["kind"]; status: PromptRevision["status"];
  baseline_flagged_rate: number | null; measured_flagged_rate: number | null;
  measured_at: string | null; applied_at: string;
  voice_agents?: { display_name: string } | null;
  tenants?: { name: string } | null;
};

function toRevision(r: RevisionRow): PromptRevision {
  return {
    id: r.id, tenantId: r.tenant_id, automationId: r.automation_id, vapiAssistantId: r.vapi_assistant_id,
    agentName: r.voice_agents?.display_name ?? "Voice agent",
    revision: r.revision, oldPrompt: r.old_prompt, newPrompt: r.new_prompt, reason: r.reason,
    rationale: r.rationale, kind: r.kind, status: r.status,
    baselineFlaggedRate: r.baseline_flagged_rate, measuredFlaggedRate: r.measured_flagged_rate,
    measuredAt: r.measured_at, appliedAt: r.applied_at, tenantName: r.tenants?.name,
  };
}

const REVISION_COLS =
  "id, tenant_id, automation_id, vapi_assistant_id, revision, old_prompt, new_prompt, reason, rationale, kind, status, baseline_flagged_rate, measured_flagged_rate, measured_at, applied_at, voice_agents(display_name)";

/** Currently-live revisions across all assistants — the admin "active" list. Service role. */
export async function getActiveRevisions(): Promise<PromptRevision[]> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await db
    .from("prompt_revisions")
    .select(`${REVISION_COLS}, tenants(name)`)
    .eq("status", "active")
    .order("applied_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as RevisionRow[]).map(toRevision);
}

/* ------------------------------------------------ apply / rollback (Vapi) */

const AUTO_ROLLBACK_DWELL_DAYS = 14; // wait this long after apply before measuring
const AUTO_ROLLBACK_WORSE_RATIO = 1.25; // measured rate 25%+ worse than baseline → auto-rollback

export type ApplyResult = { ok: boolean; error?: string; revisionId?: string };

/** Next revision number for an assistant (service-role; low write rate). */
async function nextRevision(db: ReturnType<typeof createSupabaseJS>, assistantId: string): Promise<number> {
  const { data } = await db
    .from("prompt_revisions")
    .select("revision")
    .eq("vapi_assistant_id", assistantId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { revision: number } | null)?.revision ?? 0) + 1;
}

/**
 * Apply a requested suggestion: re-read the live prompt (source of truth for the
 * "old" side), PATCH Vapi to the new prompt, write an `apply` revision (marking
 * any prior active revision for that assistant superseded), and mark the
 * suggestion applied. Service-role internals; the admin action wraps it with
 * requireStaff + audit. `actorUserId` is the staff user id for the trail.
 */
export async function applySuggestion(suggestionId: string, actorUserId: string): Promise<ApplyResult> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sug } = await db
    .from("prompt_suggestions")
    .select("id, tenant_id, automation_id, vapi_assistant_id, reason, rationale, new_prompt, baseline_flagged_rate, status")
    .eq("id", suggestionId)
    .maybeSingle();
  if (!sug) return { ok: false, error: "Suggestion not found." };
  if (sug.status !== "requested") return { ok: false, error: "Only requested suggestions can be applied." };
  if (!sug.vapi_assistant_id) return { ok: false, error: "This agent has no Vapi assistant wired." };

  // Live prompt is the true "old" side (the snapshot may have drifted).
  let oldPrompt: string;
  try {
    oldPrompt = await getSystemPrompt(sug.vapi_assistant_id);
  } catch (e) {
    return { ok: false, error: `Could not read the live prompt: ${String((e as Error)?.message ?? e).slice(0, 160)}` };
  }
  try {
    await setSystemPrompt(sug.vapi_assistant_id, sug.new_prompt);
  } catch (e) {
    return { ok: false, error: `Vapi update failed: ${String((e as Error)?.message ?? e).slice(0, 160)}` };
  }

  await db
    .from("prompt_revisions")
    .update({ status: "superseded" })
    .eq("vapi_assistant_id", sug.vapi_assistant_id)
    .eq("status", "active");

  const revision = await nextRevision(db, sug.vapi_assistant_id);
  const { data: rev, error: revErr } = await db
    .from("prompt_revisions")
    .insert({
      tenant_id: sug.tenant_id,
      automation_id: sug.automation_id,
      vapi_assistant_id: sug.vapi_assistant_id,
      revision,
      old_prompt: oldPrompt,
      new_prompt: sug.new_prompt,
      reason: sug.reason,
      rationale: sug.rationale,
      source_suggestion_id: sug.id,
      kind: "apply",
      status: "active",
      baseline_flagged_rate: sug.baseline_flagged_rate,
      applied_by: actorUserId,
    })
    .select("id")
    .single();
  if (revErr || !rev) return { ok: false, error: "Saved to Vapi but failed to record the revision." };

  await db
    .from("prompt_suggestions")
    .update({ status: "applied", resolved_by: actorUserId, resolved_at: new Date().toISOString(), revision_id: rev.id, updated_at: new Date().toISOString() })
    .eq("id", sug.id);

  return { ok: true, revisionId: rev.id };
}

/**
 * Roll an active `apply` revision back to its previous prompt: PATCH Vapi to the
 * revision's `old_prompt`, mark that revision `rolled_back`, and write a new
 * `rollback` revision (active) pointing at it via parent_revision_id. When
 * `actorUserId` is null the rollback was automatic (the measure sweep).
 */
export async function rollbackRevision(revisionId: string, actorUserId: string | null): Promise<ApplyResult> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: target } = await db
    .from("prompt_revisions")
    .select("id, tenant_id, automation_id, vapi_assistant_id, old_prompt, new_prompt, reason, status, baseline_flagged_rate")
    .eq("id", revisionId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Revision not found." };
  if (target.status !== "active") return { ok: false, error: "Only the active revision can be rolled back." };

  try {
    await setSystemPrompt(target.vapi_assistant_id, target.old_prompt);
  } catch (e) {
    return { ok: false, error: `Vapi rollback failed: ${String((e as Error)?.message ?? e).slice(0, 160)}` };
  }

  await db.from("prompt_revisions").update({ status: "rolled_back" }).eq("id", target.id);

  const revision = await nextRevision(db, target.vapi_assistant_id);
  const { data: rev, error: revErr } = await db
    .from("prompt_revisions")
    .insert({
      tenant_id: target.tenant_id,
      automation_id: target.automation_id,
      vapi_assistant_id: target.vapi_assistant_id,
      revision,
      old_prompt: target.new_prompt, // we were on new_prompt; restoring old_prompt
      new_prompt: target.old_prompt,
      reason: target.reason,
      rationale: actorUserId ? "Manual rollback to the previous prompt." : "Auto-rollback: failure rate worsened after the change.",
      kind: "rollback",
      parent_revision_id: target.id,
      status: "active",
      baseline_flagged_rate: target.baseline_flagged_rate,
      applied_by: actorUserId,
    })
    .select("id")
    .single();
  if (revErr || !rev) return { ok: false, error: "Rolled back in Vapi but failed to record the revision." };
  return { ok: true, revisionId: rev.id };
}

/**
 * Measure each active `apply` revision past its dwell window: compute the reason's
 * post-apply flagged-rate and store it. If it worsened beyond the threshold,
 * auto-roll-back. Returns counts for the cron summary. Best-effort.
 */
export async function measureRevisions(): Promise<{ measured: number; autoRolledBack: number }> {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const dwellCutoff = new Date(Date.now() - AUTO_ROLLBACK_DWELL_DAYS * 86_400_000).toISOString();
  const { data } = await db
    .from("prompt_revisions")
    .select("id, tenant_id, automation_id, reason, baseline_flagged_rate, applied_at")
    .eq("status", "active")
    .eq("kind", "apply")
    .is("measured_at", null)
    .lte("applied_at", dwellCutoff);
  const rows = (data ?? []) as {
    id: string; tenant_id: string; automation_id: string; reason: string | null;
    baseline_flagged_rate: number | null; applied_at: string;
  }[];

  let measured = 0;
  let autoRolledBack = 0;
  for (const r of rows) {
    if (!r.reason) continue;
    const { data: callData } = await db
      .from("calls")
      .select("outcome, duration_s, success, address_lookups")
      .eq("tenant_id", r.tenant_id)
      .eq("automation_id", r.automation_id)
      .gte("started_at", r.applied_at);
    const calls = (callData ?? []) as FlagInput[];
    if (calls.length === 0) continue;
    const flagged = calls.filter((c) => reviewReasons(c).reasons.includes(r.reason as string)).length;
    const rate = flagged / calls.length;
    await db.from("prompt_revisions").update({ measured_flagged_rate: rate, measured_at: new Date().toISOString() }).eq("id", r.id);
    measured++;
    const baseline = r.baseline_flagged_rate ?? 0;
    if (baseline > 0 && rate > baseline * AUTO_ROLLBACK_WORSE_RATIO) {
      const res = await rollbackRevision(r.id, null);
      if (res.ok) autoRolledBack++;
    }
  }
  return { measured, autoRolledBack };
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/voice/prompt-tuning.ts
git commit -m "feat(voice): apply/rollback/measure for prompt revisions (Vapi PATCH + trail)"
```

---

## Task 9: Admin actions — apply, roll back, decline

**Files:**
- Create: `src/app/admin/prompt-tuning/actions.ts`

- [ ] **Step 1: Write the staff-only admin actions**

```typescript
// src/app/admin/prompt-tuning/actions.ts
"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { applySuggestion, rollbackRevision } from "@/lib/voice/prompt-tuning";

export type AdminPromptActionState = { ok: boolean; error?: string };

/**
 * FlowMo staff approve a tenant's requested prompt change: PATCH the Vapi
 * assistant and record the revision. Audited. Only this path mutates Vapi.
 */
export async function applyPromptSuggestion(input: { suggestionId: string }): Promise<AdminPromptActionState> {
  const claims = await requireStaff();
  const parsed = z.object({ suggestionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  // Capture the tenant for the audit row before mutating.
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sug } = await db
    .from("prompt_suggestions")
    .select("tenant_id, automation_id, reason")
    .eq("id", parsed.data.suggestionId)
    .maybeSingle();

  const res = await applySuggestion(parsed.data.suggestionId, claims.sub);
  if (!res.ok) return { ok: false, error: res.error ?? "Apply failed." };

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: sug?.tenant_id ?? null,
    action: "voice.prompt_apply",
    targetType: "automation",
    targetId: sug?.automation_id ?? null,
    metadata: { suggestion_id: parsed.data.suggestionId, revision_id: res.revisionId, reason: sug?.reason ?? null },
  });

  revalidatePath("/admin/prompt-tuning");
  return { ok: true };
}

/** FlowMo staff roll a live revision back to its previous prompt. Audited. */
export async function rollbackPromptRevision(input: { revisionId: string }): Promise<AdminPromptActionState> {
  const claims = await requireStaff();
  const parsed = z.object({ revisionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rev } = await db
    .from("prompt_revisions")
    .select("tenant_id, automation_id")
    .eq("id", parsed.data.revisionId)
    .maybeSingle();

  const res = await rollbackRevision(parsed.data.revisionId, claims.sub);
  if (!res.ok) return { ok: false, error: res.error ?? "Rollback failed." };

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: rev?.tenant_id ?? null,
    action: "voice.prompt_rollback",
    targetType: "automation",
    targetId: rev?.automation_id ?? null,
    metadata: { rolled_back_revision_id: parsed.data.revisionId, new_revision_id: res.revisionId },
  });

  revalidatePath("/admin/prompt-tuning");
  return { ok: true };
}

/** FlowMo staff decline a requested suggestion without applying it. */
export async function declinePromptSuggestion(input: { suggestionId: string }): Promise<AdminPromptActionState> {
  const claims = await requireStaff();
  const parsed = z.object({ suggestionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: sug } = await db
    .from("prompt_suggestions")
    .select("tenant_id, automation_id")
    .eq("id", parsed.data.suggestionId)
    .eq("status", "requested")
    .maybeSingle();
  if (!sug) return { ok: false, error: "Request not found." };

  const { error } = await db
    .from("prompt_suggestions")
    .update({ status: "dismissed", resolved_by: claims.sub, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", parsed.data.suggestionId);
  if (error) return { ok: false, error: "Could not decline." };

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: sug.tenant_id,
    action: "voice.prompt_decline",
    targetType: "automation",
    targetId: sug.automation_id,
    metadata: { suggestion_id: parsed.data.suggestionId },
  });

  revalidatePath("/admin/prompt-tuning");
  return { ok: true };
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/prompt-tuning/actions.ts
git commit -m "feat(admin): staff actions to apply/rollback/decline prompt changes"
```

---

## Task 10: Admin Prompt-tuning console (inbox + active revisions)

**Files:**
- Create: `src/app/admin/prompt-tuning/prompt-request-board.tsx`
- Create: `src/app/admin/prompt-tuning/page.tsx`
- Modify: `src/components/admin/admin-shell.tsx` (nav)

- [ ] **Step 1: Build the client board**

```tsx
// src/app/admin/prompt-tuning/prompt-request-board.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PromptDiff } from "@/components/dashboard/voice/prompt-diff";
import {
  applyPromptSuggestion,
  rollbackPromptRevision,
  declinePromptSuggestion,
  type AdminPromptActionState,
} from "./actions";
import type { PromptSuggestion, PromptRevision } from "@/lib/voice/prompt-tuning";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);

function RequestCard({ s }: { s: PromptSuggestion }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<AdminPromptActionState>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.error ?? null);
      if (res.ok) router.refresh();
    });

  return (
    <li className="border-2 border-ink bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-gray-50 px-4 py-2.5">
        <span className="text-sm font-bold text-ink">{s.tenantName ?? "Tenant"}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">{s.agentName}</span>
        <span className="border-2 border-ink bg-brut-violet px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-ink">{s.reason}</span>
        <span className="font-mono text-xs font-bold tabular-nums text-ink/70">{s.reasonCount} calls{s.reasonDeltaPct != null ? ` · ▲${s.reasonDeltaPct}%` : " · new"}</span>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-gray-500">Raised {when(s.requestedAt)}</span>
      </div>

      <div className="space-y-3 px-4 py-3">
        {s.operatorNote ? (
          <div className="border-2 border-ink bg-brut-yellow/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/70">Operator note</p>
            <p className="text-sm text-ink">{s.operatorNote}</p>
          </div>
        ) : null}
        {s.rationale ? <p className="max-w-prose text-sm leading-relaxed text-gray-700">{s.rationale}</p> : null}

        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Prompt change</p>
          <PromptDiff oldPrompt={s.oldPrompt} newPrompt={s.newPrompt} />
        </div>

        {s.evidence.length > 0 ? (
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Evidence · {s.evidence.length} call{s.evidence.length === 1 ? "" : "s"}</p>
            <ul className="divide-y-2 divide-gray-100 border-2 border-ink">
              {s.evidence.map((e) => (
                <li key={e.id} className="flex items-start gap-2 px-2.5 py-1.5">
                  <span className="font-mono text-[10px] tabular-nums text-gray-500">{when(e.startedAt)}</span>
                  <span className="border border-ink bg-gray-100 px-1 text-[9px] font-bold uppercase text-ink">{e.outcome}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{e.summary ?? "No summary"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-gray-100 pt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => applyPromptSuggestion({ suggestionId: s.id }))}
            className="brut-press brut-focus inline-flex h-10 items-center border-[3px] border-ink bg-brut-lime px-4 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut disabled:opacity-50"
          >
            Apply to Vapi
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => declinePromptSuggestion({ suggestionId: s.id }))}
            className="brut-press brut-focus inline-flex h-10 items-center border-2 border-ink bg-paper px-3 text-[11px] font-bold uppercase tracking-[0.04em] text-gray-500 disabled:opacity-50"
          >
            Decline
          </button>
          {msg ? <span className="text-xs font-semibold text-brut-red">{msg}</span> : null}
        </div>
      </div>
    </li>
  );
}

function RevisionRowItem({ r }: { r: PromptRevision }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const worse = r.measuredFlaggedRate != null && r.baselineFlaggedRate != null && r.measuredFlaggedRate > r.baselineFlaggedRate;

  return (
    <li className="flex flex-wrap items-center gap-2 border-2 border-ink bg-paper px-4 py-2.5">
      <span className="border border-ink bg-gray-100 px-1.5 text-[10px] font-bold uppercase text-ink">r{r.revision}</span>
      <span className="text-sm font-bold text-ink">{r.tenantName ?? "Tenant"}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">{r.agentName}</span>
      {r.reason ? <span className="border-2 border-ink bg-brut-violet px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">{r.reason}</span> : null}
      <span className="font-mono text-[11px] tabular-nums text-gray-500">
        baseline {pct(r.baselineFlaggedRate)} → measured <span className={worse ? "font-bold text-brut-red" : "text-ink"}>{pct(r.measuredFlaggedRate)}</span>
      </span>
      <span className="ml-auto font-mono text-[11px] tabular-nums text-gray-500">{when(r.appliedAt)}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await rollbackPromptRevision({ revisionId: r.id });
            setMsg(res.error ?? null);
            if (res.ok) router.refresh();
          })
        }
        className="brut-press brut-focus inline-flex h-8 items-center border-2 border-ink bg-brut-orange px-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink disabled:opacity-50"
      >
        Roll back
      </button>
      {msg ? <span className="w-full text-xs font-semibold text-brut-red">{msg}</span> : null}
    </li>
  );
}

export function PromptRequestBoard({ requests, revisions }: { requests: PromptSuggestion[]; revisions: PromptRevision[] }) {
  return (
    <div className="space-y-8">
      <section className="border-[3px] border-ink bg-paper shadow-brut">
        <header className="flex items-center justify-between border-b-[3px] border-ink bg-brut-violet px-5 py-3.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Requests awaiting approval</h2>
          <span className="border-2 border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{requests.length}</span>
        </header>
        {requests.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-600">No prompt-tuning requests from tenants right now.</p>
        ) : (
          <ul className="space-y-4 p-4">{requests.map((s) => <RequestCard key={s.id} s={s} />)}</ul>
        )}
      </section>

      <section className="border-[3px] border-ink bg-paper shadow-brut">
        <header className="flex items-center justify-between border-b-[3px] border-ink bg-brut-cyan px-5 py-3.5">
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Live revisions</h2>
          <span className="border-2 border-ink bg-paper px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-ink">{revisions.length}</span>
        </header>
        {revisions.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-600">No applied prompt revisions yet.</p>
        ) : (
          <ul className="space-y-3 p-4">{revisions.map((r) => <RevisionRowItem key={r.id} r={r} />)}</ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Build the admin page (server component)**

```tsx
// src/app/admin/prompt-tuning/page.tsx
import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/guard";
import { getRequestedSuggestions, getActiveRevisions } from "@/lib/voice/prompt-tuning";
import { PromptRequestBoard } from "./prompt-request-board";

export const metadata: Metadata = { title: "Prompt tuning · Admin · BookMyCab" };
export const dynamic = "force-dynamic";

/**
 * FlowMo staff console for tenant-raised prompt-tuning requests. Staff review the
 * diff + evidence and apply (PATCH Vapi → versioned revision) or decline, and can
 * roll back any live revision. Tenants can only raise requests, never apply.
 */
export default async function AdminPromptTuningPage() {
  await requireStaff();
  const [requests, revisions] = await Promise.all([getRequestedSuggestions(), getActiveRevisions()]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">Prompt tuning</h1>
        <p className="mt-1 text-sm text-gray-600">Approve and apply tenant-raised system-prompt changes, with a reversible revision trail.</p>
      </header>
      <PromptRequestBoard requests={requests} revisions={revisions} />
    </div>
  );
}
```

- [ ] **Step 3: Add the nav item**

In [src/components/admin/admin-shell.tsx](src/components/admin/admin-shell.tsx), add to the `Controls` group's `items` array (after `Rollouts`, line 52):

```tsx
      { label: "Prompt tuning", href: "/admin/prompt-tuning", icon: ico(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3" /></>) },
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build succeeds; `/admin/prompt-tuning` route compiles.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/prompt-tuning/page.tsx src/app/admin/prompt-tuning/prompt-request-board.tsx src/components/admin/admin-shell.tsx
git commit -m "feat(admin): Prompt-tuning console (requests inbox + reversible revisions)"
```

---

## Task 11: Admin notifications for new requests

**Files:**
- Modify: `src/components/dashboard/notification-bell.tsx` (add `prompt_request` kind)
- Modify: `src/app/admin/api/notifications/route.ts` (surface requests)

- [ ] **Step 1: Add the `prompt_request` notification kind**

In [src/components/dashboard/notification-bell.tsx](src/components/dashboard/notification-bell.tsx):

Add to the `NotifKind` union (after `"payment_failed"`, line 12):

```typescript
  | "prompt_request"
```

Add to `KIND_ACCENT` (after the `payment_failed` line, line 32):

```typescript
  prompt_request: "bg-brut-violet",
```

Add a case to `KindIcon`'s switch (before `default`):

```tsx
    case "prompt_request":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className={common} aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="3" /></svg>;
```

- [ ] **Step 2: Surface requests in the admin notifications route**

In [src/app/admin/api/notifications/route.ts](src/app/admin/api/notifications/route.ts), add a third parallel query and merge its items. Replace the `Promise.all` block (lines 22-25) and the items array:

```typescript
  const [{ data: tenants }, { data: autos }, { data: prompts }] = await Promise.all([
    db.from("tenants").select("id, name, created_at").order("created_at", { ascending: false }).limit(15),
    db.from("automations").select("id, name, type, created_at").order("created_at", { ascending: false }).limit(15),
    db
      .from("prompt_suggestions")
      .select("id, reason, requested_at, tenants(name), voice_agents(display_name)")
      .eq("status", "requested")
      .order("requested_at", { ascending: false })
      .limit(15),
  ]);
```

Add to the `items` array (alongside the tenant + automation maps), before the `.sort(...)`:

```typescript
    ...((prompts ?? []) as Array<{ id: string; reason: string; requested_at: string | null; tenants?: { name: string } | null; voice_agents?: { display_name: string } | null }>).map((p) => ({
      id: `prompt-${p.id}`,
      kind: "prompt_request" as const,
      title: "Prompt-tuning request",
      detail: [p.tenants?.name, p.voice_agents?.display_name, p.reason].filter(Boolean).join(" · "),
      ts: p.requested_at ?? new Date().toISOString(),
      read: false,
    })),
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/notification-bell.tsx src/app/admin/api/notifications/route.ts
git commit -m "feat(admin): notify staff when a tenant raises a prompt-tuning request"
```

---

## Task 12: Cron route — detect new suggestions + measure revisions

**Files:**
- Create: `src/app/api/voice/prompt-tuning/cron/route.ts`

- [ ] **Step 1: Write the bearer-gated sweep route**

```typescript
// src/app/api/voice/prompt-tuning/cron/route.ts
import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { bearerMatches } from "@/lib/voice/ingest-auth";
import { detectAllPromptSuggestions, measureRevisions } from "@/lib/voice/prompt-tuning";

export const runtime = "nodejs";
// One LLM draft per tenant with a rising reason + a measure pass — give it room.
export const maxDuration = 300;

/**
 * Prompt-tuning sweep. Detects new prompt suggestions across all tenants (cluster
 * a rising failure reason → draft a revision) and measures applied revisions past
 * their dwell window (auto-rolling-back ones that worsened). Authenticated with
 * the same bearer as voice ingest; point a daily cron at it. Idempotent: detection
 * refreshes the open draft per agent+reason; measurement only runs once per
 * revision.
 */
export async function POST(req: Request) {
  if (!bearerMatches(req.headers.get("authorization"), env.VOICE_INGEST_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const detect = await detectAllPromptSuggestions();
    const measure = await measureRevisions();
    return NextResponse.json({ detect, measure });
  } catch (e) {
    console.error("prompt-tuning sweep failed", e);
    return NextResponse.json({ error: "Prompt-tuning sweep failed." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds; the route is present.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/voice/prompt-tuning/cron/route.ts
git commit -m "feat(voice): cron route to detect suggestions + measure/auto-rollback"
```

---

## Task 13: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 2: Run the whole test suite**

Run: `npm run test`
Expected: all tests pass, including the four new files (`prompt-tuning-migration`, `vapi-client`, `prompt-diff`, `prompt-tuning-detector`).

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no errors or warnings about the new routes/pages/actions.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: clean (fix any unused imports left behind in `quality.ts` / `page.tsx` from the removal in Task 3).

- [ ] **Step 5: Apply the migration (out-of-band) and smoke-check manually**

The migration is not auto-applied in this loop. When ready, apply `supabase/migrations/0067_prompt_tuning.sql` to the project, then manually verify the end-to-end path against a tenant with a wired Voice agent (`voice_agents.vapi_assistant_id` set) and `GEMINI_API_KEY` + `VAPI_API_KEY` configured:

  1. **Detect:** On `/dashboard/voice/quality`, the "Prompt-tuning suggestions" section appears below the Call Inspector; click **Check for suggestions**. With a rising flagged reason in the last 30 days, a draft card shows the reason, the diff (old vs new prompt) and up to 5 evidence calls.
  2. **Raise:** Click **Send to FlowMo to apply** (optionally with a note). The card flips to a "Sent to FlowMo" badge.
  3. **Admin receives:** As a FlowMo staff user, the notification bell shows a "Prompt-tuning request"; `/admin/prompt-tuning` lists it under "Requests awaiting approval" with the tenant, agent, reason, operator note, diff and evidence.
  4. **Apply:** Click **Apply to Vapi** → the Vapi assistant's system prompt updates, a revision appears under "Live revisions" (baseline rate shown), and the tenant's card flips to "Applied".
  5. **Rollback:** Click **Roll back** on the live revision → Vapi reverts to the previous prompt and the revision moves out of the active list (a new `rollback` revision becomes active).
  6. **Confirm tenants cannot apply:** there is no apply control on the tenant panel — only "Send to FlowMo" / "Dismiss".

- [ ] **Step 6: Final commit (if Step 4 required cleanup)**

```bash
git add -A
git commit -m "chore(voice): lint + typecheck cleanup for prompt-tuning"
```

---

## Self-Review notes (author)

- **Spec coverage:**
  - *Remove "Failure reasons over time" from Agent Quality* → Task 3 (deletes `FailureClusters`/`AgentQualityBoard`, strips `failures` from `quality.ts`, renders `CallInspector` alone).
  - *New "Prompt-tuning suggestions" below Call Inspector* → Task 7 (`PromptTuningPanel` placed under `CallInspector`).
  - *suggest → preview → approve → measure → rollback loop* → detector (Task 5), preview diff+evidence (Tasks 4 & 7), approve/apply (Tasks 8–9), measure + auto-rollback (Task 8 `measureRevisions`, Task 12 cron), one-click rollback (Tasks 8–10).
  - *Detector clusters a rising failure reason → drafts a revised prompt via LLM* → `pickRisingReason` + `draftRevision` (Task 5).
  - *UI shows diff (old vs new) + the 5 triggering calls* → `PromptDiff` + evidence list (Tasks 4, 7, 10).
  - *Staff clicks Apply → PATCH Vapi → write prompt_revision (who/when/why/diff)* → `applySuggestion` (Task 8) + admin action audit (Task 9); revision row stores `applied_by`/`applied_at`/`reason`/`rationale`/`old_prompt`/`new_prompt`.
  - *One-click rollback / auto-rollback on threshold* → `rollbackRevision` (manual via admin Task 10) + `measureRevisions` auto-rollback (Task 8 + cron Task 12).
  - *Proper Supabase table with changes to roll back* → migration 0067, `prompt_revisions` versioned + reversible (Task 1).
  - *Operator raises to admin; only FlowMo staff applies* → tenant `requestPromptSuggestion` (Task 6) + staff-only `applyPromptSuggestion` (Task 9); the tenant panel has no apply control.
  - *Admin Dashboard section receiving the request with comprehensive details* → `/admin/prompt-tuning` (Task 10) + notification bell (Task 11).
- **Type consistency:** `PromptSuggestion`/`PromptRevision`/`EvidenceCall`/`RisingReason`/`ApplyResult`/`PromptActionState`/`AdminPromptActionState` defined once and reused; `reviewReasons`/`FlagInput` exported from `quality.ts` and consumed by the detector + measure; action input shapes (`{ suggestionId }`, `{ revisionId }`, `{ suggestionId, note }`) consistent between components and actions.
- **No placeholders:** every code step contains complete code; commands include expected output.
