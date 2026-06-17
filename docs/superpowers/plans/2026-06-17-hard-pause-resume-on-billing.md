# Hard Pause / Resume on Billing Lapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** When a tenant's subscription lapses **or** their AI Voice credit runs out, immediately stop service — deny at the gate (VAPI can't answer/act, chat gateway stops forwarding) AND deactivate the tenant's n8n workflow(s) — with **no grace period**; resume (re-allow + reactivate n8n) the moment the subscription returns to active **or** a voice credit top-up is paid.

**Architecture:** Two layers. (1) The existing dynamic gates already refuse service when `*_subscriptions.status !== 'active'` or voice credit is exhausted — we make them strict (Stripe `past_due` → `paused`, so a failed/late renewal stops immediately, no grace). (2) A new system-level pause/resume that physically deactivates/reactivates the tenant's n8n workflows, driven by the Stripe subscription webhook, the credit top-up webhook, and the voice call-ingest credit-exhaustion path. A `billing_paused` flag separates billing pauses from manual admin stops so resume never clobbers an admin-stopped automation.

**Tech Stack:** Next.js 15 + TypeScript, Supabase (PG + RLS), Stripe webhooks, n8n via `EngineClient`, Vitest.

## Decisions locked
1. **No grace** — `past_due`/`unpaid` stop service immediately (not just `cancelled`).
2. **Stop mechanism** — strict gate (VAPI stop) + deactivate n8n. No VAPI phone-number surgery.
3. **Resume triggers** — subscription back to `active` (Stripe) OR a paid voice credit top-up.
4. Builds on the shipped chat gate (`chatServiceAllowed`) + voice authorize gate (`decideCallAuthorization`).

## File Structure
**Create:** `supabase/migrations/0069_automations_billing_paused.sql`; `src/lib/engine/billing-pause.ts`; `tests/engine-billing-pause.test.ts`.
**Modify:** `src/lib/billing/event-map.ts` (+ `tests/billing-event-map.test.ts`); `src/lib/admin/audit.ts` (widen actor to nullable); `src/lib/billing/webhook-deps.ts` (subscription + top-up triggers); `src/app/api/voice/calls/ingest/route.ts` (credit-exhaustion pause); resolver-loader already exposes `chatSubStatus`.

---

## Task A: No-grace — `past_due`/`unpaid` stop immediately

**Files:** Modify `src/lib/billing/event-map.ts`; Test `tests/billing-event-map.test.ts`.

- [ ] **Step 1: Update the status-map test.** In `tests/billing-event-map.test.ts`, find the `mapNewModelSubscription` cases and add/adjust so `past_due` maps to `paused`:

```ts
  it("past_due / unpaid map to paused (no grace — service stops on a failed renewal)", () => {
    const base = { id: "sub_1", metadata: { tenant_id: "t1", product: "voice" }, items: { data: [{}] } };
    expect(mapNewModelSubscription({ ...base, status: "past_due" } as never)!.update.status).toBe("paused");
    expect(mapNewModelSubscription({ ...base, status: "unpaid" } as never)!.update.status).toBe("paused");
  });
```

(If an existing case asserts `past_due → active`, change it to `paused`.)

- [ ] **Step 2: Run it — expect FAIL.** `npx vitest run tests/billing-event-map.test.ts`

- [ ] **Step 3: Change the map** in `src/lib/billing/event-map.ts`:

```ts
const STRIPE_STATUS_MAP: Record<string, "active" | "paused" | "cancelled"> = {
  active: "active", trialing: "active",
  past_due: "paused", paused: "paused", unpaid: "paused",
  canceled: "cancelled", incomplete_expired: "cancelled",
};
```

(Only `past_due` changes: `active` → `paused`.)

- [ ] **Step 4: Run it — expect PASS.** `npx vitest run tests/billing-event-map.test.ts`
- [ ] **Step 5: Commit** `git add src/lib/billing/event-map.ts tests/billing-event-map.test.ts && git commit -m "feat(billing): no grace — past_due/unpaid stop service immediately"`

---

## Task B: `billing_paused` flag (separate billing pauses from manual stops)

**Files:** Create `supabase/migrations/0069_automations_billing_paused.sql`.

- [ ] **Step 1: Write the migration.**

```sql
-- 0069: mark automations paused by a billing lapse, so resume reactivates only
-- those (never an automation an admin deliberately stopped).
alter table public.automations
  add column if not exists billing_paused boolean not null default false;
```

- [ ] **Step 2: Apply via Supabase MCP** — `mcp__supabase__apply_migration` name `0069_automations_billing_paused`. Verify with `execute_sql`: `select count(*) from information_schema.columns where table_name='automations' and column_name='billing_paused';` → 1.
- [ ] **Step 3: Advisors** — `mcp__supabase__get_advisors type=security`; confirm no new findings.
- [ ] **Step 4: Commit** `git add supabase/migrations/0069_automations_billing_paused.sql && git commit -m "feat(db): automations.billing_paused flag"`

---

## Task C: System pause/resume control + widen audit actor

**Files:** Modify `src/lib/admin/audit.ts`; Create `src/lib/engine/billing-pause.ts`; Test `tests/engine-billing-pause.test.ts`.

- [ ] **Step 1: Widen the audit actor to nullable** in `src/lib/admin/audit.ts`. Change the type field:

```ts
  /** UUID of the user performing the action, or null for system/webhook-driven actions. */
  actorUserId: string | null;
```

The insert already does `actor_user_id: entry.actorUserId` and `audit_log.actor_user_id` is a nullable FK, so null is valid.

- [ ] **Step 2: Write the failing test** `tests/engine-billing-pause.test.ts` (mock the engine client + a Supabase-like db + cache + audit):

```ts
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

const deactivate = vi.fn(async () => {});
const activate = vi.fn(async () => {});
vi.mock("@/lib/engine/client", () => ({
  EngineClient: { fromEnv: () => ({ deactivate, activate }) },
}));
const del = vi.fn(async () => {});
vi.mock("@/lib/redis/cache", () => ({ del: (...a: unknown[]) => del(...a) }));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn(async () => true) }));

// Hand-rolled query builder over a fixture set of automations.
function makeDb(rows: Array<{ id: string; type: string; engine_workflow_id: string | null; status: string; billing_paused: boolean }>) {
  const updates: Array<Record<string, unknown>> = [];
  const api = {
    _rows: rows,
    _updates: updates,
    from() { return api; },
    select() { return api; },
    eq() { return api; },
    neq() { return api; },
    in() { return api; },
    update(patch: Record<string, unknown>) { api._lastPatch = patch; return api; },
    async then() {}, // not used
  } as any;
  return api;
}

import { selectProductAutomations } from "@/lib/engine/billing-pause";

describe("selectProductAutomations (pure filter)", () => {
  const rows = [
    { id: "v1", type: "Voice", engine_workflow_id: "wfv", status: "live", billing_paused: false },
    { id: "c1", type: "Booking", engine_workflow_id: "wfc", status: "live", billing_paused: false },
    { id: "c2", type: "Support", engine_workflow_id: null, status: "live", billing_paused: false },
  ];
  it("voice product → only Voice automations", () => {
    expect(selectProductAutomations(rows, "voice").map((a) => a.id)).toEqual(["v1"]);
  });
  it("chat product → only non-Voice automations", () => {
    expect(selectProductAutomations(rows, "chat").map((a) => a.id)).toEqual(["c1", "c2"]);
  });
});
```

- [ ] **Step 3: Run it — expect FAIL.** `npx vitest run tests/engine-billing-pause.test.ts`

- [ ] **Step 4: Create `src/lib/engine/billing-pause.ts`:**

```ts
import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { EngineClient } from "@/lib/engine/client";
import { writeAudit } from "@/lib/audit";
import { del } from "@/lib/redis/cache";
import { automationCacheKey } from "@/lib/webhooks/resolver";

export type BillingProduct = "chat" | "voice";

export interface PausableAutomation {
  id: string;
  type: string;
  engine_workflow_id: string | null;
  status: string;
  billing_paused: boolean;
}

function db() {
  return createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Pure: which of a tenant's automations belong to a billing product. Voice
 *  agents are type 'Voice'; everything else (Booking/Support/Driver/Custom) is
 *  the chat product. */
export function selectProductAutomations<T extends { type: string }>(rows: T[], product: BillingProduct): T[] {
  return rows.filter((a) => (product === "voice" ? a.type === "Voice" : a.type !== "Voice"));
}

async function loadAutomations(tenantId: string): Promise<PausableAutomation[]> {
  const { data } = await db()
    .from("automations")
    .select("id, type, engine_workflow_id, status, billing_paused")
    .eq("tenant_id", tenantId);
  return (data ?? []) as PausableAutomation[];
}

/**
 * Hard-pause a tenant's automations for a product on a billing lapse: deactivate
 * the n8n workflow, mark status 'stopped' + billing_paused, and invalidate the
 * resolver cache so the gateway stops forwarding immediately. Best-effort per
 * automation (a single engine error must not abort the rest). Idempotent: an
 * already-stopped automation is skipped.
 */
export async function pauseTenantProduct(tenantId: string, product: BillingProduct): Promise<void> {
  const targets = selectProductAutomations(await loadAutomations(tenantId), product)
    .filter((a) => a.status !== "stopped");
  for (const a of targets) {
    try {
      if (a.engine_workflow_id) await EngineClient.fromEnv().deactivate(a.engine_workflow_id);
    } catch (err) {
      console.error("pauseTenantProduct: engine deactivate failed", { automation: a.id, err });
    }
    await db().from("automations").update({ status: "stopped", billing_paused: true, updated_at: new Date().toISOString() }).eq("id", a.id);
    try { await del(automationCacheKey(a.id)); } catch { /* cache best-effort */ }
  }
  if (targets.length > 0) {
    await writeAudit({ actorUserId: null, tenantId, action: "automation.billing_pause", targetType: "tenant", targetId: tenantId, metadata: { product, count: targets.length } });
  }
}

/**
 * Resume a tenant's automations for a product on payment. Reactivates ONLY
 * automations this billing flow paused (`billing_paused = true`), so an
 * admin-stopped automation is never silently brought back. Best-effort per item.
 */
export async function resumeTenantProduct(tenantId: string, product: BillingProduct): Promise<void> {
  const targets = selectProductAutomations(await loadAutomations(tenantId), product)
    .filter((a) => a.billing_paused);
  for (const a of targets) {
    try {
      if (a.engine_workflow_id) await EngineClient.fromEnv().activate(a.engine_workflow_id);
    } catch (err) {
      console.error("resumeTenantProduct: engine activate failed", { automation: a.id, err });
    }
    await db().from("automations").update({ status: "live", billing_paused: false, updated_at: new Date().toISOString() }).eq("id", a.id);
    try { await del(automationCacheKey(a.id)); } catch { /* cache best-effort */ }
  }
  if (targets.length > 0) {
    await writeAudit({ actorUserId: null, tenantId, action: "automation.billing_resume", targetType: "tenant", targetId: tenantId, metadata: { product, count: targets.length } });
  }
}
```

- [ ] **Step 5: Run it — expect PASS.** `npx vitest run tests/engine-billing-pause.test.ts`
- [ ] **Step 6: Commit** `git add src/lib/admin/audit.ts src/lib/engine/billing-pause.ts tests/engine-billing-pause.test.ts && git commit -m "feat(engine): system pause/resume of a tenant's product automations"`

---

## Task D: Drive pause/resume from the Stripe subscription webhook

**Files:** Modify `src/lib/billing/webhook-deps.ts`.

- [ ] **Step 1:** Add the import `import { pauseTenantProduct, resumeTenantProduct, type BillingProduct } from "@/lib/engine/billing-pause";` (keep existing `del`/`automationCacheKey` imports — they're now used inside billing-pause but the chat-cache block below is replaced).

- [ ] **Step 2:** Replace the `updateNewModelSubscription` body's chat-cache-invalidation block (added previously) with a generalized pause/resume on status change:

```ts
    async updateNewModelSubscription(out) {
      const { error } = await db
        .from(out.table)
        .update(out.update)
        .eq("stripe_subscription_id", out.stripe_subscription_id);
      if (error) throw new Error(`updateNewModelSubscription failed: ${error.message}`);

      // Drive the hard pause/resume off the mirrored status. A subscription that
      // is no longer active (paused/cancelled — incl. past_due via the status
      // map, no grace) pauses that product's automations; a return to active
      // resumes the ones this flow paused. Best-effort: never fail the webhook.
      try {
        const product: BillingProduct = out.table === "chat_subscriptions" ? "chat" : "voice";
        const { data: sub } = await db
          .from(out.table)
          .select("tenant_id")
          .eq("stripe_subscription_id", out.stripe_subscription_id)
          .maybeSingle();
        const tenantId = (sub as { tenant_id?: string } | null)?.tenant_id;
        if (tenantId) {
          if (out.update.status === "active") await resumeTenantProduct(tenantId, product);
          else await pauseTenantProduct(tenantId, product);
        }
      } catch (err) {
        console.error("updateNewModelSubscription: pause/resume failed", err);
      }
    },
```

(`pauseTenantProduct`/`resumeTenantProduct` invalidate the resolver cache themselves, so the previously-added standalone chat-cache block is fully replaced.)

- [ ] **Step 3:** `npx vitest run tests/billing-handle-event.test.ts tests/billing-webhook-route.test.ts` — expect PASS (these mock `buildBillingDeps`, so they're unaffected; confirm green).
- [ ] **Step 4: Commit** `git add src/lib/billing/webhook-deps.ts && git commit -m "feat(billing): subscription status change pauses/resumes the product's automations"`

---

## Task E: Resume on credit top-up + pause on credit exhaustion

**Files:** Modify `src/lib/billing/webhook-deps.ts` (top-up resume); `src/app/api/voice/calls/ingest/route.ts` (exhaustion pause).

- [ ] **Step 1: Resume voice on a paid top-up.** In `buildGrantTopupCredits` (webhook-deps), after the credits are successfully inserted (the non-duplicate path), add a best-effort resume:

```ts
      // A paid top-up clears a credit-exhaustion pause: bring voice back online.
      try { await resumeTenantProduct(tenantId, "voice"); } catch (err) { console.error("grantTopupCredits: voice resume failed", err); }
```

(Place it after the successful insert / before the coupon block; `tenantId` is the dep arg. The import from Task D is already present.)

- [ ] **Step 2: Pause voice when a call exhausts credit.** In `src/app/api/voice/calls/ingest/route.ts`, after `record_voice_call` returns `data`, the RPC result carries `credit_source`/`charged`/`credit_balance`. When the plan pool is exhausted AND credit is now 0 (i.e. the call was `no_credit`, or it drew the last top-up credit), pause voice in the background:

```ts
  // Credit-exhaustion hard pause (no grace): when this call left the tenant with
  // no plan headroom and no credit, deactivate voice until a top-up/renewal.
  const result = data as { credit_source?: string; credit_balance?: number; outcome?: string; allowance?: number; used?: number } | null;
  const exhausted =
    result?.outcome === "no_credit" ||
    (Number(result?.credit_balance ?? 0) <= 0 && Number(result?.used ?? 0) >= Number(result?.allowance ?? 0));
  if (exhausted) {
    after(async () => {
      try {
        const { pauseTenantProduct } = await import("@/lib/engine/billing-pause");
        await pauseTenantProduct(d.tenant_id, "voice");
      } catch (err) {
        console.error("voice ingest: credit-exhaustion pause failed", err);
      }
    });
  }
```

(`after` is already imported in this route. The dynamic import keeps the engine module off the hot path until needed. Confirm the RPC JSON actually returns `credit_balance`/`used`/`allowance`/`outcome` — it does, per `record_voice_call`'s `jsonb_build_object`; adapt key names to the RPC's real output if they differ.)

- [ ] **Step 3:** `npx vitest run tests/billing-credit-checkout.test.ts tests/billing-handle-event.test.ts` — expect PASS.
- [ ] **Step 4: Commit** `git add src/lib/billing/webhook-deps.ts "src/app/api/voice/calls/ingest/route.ts" && git commit -m "feat(billing): top-up resumes voice; credit exhaustion pauses voice"`

---

## Task F: Verify + sandbox proof

- [ ] **Step 1:** `npm run typecheck` — PASS (fix any leftover `actorUserId` non-null callers; widening to nullable is backward-compatible).
- [ ] **Step 2:** `npm run test` — the pricing/billing/engine/gate tests pass; only the known pre-existing unrelated failures (DB-integration rls/hook/admin-rls, auth-forms, dashboard-format, epic-10-voice, marketing-demo-whatsapp) remain. Confirm the failing set didn't grow.
- [ ] **Step 3:** `npm run build` — PASS.
- [ ] **Step 4: Sandbox proof** — extend a script (or reuse `scripts/sandbox-renewal-autopay.ts`) to assert, via the pure layer + a fake engine client: (a) `mapNewModelSubscription({status:'past_due'})` → `paused`; (b) `pauseTenantProduct` deactivates the right workflows + sets `billing_paused`; (c) `resumeTenantProduct` reactivates only `billing_paused` ones. Print PASS/FAIL lines. (No live n8n/VAPI calls in the sandbox — the engine client is faked.)
- [ ] **Step 5: Commit** any fixups.

---

## Self-review
- **Coverage:** no grace (A: past_due→paused) ✓; stop = gate (already) + n8n deactivate (C/D) ✓; trigger = subscription lapse (D) AND credit exhaustion (E) ✓; resume = subscription active (D) AND credit top-up (E) ✓; chat = n8n deactivate via same flow (product='chat') ✓; voice = gate + n8n deactivate (VAPI stops via gate) ✓.
- **Manual-stop safety:** resume only reactivates `billing_paused=true` automations — an admin stop (billing_paused=false) is never auto-resumed.
- **Webhook safety:** all pause/resume is best-effort wrapped; a missed/failed engine call never fails the Stripe webhook, and the gate still blocks service regardless (so a tenant is never *served* while unpaid even if n8n deactivation lags).
- **Type consistency:** `pauseTenantProduct`/`resumeTenantProduct`/`selectProductAutomations`/`BillingProduct`/`billing_paused`/`actorUserId: string | null` used consistently.
