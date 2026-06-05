# Epic 26: Feature-Rollout Console — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give FlowMo staff an admin console to manage **feature rollouts** — per-feature strategy (`all` / `percentage` / `allowlist` / `off`), percentage, and a kill-switch — over the `feature_rollouts` table. This is the platform-wide safety valve: staff can stage a feature to a % of tenants or kill it instantly, and the entitlement resolver honours it immediately. Admin-only (`requireStaff`).

**Architecture:** No new tables — `feature_rollouts` already exists (Epic 13). A pure validator guards strategy/percentage. An admin service lists every catalog feature with its current rollout row (defaulting to "all" when absent) and upserts a rollout, invalidating the entitlement resolver cache so the change takes effect at once. A server action (`requireStaff`) backs the page; an admin page renders a per-feature control table. Nav entry added.

**Tech Stack:** TypeScript, Next.js App Router (server component + server action), Supabase service-role client, Vitest. Builds on Epic 13 (`feature_rollouts`, `FEATURE_CATALOG`, `invalidateEntitlements`), Epic 3 (`requireStaff`, admin shell).

**Dependencies:** Epic 13. Mirrors the established epic structure; **no migration** (Task 1 is pure logic).

---

## File Map

### New — Core library
- `src/lib/admin/rollouts.ts` — pure `validateRollout(input)` + service `listRollouts()`, `setRollout(...)`

### New — Admin
- `src/app/admin/rollouts/page.tsx` — per-feature rollout control table
- `src/app/admin/rollouts/actions.ts` — server action `setRolloutAction` (requireStaff)

### Modified
- `src/components/admin/admin-shell.tsx` — add "Rollouts" nav entry

### Test files
- `tests/admin-rollouts.test.ts` — pure `validateRollout`

---

## Task 1: Pure rollout validation + service

**Files:** Create `src/lib/admin/rollouts.ts`; Test `tests/admin-rollouts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/admin-rollouts.test.ts
import { describe, it, expect } from "vitest";
import { validateRollout } from "@/lib/admin/rollouts";

describe("validateRollout", () => {
  it("accepts a valid percentage rollout", () => {
    expect(validateRollout({ strategy: "percentage", percentage: 25, killSwitch: false })).toEqual({ ok: true });
  });
  it("accepts all/off/allowlist strategies", () => {
    for (const strategy of ["all", "off", "allowlist"] as const) {
      expect(validateRollout({ strategy, percentage: 100, killSwitch: false }).ok).toBe(true);
    }
  });
  it("rejects an unknown strategy", () => {
    expect(validateRollout({ strategy: "sideways" as never, percentage: 100, killSwitch: false }).ok).toBe(false);
  });
  it("rejects a percentage outside 0–100", () => {
    expect(validateRollout({ strategy: "percentage", percentage: 150, killSwitch: false }).ok).toBe(false);
    expect(validateRollout({ strategy: "percentage", percentage: -1, killSwitch: false }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/admin-rollouts.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/admin/rollouts.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { FEATURE_KEYS, FEATURE_CATALOG } from "@/lib/entitlements/catalog";
import { invalidateEntitlements } from "@/lib/entitlements/resolve";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export type RolloutStrategy = "all" | "percentage" | "allowlist" | "off";

export interface RolloutInput {
  strategy: RolloutStrategy;
  percentage: number;
  killSwitch: boolean;
}

const STRATEGIES: RolloutStrategy[] = ["all", "percentage", "allowlist", "off"];

/** Pure: validate a rollout input. Returns { ok } or { ok:false, error }. */
export function validateRollout(input: RolloutInput): { ok: boolean; error?: string } {
  if (!STRATEGIES.includes(input.strategy)) return { ok: false, error: "Unknown strategy." };
  if (!Number.isFinite(input.percentage) || input.percentage < 0 || input.percentage > 100) {
    return { ok: false, error: "Percentage must be between 0 and 100." };
  }
  return { ok: true };
}

export interface RolloutRow {
  featureKey: string;
  name: string;
  category: string;
  strategy: RolloutStrategy;
  percentage: number;
  killSwitch: boolean;
}

/** Every catalog feature with its current rollout (defaults to fully-on when no row). */
export async function listRollouts(): Promise<RolloutRow[]> {
  const { data } = await svc().from("feature_rollouts").select("feature_key, strategy, percentage, kill_switch");
  const byKey = new Map((data ?? []).map((r) => [r.feature_key as string, r]));
  return FEATURE_KEYS.map((key) => {
    const r = byKey.get(key);
    const f = FEATURE_CATALOG[key];
    return {
      featureKey: key,
      name: f.name,
      category: f.category,
      strategy: ((r?.strategy as RolloutStrategy) ?? "all"),
      percentage: (r?.percentage as number) ?? 100,
      killSwitch: (r?.kill_switch as boolean) ?? false,
    };
  });
}

/** Upsert a feature's rollout and invalidate the resolver cache (affects all tenants). */
export async function setRollout(featureKey: string, input: RolloutInput): Promise<{ ok: boolean; error?: string }> {
  const v = validateRollout(input);
  if (!v.ok) return v;
  if (!FEATURE_KEYS.includes(featureKey as never)) return { ok: false, error: "Unknown feature." };
  await svc().from("feature_rollouts").upsert(
    { feature_key: featureKey, strategy: input.strategy, percentage: input.percentage, kill_switch: input.killSwitch, updated_at: new Date().toISOString() },
    { onConflict: "feature_key" },
  );
  invalidateEntitlements(); // a rollout change affects every tenant's resolution
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/admin-rollouts.test.ts` — Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/admin/rollouts.ts tests/admin-rollouts.test.ts
git commit -m "feat(admin): feature-rollout validation + list/set service (cache-invalidating)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Admin rollouts page + action + nav

**Files:** Create `src/app/admin/rollouts/actions.ts`, `src/app/admin/rollouts/page.tsx`; Modify `src/components/admin/admin-shell.tsx`

- [ ] **Step 1: Create `src/app/admin/rollouts/actions.ts`**

```typescript
"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setRollout, type RolloutStrategy } from "@/lib/admin/rollouts";
import { revalidatePath } from "next/cache";

export async function setRolloutAction(formData: FormData): Promise<void> {
  await requireStaff();
  const featureKey = String(formData.get("featureKey"));
  const strategy = String(formData.get("strategy")) as RolloutStrategy;
  const percentage = Number(formData.get("percentage"));
  const killSwitch = formData.getAll("killSwitch").includes("true");
  await setRollout(featureKey, { strategy, percentage: Number.isFinite(percentage) ? percentage : 100, killSwitch });
  revalidatePath("/admin/rollouts");
}
```

- [ ] **Step 2: Create `src/app/admin/rollouts/page.tsx`**

```tsx
import { requireStaff } from "@/lib/admin/guard";
import { listRollouts } from "@/lib/admin/rollouts";
import { setRolloutAction } from "./actions";

export const metadata = { title: "Rollouts — Admin" };

const STRATEGIES = ["all", "percentage", "allowlist", "off"];

export default async function RolloutsPage() {
  await requireStaff();
  const rollouts = await listRollouts();
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Feature rollouts</h1>
      <p className="mb-4 text-sm text-slate-500">Stage a feature to a % of tenants, restrict to an allowlist, or kill it instantly. Applies platform-wide within ~30s.</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50"><tr>{["Feature", "Strategy", "%", "Kill", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rollouts.map((r) => (
              <tr key={r.featureKey} className={r.killSwitch || r.strategy === "off" ? "bg-red-50" : ""}>
                <td className="px-3 py-2"><span className="font-medium text-slate-800">{r.name}</span><br /><span className="text-[11px] text-slate-400">{r.featureKey}</span></td>
                <td className="px-3 py-2" colSpan={3}>
                  <form action={setRolloutAction} className="flex items-center gap-2">
                    <input type="hidden" name="featureKey" value={r.featureKey} />
                    <select name="strategy" defaultValue={r.strategy} className="rounded border border-slate-300 px-2 py-1 text-xs">
                      {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input name="percentage" type="number" min={0} max={100} defaultValue={r.percentage} className="w-16 rounded border border-slate-300 px-2 py-1 text-xs" />
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      <input type="hidden" name="killSwitch" value="false" />
                      <input type="checkbox" name="killSwitch" value="true" defaultChecked={r.killSwitch} /> kill
                    </label>
                    <button type="submit" className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white">Save</button>
                  </form>
                </td>
                <td className="px-3 py-2 text-right">{r.killSwitch ? <span className="text-xs font-medium text-red-600">KILLED</span> : r.strategy === "off" ? <span className="text-xs text-slate-400">off</span> : <span className="text-xs text-emerald-600">live</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add "Rollouts" nav entry**

In `src/components/admin/admin-shell.tsx`, add `{ label: "Rollouts", href: "/admin/rollouts" }` to `NAV_ITEMS` after "Plans", matching the exact existing shape.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/admin/rollouts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/rollouts src/components/admin/admin-shell.tsx
git commit -m "feat(admin): feature-rollout console page + nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Integration gate

- [ ] **Step 1: Run the rollout test + full typecheck**

Run: `npx vitest run tests/admin-rollouts.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 2: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 3: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(admin): rollout console gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Per-feature rollout strategy + percentage + kill-switch | Tasks 1, 2 |
| Validation (strategy set, 0–100%) | Task 1 |
| Resolver cache invalidated on change | Task 1 (`invalidateEntitlements`) |
| Admin-only (`requireStaff`) | Task 2 |
| No new tables | (by design) |

**Placeholder scan:** none.

**Type consistency:** `RolloutStrategy`/`RolloutInput`/`RolloutRow` in rollouts.ts used by action + page. `validateRollout` pure + tested. `setRollout` invalidates the resolver cache (rollouts are read by `mergeEntitlements`). `requireStaff` gates the page + action.

**Known limitations (documented):** the allowlist strategy is settable but its UUID list isn't edited from this page (a per-tenant allowlist editor is a fast-follow — the merge logic already honours `allowlist`); percentage bucketing is deterministic per (tenant, feature) via the existing `mergeEntitlements` FNV hash.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-epic-26-rollout-console.md`.

**3 tasks, no migration. Task 1 (pure+service) gates 2; 3 last.**
