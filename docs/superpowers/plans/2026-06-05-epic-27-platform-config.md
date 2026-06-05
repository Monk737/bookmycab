# Epic 27: Admin Platform Config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One admin "Platform config" surface for the remaining FlowMo-owned provisioning: **commission rates** (FlowMo's cut per tenant), **channel apps** (`platform_apps` — WhatsApp BSP / Meta app config), and **notification senders** (`platform_senders` — Resend domain / Twilio number / Slack app). Admin-only (`requireStaff`).

**Architecture:** Migration 0031 creates the missing `platform_senders` table (global, service-role-only RLS). `commission_rates` and `platform_apps` already exist. A pure validator guards sender/app input; an admin service does service-role CRUD for all three; server actions (`requireStaff`) back one `/admin/platform` page with three sections.

**Tech Stack:** Supabase Postgres (RLS), TypeScript, Next.js App Router (server component + server actions), Vitest. Builds on Epic 20 (`commission_rates`), Epic 22 (`platform_apps`), Epic 3 (`requireStaff`, admin shell).

**Dependencies:** Epics 20/22/3. Mirrors the established epic structure.

---

## File Map

### New — Database
- `supabase/migrations/0031_platform_senders.sql` — `platform_senders` (global)

### New — Core library
- `src/lib/admin/platform-config.ts` — pure `validateSender`/`validateApp` + service (commission/apps/senders CRUD)

### New — Admin
- `src/app/admin/platform/page.tsx` — commission + apps + senders sections
- `src/app/admin/platform/actions.ts` — server actions (requireStaff)

### Modified
- `src/components/admin/admin-shell.tsx` — add "Platform" nav entry

### Test files
- `tests/admin-platform-config.test.ts` — pure validators
- `tests/platform-senders-migration.test.ts` — 0031 structure

---

## Task 1: Migration 0031 — platform_senders

**Files:** Create `supabase/migrations/0031_platform_senders.sql`; Test `tests/platform-senders-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/platform-senders-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0031_platform_senders.sql"), "utf8");

describe("0031 platform_senders migration", () => {
  it("creates platform_senders with a type check", () => {
    expect(sql).toMatch(/create table public\.platform_senders/i);
    expect(sql).toMatch(/type text not null check \(type in \('email','sms','slack'\)\)/i);
  });
  it("enables RLS (global / service-role only — no tenant policy)", () => {
    expect(sql).toMatch(/alter table public\.platform_senders enable row level security/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/platform-senders-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0031_platform_senders.sql`**

```sql
-- 0031: Platform notification senders (global, FlowMo-owned).
--
-- Resend domains, Twilio numbers, Slack apps used to deliver tenant alerts.
-- Global config — RLS enabled with NO tenant policy (service-role only), like
-- platform_apps (0028).

create table public.platform_senders (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('email','sms','slack')),
  identifier      text not null,
  provider        text,
  credentials_ref text,
  status          text not null default 'active' check (status in ('active','disabled')),
  created_at      timestamptz not null default now()
);

alter table public.platform_senders enable row level security;
```

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/platform-senders-migration.test.ts`
Expected: applied; 2 tests PASS. (If `db push` replays a prior migration, apply via `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0031_platform_senders.sql`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0031_platform_senders.sql tests/platform-senders-migration.test.ts
git commit -m "feat(admin): migration 0031 — platform_senders (global notification senders)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure validators + platform-config service

**Files:** Create `src/lib/admin/platform-config.ts`; Test `tests/admin-platform-config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/admin-platform-config.test.ts
import { describe, it, expect } from "vitest";
import { validateSender, validateApp } from "@/lib/admin/platform-config";

describe("validateSender", () => {
  it("accepts a valid email sender", () => {
    expect(validateSender({ type: "email", identifier: "hello@cabbybot.com" }).ok).toBe(true);
  });
  it("rejects an unknown type", () => {
    expect(validateSender({ type: "pigeon" as never, identifier: "x" }).ok).toBe(false);
  });
  it("rejects an empty identifier", () => {
    expect(validateSender({ type: "sms", identifier: "  " }).ok).toBe(false);
  });
});

describe("validateApp", () => {
  it("accepts a provider + identifier", () => {
    expect(validateApp({ provider: "meta", identifier: "wa-123" }).ok).toBe(true);
  });
  it("rejects missing provider", () => {
    expect(validateApp({ provider: "", identifier: "x" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/admin-platform-config.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/admin/platform-config.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

const SENDER_TYPES = ["email", "sms", "slack"];

/** Pure: validate a notification-sender input. */
export function validateSender(input: { type: string; identifier: string }): { ok: boolean; error?: string } {
  if (!SENDER_TYPES.includes(input.type)) return { ok: false, error: "Unknown sender type." };
  if (!input.identifier || !input.identifier.trim()) return { ok: false, error: "Identifier is required." };
  return { ok: true };
}

/** Pure: validate a channel-app input. */
export function validateApp(input: { provider: string; identifier: string }): { ok: boolean; error?: string } {
  if (!input.provider || !input.provider.trim()) return { ok: false, error: "Provider is required." };
  if (!input.identifier || !input.identifier.trim()) return { ok: false, error: "Identifier is required." };
  return { ok: true };
}

// ── Commission rates (latest per tenant) ────────────────────────────────────
export interface TenantCommission { tenantId: string; name: string; pct: number | null }

export async function listCommission(): Promise<TenantCommission[]> {
  const sb = svc();
  const [{ data: tenants }, { data: rates }] = await Promise.all([
    sb.from("tenants").select("id, name").order("name"),
    sb.from("commission_rates").select("tenant_id, pct, effective_from").order("effective_from", { ascending: false }),
  ]);
  const latest = new Map<string, number>();
  for (const r of rates ?? []) if (!latest.has(r.tenant_id as string)) latest.set(r.tenant_id as string, Number(r.pct));
  return (tenants ?? []).map((t) => ({ tenantId: t.id as string, name: (t.name as string) ?? "", pct: latest.get(t.id as string) ?? null }));
}

export async function setCommission(tenantId: string, pct: number): Promise<void> {
  await svc().from("commission_rates").insert({ tenant_id: tenantId, pct, effective_from: new Date().toISOString().slice(0, 10) });
}

// ── Channel apps (platform_apps) ────────────────────────────────────────────
export interface AppRow { id: string; provider: string; identifier: string; status: string }

export async function listApps(): Promise<AppRow[]> {
  const { data } = await svc().from("platform_apps").select("id, provider, identifier, status").order("created_at", { ascending: false });
  return (data ?? []) as AppRow[];
}
export async function createApp(provider: string, identifier: string): Promise<{ ok: boolean; error?: string }> {
  const v = validateApp({ provider, identifier });
  if (!v.ok) return v;
  await svc().from("platform_apps").insert({ provider, identifier });
  return { ok: true };
}
export async function setAppStatus(id: string, status: "active" | "disabled"): Promise<void> {
  await svc().from("platform_apps").update({ status }).eq("id", id);
}

// ── Notification senders (platform_senders) ─────────────────────────────────
export interface SenderRow { id: string; type: string; identifier: string; provider: string | null; status: string }

export async function listSenders(): Promise<SenderRow[]> {
  const { data } = await svc().from("platform_senders").select("id, type, identifier, provider, status").order("created_at", { ascending: false });
  return (data ?? []) as SenderRow[];
}
export async function createSender(type: string, identifier: string, provider: string | null): Promise<{ ok: boolean; error?: string }> {
  const v = validateSender({ type, identifier });
  if (!v.ok) return v;
  await svc().from("platform_senders").insert({ type, identifier, provider });
  return { ok: true };
}
export async function setSenderStatus(id: string, status: "active" | "disabled"): Promise<void> {
  await svc().from("platform_senders").update({ status }).eq("id", id);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/admin-platform-config.test.ts` — Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/admin/platform-config.ts tests/admin-platform-config.test.ts
git commit -m "feat(admin): platform-config validators + commission/apps/senders service"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Admin platform page + actions + nav

**Files:** Create `src/app/admin/platform/actions.ts`, `src/app/admin/platform/page.tsx`; Modify `src/components/admin/admin-shell.tsx`

- [ ] **Step 1: Create `src/app/admin/platform/actions.ts`**

```typescript
"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setCommission, createApp, setAppStatus, createSender, setSenderStatus } from "@/lib/admin/platform-config";
import { revalidatePath } from "next/cache";

export async function setCommissionAction(formData: FormData): Promise<void> {
  await requireStaff();
  const tenantId = String(formData.get("tenantId"));
  const pct = Number(formData.get("pct"));
  if (Number.isFinite(pct)) await setCommission(tenantId, pct);
  revalidatePath("/admin/platform");
}

export async function createAppAction(formData: FormData): Promise<void> {
  await requireStaff();
  await createApp(String(formData.get("provider")), String(formData.get("identifier")));
  revalidatePath("/admin/platform");
}

export async function toggleAppAction(formData: FormData): Promise<void> {
  await requireStaff();
  await setAppStatus(String(formData.get("id")), String(formData.get("status")) === "active" ? "disabled" : "active");
  revalidatePath("/admin/platform");
}

export async function createSenderAction(formData: FormData): Promise<void> {
  await requireStaff();
  const provider = String(formData.get("provider") ?? "");
  await createSender(String(formData.get("type")), String(formData.get("identifier")), provider || null);
  revalidatePath("/admin/platform");
}

export async function toggleSenderAction(formData: FormData): Promise<void> {
  await requireStaff();
  await setSenderStatus(String(formData.get("id")), String(formData.get("status")) === "active" ? "disabled" : "active");
  revalidatePath("/admin/platform");
}
```

- [ ] **Step 2: Create `src/app/admin/platform/page.tsx`**

```tsx
import { requireStaff } from "@/lib/admin/guard";
import { listCommission, listApps, listSenders } from "@/lib/admin/platform-config";
import { setCommissionAction, createAppAction, toggleAppAction, createSenderAction, toggleSenderAction } from "./actions";

export const metadata = { title: "Platform config — Admin" };

export default async function PlatformPage() {
  await requireStaff();
  const [commission, apps, senders] = await Promise.all([listCommission(), listApps(), listSenders()]);
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Platform config</h1>
        <p className="text-sm text-slate-500">Commission, channel apps, and notification senders (FlowMo-owned).</p>
      </div>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Commission rates</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50"><tr>{["Tenant", "Current %", "Set"].map((h) => <th key={h} className="px-3 py-1.5 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {commission.map((c) => (
              <tr key={c.tenantId}>
                <td className="px-3 py-1.5 text-slate-800">{c.name}</td>
                <td className="px-3 py-1.5 text-slate-600">{c.pct === null ? "—" : `${c.pct}%`}</td>
                <td className="px-3 py-1.5">
                  <form action={setCommissionAction} className="flex items-center gap-1">
                    <input type="hidden" name="tenantId" value={c.tenantId} />
                    <input name="pct" type="number" step="0.1" defaultValue={c.pct ?? 0} className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs" />
                    <button type="submit" className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Channel apps (WhatsApp BSP / Meta)</h2>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {apps.length === 0 && <li className="py-2 text-slate-400">No apps configured.</li>}
          {apps.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{a.provider} <span className="text-xs text-slate-400">{a.identifier}</span></span>
              <form action={toggleAppAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value={a.status} /><button type="submit" className={a.status === "active" ? "rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700" : "rounded bg-slate-100 px-2 py-1 text-xs text-slate-500"}>{a.status}</button></form>
            </li>
          ))}
        </ul>
        <form action={createAppAction} className="flex gap-2">
          <input name="provider" required placeholder="provider (meta/360dialog)" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <input name="identifier" required placeholder="app/account id" className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
          <button type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white">Add app</button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Notification senders</h2>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {senders.length === 0 && <li className="py-2 text-slate-400">No senders configured.</li>}
          {senders.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{s.type}: {s.identifier} <span className="text-xs text-slate-400">{s.provider ?? ""}</span></span>
              <form action={toggleSenderAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value={s.status} /><button type="submit" className={s.status === "active" ? "rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700" : "rounded bg-slate-100 px-2 py-1 text-xs text-slate-500"}>{s.status}</button></form>
            </li>
          ))}
        </ul>
        <form action={createSenderAction} className="flex gap-2">
          <select name="type" className="rounded border border-slate-300 px-2 py-1 text-sm"><option value="email">email</option><option value="sms">sms</option><option value="slack">slack</option></select>
          <input name="identifier" required placeholder="domain / number / app" className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
          <input name="provider" placeholder="provider" className="rounded border border-slate-300 px-2 py-1 text-sm" />
          <button type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white">Add sender</button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Add "Platform" nav entry**

In `src/components/admin/admin-shell.tsx`, add `{ label: "Platform", href: "/admin/platform" }` to `NAV_ITEMS` after "Rollouts", matching the exact shape.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/admin/platform`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/platform src/components/admin/admin-shell.tsx
git commit -m "feat(admin): platform config page — commission, channel apps, senders + nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Integration gate

- [ ] **Step 1: Run the platform-config tests + full typecheck**

Run: `npx vitest run tests/admin-platform-config.test.ts tests/platform-senders-migration.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 2: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 3: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(admin): platform config gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| `platform_senders` table | Task 1 |
| Commission-rate editor (per tenant) | Tasks 2, 3 |
| Channel-apps editor (`platform_apps`) | Tasks 2, 3 |
| Notification-sender provisioning | Tasks 2, 3 |
| Validators (sender/app) | Task 2 |
| Admin-only (`requireStaff`) | Task 3 |

**Placeholder scan:** none.

**Type consistency:** `TenantCommission`/`AppRow`/`SenderRow` in platform-config.ts used by page. `validateSender`/`validateApp` pure + tested. Actions gated by `requireStaff`. Secrets (`credentials_ref`) not edited here — provisioning of the actual secret is a vault follow-up.

**Known limitations (documented):** apps/senders store config + status but the actual credential goes through the vault (`credentials_ref`) in a follow-up — this epic manages the registry + on/off; commission is append-history (latest row wins) with no edit/delete of past rows (intentional audit trail).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-epic-27-platform-config.md`.

**4 tasks. Task 1 (migration) gates 2; 2 gates 3; 4 last.**
