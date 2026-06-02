# Epic 7a — Tenant Dashboard (Core: Overviews + Bookings + Conversations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Every UI task MUST use the `ui-ux-pro-max` skill** to realize the dashboard design system (roadmap mandate). Tests run with `pnpm vitest run <file>`.

**Goal:** Ship the customer-facing tenant dashboard foundation plus its three highest-traffic sections — Organisation Overview, Per-Automation Overview (with live feed + charts), Bookings (table + filters + slide-over + CSV), and Conversations (table + transcript) — all RLS-isolated, Realtime-live, and responsive ≥360px.

**Architecture:** Next.js 15 App Router under `src/app/dashboard/`. Server Components read tenant data through the **SSR Supabase client** (`src/lib/supabase/server.ts`) so Postgres RLS enforces tenant isolation automatically (no service-role on tenant surfaces). A typed data-access layer in `src/lib/dashboard/` centralises queries. Read APIs under `src/app/api/orgs/[orgId]/...` reuse the Epic-5 `requireOrgAccess` guard and return JSON for client-side filtering/pagination/CSV. Live updates use the **browser** Supabase client via a single `useRealtimeChannel` hook (one channel per automation view, auto-unsubscribe on unmount — PRD §11). Charts use **recharts**, dark-mode-aware. The dashboard gets its own design system (distinct from marketing #FFD400 and admin zinc) established once via `ui-ux-pro-max` and reused.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, Supabase SSR + Realtime, recharts, Vitest.

**Depends on:** Plans 1 (schema/RLS/auth), 4 (auth/middleware), 5 (automation control API + `requireOrgAccess`), 6 (dispatch types). Reuses: `src/lib/api/guard.ts`, `src/lib/auth/session.ts`, `src/lib/supabase/{server,browser}.ts`.

---

## Decisions locked for this plan

- **Design system:** a clean, professional **operations dashboard** — light canvas, **indigo-600 primary** (continuity with the auth surface the customer already saw at login), neutral slate text, generous data-density. Charts are dark-mode-aware per PRD §9.3.5. The shell is **distinct** from the admin console (zinc/dark, staff-only) and marketing (#FFD400). Task 1 establishes tokens + shell via `ui-ux-pro-max`; all later tasks reuse them. Never surface "n8n/workflow/execution/CabLab" (brand rule) — use "automation / run".
- **Security model:** tenant pages and tenant read-APIs use the **user-session SSR client** so RLS does the isolation. `requireOrgAccess` is belt-and-braces (fast 401/403 + role gating for writes). **No `SUPABASE_SERVICE_ROLE_KEY` on any `/dashboard` or `/api/orgs` path.**
- **Realtime:** one `supabase.channel()` per automation view, `removeChannel` on unmount. Never an org-wide subscription across all automations (PRD §11).
- **Booking status writes** (`PATCH .../bookings/:id`) are **Owner/Admin only** (`minRole: "Admin"`); reads are any role (`minRole: "Viewer"`), with automation-restriction enforcement via the guard's `automationId` option.
- **CSV export** streams server-side from the same filtered query, capped at 10,000 rows (defensive; tenants are small).
- **Out of scope for 7a (in 7b):** Analytics (§9.3.5), Config (§9.3.6), Channels (§9.3.7), Team (§9.3.8), Billing (§9.3.9), Support (§9.3.10). 7a builds the shell nav with those entries pointing at routes 7b fills in.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json` | add `recharts` dependency |
| `src/lib/dashboard/types.ts` | shared dashboard DTOs (OrgSummary, AutomationCard, BookingRow, BookingDetail, ConversationRow, ConversationDetail, MessageRow, KpiStrip) |
| `src/lib/dashboard/format.ts` | pure formatters (currency, datetime in tenant TZ, address one-liner, truncateId, duration) |
| `src/lib/dashboard/queries.ts` | server-only data access (SSR/RLS client) — org summary, automations, KPIs, bookings, conversations, messages |
| `src/lib/dashboard/bookings-filter.ts` | pure: parse URL search params → typed BookingFilter; build a Supabase query spec; CSV row serialisation |
| `src/lib/dashboard/csv.ts` | pure CSV encoder (RFC-4180 quoting) |
| `src/components/dashboard/dashboard-shell.tsx` | org-level sidebar + topbar shell (client; active-route aware) |
| `src/components/dashboard/automation-subnav.tsx` | per-automation tab nav (Overview/Bookings/Conversations/Analytics/Config/Channels) |
| `src/components/dashboard/kpi-strip.tsx` | KPI cards row |
| `src/components/dashboard/status-badge.tsx` | automation/booking/conversation status pills (dashboard-themed) |
| `src/components/dashboard/channel-icon.tsx` | channel-type icon + health dot |
| `src/components/dashboard/slide-over.tsx` | accessible right-hand slide-over panel (client) |
| `src/components/dashboard/data-table.tsx` | typed presentational table (dashboard-themed) |
| `src/components/dashboard/filter-bar.tsx` | client filter controls that push to URL query |
| `src/components/dashboard/charts/{trend-chart,donut-chart,bar-chart}.tsx` | recharts wrappers, dark-mode-aware (client) |
| `src/hooks/use-realtime-channel.ts` | browser-client Realtime subscription hook (one channel, auto-unsubscribe) |
| `src/app/dashboard/layout.tsx` | dashboard root layout (auth guard + shell) |
| `src/app/dashboard/page.tsx` | **replace placeholder** — Org Overview (§9.3.1) |
| `src/app/dashboard/automations/[automationId]/layout.tsx` | per-automation guard + subnav |
| `src/app/dashboard/automations/[automationId]/page.tsx` | Per-Automation Overview (§9.3.2) |
| `src/app/dashboard/automations/[automationId]/live-feed.tsx` | client: Realtime recent-bookings feed |
| `src/app/dashboard/automations/[automationId]/bookings/page.tsx` | Bookings (§9.3.3) |
| `src/app/dashboard/automations/[automationId]/bookings/bookings-client.tsx` | client: filters + table + slide-over + CSV |
| `src/app/dashboard/automations/[automationId]/conversations/page.tsx` | Conversations (§9.3.4) |
| `src/app/dashboard/automations/[automationId]/conversations/conversations-client.tsx` | client: filters + table + transcript panel |
| `src/app/api/orgs/[orgId]/automations/route.ts` | GET automations list (with today KPIs) |
| `src/app/api/orgs/[orgId]/automations/[automationId]/route.ts` | GET automation detail |
| `src/app/api/orgs/[orgId]/automations/[automationId]/bookings/route.ts` | GET bookings (filtered/paged) |
| `src/app/api/orgs/[orgId]/automations/[automationId]/bookings/[bookingId]/route.ts` | GET detail; PATCH status (Admin+) |
| `src/app/api/orgs/[orgId]/automations/[automationId]/bookings/export/route.ts` | GET CSV stream |
| `src/app/api/orgs/[orgId]/automations/[automationId]/conversations/route.ts` | GET conversations (filtered/paged) |
| `src/app/api/orgs/[orgId]/automations/[automationId]/conversations/[conversationId]/route.ts` | GET conversation detail |
| `src/app/api/orgs/[orgId]/automations/[automationId]/conversations/[conversationId]/messages/route.ts` | GET messages |
| `tests/dashboard-format.test.ts` | formatter unit tests |
| `tests/dashboard-bookings-filter.test.ts` | filter-parsing + query-spec tests |
| `tests/dashboard-csv.test.ts` | CSV encoder tests |
| `tests/dashboard-queries.test.ts` | query-builder tests (mocked supabase client) |
| `tests/dashboard-realtime-hook.test.ts` | hook subscribe/unsubscribe tests |
| `tests/dashboard-api-guard.test.ts` | API route guard/role tests |
| `tests/dashboard-structure.test.ts` | page/route existence + brand-safety guard |

> **RLS note:** Plan 1 enabled RLS + tenant-isolation SELECT policies on `automations, channels, conversations, messages, bookings, automation_runs`. 7a does **not** add policies; it relies on them. Task 13 includes a check that these tables have a SELECT policy so a regression surfaces. If any policy is missing, STOP and flag — do not add service-role workarounds.

---

### Task 1: Foundation — recharts, design tokens, shell, layout

**Use `ui-ux-pro-max`** to establish the dashboard design language (light, indigo-600 primary, slate neutrals, dense data tables, dark-mode-aware charts) and to generate the shell + subnav markup. Reuse the chosen tokens in every later task.

**Files:**
- Modify: `package.json` (add recharts)
- Create: `src/components/dashboard/dashboard-shell.tsx`, `automation-subnav.tsx`
- Create: `src/app/dashboard/layout.tsx`
- Test: `tests/dashboard-structure.test.ts` (shell + layout portions)

- [ ] **Step 1: Install recharts**

Run: `pnpm add recharts`
Expected: `recharts` appears under `dependencies` in `package.json`; lockfile updates.

- [ ] **Step 2: Write the failing structure test**

`tests/dashboard-structure.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const p = (rel: string) => join(root, rel);

describe("dashboard 7a — files exist", () => {
  const files = [
    "src/app/dashboard/layout.tsx",
    "src/components/dashboard/dashboard-shell.tsx",
    "src/components/dashboard/automation-subnav.tsx",
  ];
  for (const f of files) {
    it(`exists: ${f}`, () => expect(existsSync(p(f)), f).toBe(true));
  }
});

describe("dashboard 7a — recharts installed", () => {
  it("is a dependency", () => {
    const pkg = JSON.parse(readFileSync(p("package.json"), "utf8"));
    expect(pkg.dependencies?.recharts ?? pkg.devDependencies?.recharts).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-structure.test.ts`
Expected: FAIL — layout/shell files missing.

- [ ] **Step 4: Build the shell + subnav + layout (use `ui-ux-pro-max`)**

`src/components/dashboard/dashboard-shell.tsx` — a `"use client"` component. Org-level left sidebar nav, top bar with org name slot + sign-out. Nav items (active-route aware via `usePathname`, mirroring `admin-shell.tsx` logic but with the dashboard palette):

```
Overview      → /dashboard
Team          → /dashboard/team
Billing       → /dashboard/billing
Support       → /dashboard/support
```

Contract:
```typescript
export function DashboardShell({
  orgName,
  children,
}: {
  orgName: string;
  children: React.ReactNode;
}): React.JSX.Element
```
Sign-out reuses `signOut` from `@/app/(auth)/actions`. Responsive: sidebar collapses to a top row / drawer ≥360px (use `ui-ux-pro-max` for the responsive pattern). Use indigo-600 for the active state and the wordmark accent (matching `dashboard/page.tsx` current wordmark `Cabby<span className="text-indigo-600">Bot</span>`).

`src/components/dashboard/automation-subnav.tsx` — `"use client"`, tabs for the per-automation context:
```typescript
export function AutomationSubnav({ automationId }: { automationId: string }): React.JSX.Element
```
Tabs (active-aware): Overview `/dashboard/automations/${id}`, Bookings `…/bookings`, Conversations `…/conversations`, Analytics `…/analytics`, Config `…/config`, Channels `…/channels`. (Analytics/Config/Channels routes are filled by 7b; the tabs exist now.)

`src/app/dashboard/layout.tsx` — Server Component:
```typescript
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { getOrgSummary } from "@/lib/dashboard/queries";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const claims = await requireUser();           // redirects to /login if unauthenticated
  const org = await getOrgSummary(claims.tenant_id);
  return <DashboardShell orgName={org?.name ?? "Your organisation"}>{children}</DashboardShell>;
}
```

> `getOrgSummary` lands in Task 3. To keep Task 1 self-contained and green, Task 1 may add a **temporary** inline `orgName="Your organisation"` and wire `getOrgSummary` in Task 3 — OR sequence Task 3 before finishing layout. Implementer: build Task 3's `getOrgSummary` first if you prefer; the plan orders Task 3 right after. **Do not** invent a different query name.

- [ ] **Step 5: Run test + typecheck + lint**

Run: `pnpm vitest run tests/dashboard-structure.test.ts && pnpm typecheck && pnpm lint`
Expected: structure tests for these three files PASS; typecheck/lint clean. (Other structure tests for not-yet-built files are added in Task 13 — keep this test file limited to what exists, or mark later cases `.todo`.)

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/dashboard/dashboard-shell.tsx src/components/dashboard/automation-subnav.tsx src/app/dashboard/layout.tsx tests/dashboard-structure.test.ts
git commit -m "feat(dashboard): recharts + dashboard shell, subnav, and root layout"
```

---

### Task 2: Shared DTOs + pure formatters

**Files:**
- Create: `src/lib/dashboard/types.ts`, `src/lib/dashboard/format.ts`
- Test: `tests/dashboard-format.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/dashboard-format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDateTime,
  addressOneLine,
  truncateId,
  formatDurationMs,
} from "@/lib/dashboard/format";

describe("formatCurrency", () => {
  it("formats GBP/EUR/USD with symbol and 2dp", () => {
    expect(formatCurrency(23.5, "GBP")).toBe("£23.50");
    expect(formatCurrency(1000, "EUR")).toBe("€1,000.00");
    expect(formatCurrency(9.9, "USD")).toBe("$9.90");
  });
  it("renders an em-dash for null/NaN", () => {
    expect(formatCurrency(null, "GBP")).toBe("—");
    expect(formatCurrency(Number.NaN, "GBP")).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("formats an ISO instant in the given IANA tz", () => {
    // 14:30 UTC in Europe/London (BST, +1) = 15:30
    const out = formatDateTime("2026-06-01T14:30:00.000Z", "Europe/London");
    expect(out).toMatch(/15:30/);
    expect(out).toMatch(/2026/);
  });
  it("returns em-dash for null/unparseable", () => {
    expect(formatDateTime(null, "Europe/London")).toBe("—");
    expect(formatDateTime("nope", "Europe/London")).toBe("—");
  });
});

describe("addressOneLine", () => {
  it("joins town + postcode from an address json object", () => {
    expect(addressOneLine({ town: "Slough", postcode: "SL1 1AA" })).toBe("Slough, SL1 1AA");
  });
  it("falls back to label or em-dash", () => {
    expect(addressOneLine({ label: "Heathrow T5" })).toBe("Heathrow T5");
    expect(addressOneLine(null)).toBe("—");
    expect(addressOneLine({})).toBe("—");
  });
});

describe("truncateId", () => {
  it("shows the first 8 chars of a uuid", () => {
    expect(truncateId("123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567");
    expect(truncateId(null)).toBe("—");
  });
});

describe("formatDurationMs", () => {
  it("formats ms as human duration", () => {
    expect(formatDurationMs(950)).toBe("0.9s");
    expect(formatDurationMs(1500)).toBe("1.5s");
    expect(formatDurationMs(65000)).toBe("1m 5s");
    expect(formatDurationMs(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the DTOs**

`src/lib/dashboard/types.ts`:

```typescript
/** Shared dashboard DTOs (Epic 7a). Vendor/engine-neutral, customer-facing. */

export type AutomationStatus = "building" | "uat" | "live" | "stopped" | "error";
export type AutomationType = "Booking" | "Support" | "Driver" | "Custom";
export type BookingStatus = "confirmed" | "dispatched" | "completed" | "cancelled" | "no_show";
export type ChannelType = "whatsapp" | "telegram" | "messenger" | "instagram" | "widget";
export type ChannelHealth = "healthy" | "warning" | "disconnected";
export type ConversationOutcome =
  | "booked" | "quoted" | "abandoned" | "managed" | "cancelled" | "unknown";

export interface OrgSummary {
  id: string;
  name: string;
  planBand: string;
  contractRenewal: string | null; // ISO date
  currency: "GBP" | "EUR" | "USD";
}

export interface ChannelHealthIcon {
  type: ChannelType;
  health: ChannelHealth;
}

export interface AutomationCard {
  id: string;
  name: string;
  type: AutomationType;
  status: AutomationStatus;
  dispatchAdapter: string | null;
  channels: ChannelHealthIcon[];
  bookingsToday: number;
  conversationsToday: number;
  conversionPct: number; // 0..100
}

export interface KpiStrip {
  bookingsToday: number;
  conversationsToday: number;
  liveAutomations: number;
}

export interface BookingRow {
  id: string;
  dispatchRef: string | null;
  pickupAtUtc: string | null;
  passengerName: string | null;
  customerHandle: string | null;
  channelType: string | null;
  pickupAddress: unknown;
  destinationAddress: unknown;
  vehicleType: string | null;
  passengerCount: number | null;
  fare: number | null;
  currency: string;
  status: BookingStatus;
  pickupTimeMode: string | null;
}

export interface BookingDetail extends BookingRow {
  driverNote: string | null;
  airportJson: unknown;
  conversationId: string | null;
  rawDispatchJson: unknown;
  createdAt: string;
}

export interface ConversationRow {
  id: string;
  customerName: string | null;
  customerHandle: string;
  channelId: string | null;
  startedAt: string;
  endedAt: string | null;
  outcome: ConversationOutcome | null;
  language: string | null;
  messageCount: number;
}

export interface MessageRow {
  id: string;
  direction: "inbound" | "outbound";
  messageType: "text" | "voice" | "location" | "image" | "interactive" | "card";
  payload: unknown;
  transcript: string | null;
  intentExtracted: unknown;
  ts: string;
}

export interface ConversationDetail extends ConversationRow {
  abandonmentReason: string | null;
  bookingId: string | null;
  messages: MessageRow[];
}
```

- [ ] **Step 4: Write the formatters**

`src/lib/dashboard/format.ts`:

```typescript
const DASH = "—";
const CURRENCY_LOCALE: Record<string, string> = { GBP: "en-GB", EUR: "en-IE", USD: "en-US" };

export function formatCurrency(amount: number | null | undefined, currency: string): string {
  if (amount == null || Number.isNaN(amount)) return DASH;
  const locale = CURRENCY_LOCALE[currency] ?? "en-GB";
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export function addressOneLine(addr: unknown): string {
  if (!addr || typeof addr !== "object") return DASH;
  const a = addr as Record<string, unknown>;
  const town = typeof a.town === "string" ? a.town : null;
  const postcode = typeof a.postcode === "string" ? a.postcode : null;
  const parts = [town, postcode].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(", ");
  if (typeof a.label === "string" && a.label) return a.label;
  return DASH;
}

export function truncateId(id: string | null | undefined): string {
  if (!id) return DASH;
  return id.slice(0, 8);
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return DASH;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/dashboard-format.test.ts`
Expected: PASS (all formatter tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/types.ts src/lib/dashboard/format.ts tests/dashboard-format.test.ts
git commit -m "feat(dashboard): shared DTOs + pure formatters"
```

---

### Task 3: Server data-access layer (RLS client)

**Files:**
- Create: `src/lib/dashboard/queries.ts`
- Test: `tests/dashboard-queries.test.ts`

`queries.ts` exposes typed functions that build Supabase queries via the **SSR (RLS) client**. To make them testable without a live DB, each function accepts an optional injected client (`SupabaseLike`) defaulting to `createClient()`. Tests pass a fake recording client and assert the table/columns/filters; live correctness is covered by RLS + the structure check.

- [ ] **Step 1: Write the failing test**

`tests/dashboard-queries.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { getBookingsPage, getConversationsPage, getKpiStrip } from "@/lib/dashboard/queries";

/** Records the query chain and returns canned data at the end. */
function fakeClient(result: { data: unknown; count?: number; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  for (const m of ["select", "eq", "gte", "lte", "ilike", "in", "order", "range", "limit"]) {
    builder[m] = chain(m);
  }
  // terminal: awaiting the builder resolves to the result
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data: result.data, count: result.count, error: result.error });
  const client = { from: (table: string) => { calls.push({ method: "from", args: [table] }); return builder; } };
  return { client, calls };
}

describe("getBookingsPage", () => {
  it("queries bookings for the automation with paging + ordering", async () => {
    const { client, calls } = fakeClient({ data: [], count: 0, error: null });
    await getBookingsPage(
      { automationId: "a1", filter: { page: 1, limit: 50 } },
      client as never,
    );
    expect(calls.find((c) => c.method === "from")?.args[0]).toBe("bookings");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "automation_id" && c.args[1] === "a1")).toBe(true);
    expect(calls.some((c) => c.method === "order")).toBe(true);
    expect(calls.some((c) => c.method === "range")).toBe(true);
  });

  it("applies status + search + date filters when present", async () => {
    const { client, calls } = fakeClient({ data: [], count: 0, error: null });
    await getBookingsPage(
      { automationId: "a1", filter: { page: 1, limit: 50, status: "confirmed", search: "SL1", from: "2026-06-01", to: "2026-06-07" } },
      client as never,
    );
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status")).toBe(true);
    expect(calls.some((c) => c.method === "gte" && c.args[0] === "pickup_at_utc")).toBe(true);
    expect(calls.some((c) => c.method === "lte" && c.args[0] === "pickup_at_utc")).toBe(true);
    expect(calls.some((c) => c.method === "ilike")).toBe(true);
  });
});

describe("getConversationsPage", () => {
  it("queries conversations for the automation", async () => {
    const { client, calls } = fakeClient({ data: [], count: 0, error: null });
    await getConversationsPage({ automationId: "a1", filter: { page: 1, limit: 50 } }, client as never);
    expect(calls.find((c) => c.method === "from")?.args[0]).toBe("conversations");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "automation_id")).toBe(true);
  });
});

describe("getKpiStrip", () => {
  it("reads today's counts for a tenant", async () => {
    const { client, calls } = fakeClient({ data: [], count: 3, error: null });
    const out = await getKpiStrip("t1", client as never);
    expect(calls.some((c) => c.method === "from" && c.args[0] === "bookings")).toBe(true);
    expect(out).toHaveProperty("bookingsToday");
    expect(out).toHaveProperty("conversationsToday");
    expect(out).toHaveProperty("liveAutomations");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-queries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the queries module**

`src/lib/dashboard/queries.ts`:

```typescript
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  OrgSummary, AutomationCard, KpiStrip, BookingRow, BookingDetail,
  ConversationRow, ConversationDetail, MessageRow,
} from "./types";
import type { BookingFilter, ConversationFilter } from "./bookings-filter";

/** Minimal structural type for the part of the Supabase client we use. */
export type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

function startOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function getOrgSummary(
  tenantId: string,
  client?: SupabaseLike,
): Promise<OrgSummary | null> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("tenants")
    .select("id, name, plan_band, contract_renewal, currency")
    .eq("id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id, name: data.name, planBand: data.plan_band,
    contractRenewal: data.contract_renewal, currency: data.currency,
  };
}

export async function getKpiStrip(tenantId: string, client?: SupabaseLike): Promise<KpiStrip> {
  const supabase = client ?? (await createClient());
  const since = startOfTodayUtcIso();
  const [bookings, convs, live] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("created_at", since),
    supabase.from("conversations").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("started_at", since),
    supabase.from("automations").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "live"),
  ]);
  return {
    bookingsToday: bookings.count ?? 0,
    conversationsToday: convs.count ?? 0,
    liveAutomations: live.count ?? 0,
  };
}

export async function getAutomationCards(
  tenantId: string,
  client?: SupabaseLike,
): Promise<AutomationCard[]> {
  const supabase = client ?? (await createClient());
  const since = startOfTodayUtcIso();
  const { data: autos } = await supabase
    .from("automations")
    .select("id, name, type, status, dispatch_adapter, channels(type, status, token_expires_at)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  const cards: AutomationCard[] = [];
  for (const a of autos ?? []) {
    const [b, c] = await Promise.all([
      supabase.from("bookings").select("id", { count: "exact", head: true })
        .eq("automation_id", a.id).gte("created_at", since),
      supabase.from("conversations").select("id", { count: "exact", head: true })
        .eq("automation_id", a.id).gte("started_at", since),
    ]);
    const bookingsToday = b.count ?? 0;
    const conversationsToday = c.count ?? 0;
    cards.push({
      id: a.id, name: a.name, type: a.type, status: a.status,
      dispatchAdapter: a.dispatch_adapter,
      channels: ((a.channels as { type: string; status: string; token_expires_at: string | null }[]) ?? [])
        .map((ch) => ({ type: ch.type as AutomationCard["channels"][number]["type"], health: channelHealth(ch.status, ch.token_expires_at) })),
      bookingsToday, conversationsToday,
      conversionPct: conversationsToday > 0 ? Math.round((bookingsToday / conversationsToday) * 100) : 0,
    });
  }
  return cards;
}

/** Health from channel status + token expiry: red disconnected/error, amber ≤7d, else green. */
export function channelHealth(status: string, tokenExpiresAt: string | null): "healthy" | "warning" | "disconnected" {
  if (status === "disconnected" || status === "error") return "disconnected";
  if (tokenExpiresAt) {
    const days = (new Date(tokenExpiresAt).getTime() - Date.now()) / 86_400_000;
    if (days <= 7) return "warning";
  }
  return "healthy";
}

const BOOKING_COLS =
  "id, dispatch_ref, pickup_at_utc, passenger_name, customer_handle, channel_type, pickup_address, destination_address, vehicle_type, passenger_count, fare, currency, status, pickup_time_mode";

export async function getBookingsPage(
  args: { automationId: string; filter: BookingFilter },
  client?: SupabaseLike,
): Promise<{ rows: BookingRow[]; total: number }> {
  const supabase = client ?? (await createClient());
  const { automationId, filter } = args;
  let q = supabase.from("bookings").select(BOOKING_COLS, { count: "exact" }).eq("automation_id", automationId);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.channel) q = q.eq("channel_type", filter.channel);
  if (filter.mode) q = q.eq("pickup_time_mode", filter.mode);
  if (filter.from) q = q.gte("pickup_at_utc", filter.from);
  if (filter.to) q = q.lte("pickup_at_utc", filter.to);
  if (filter.search) {
    const s = `%${filter.search}%`;
    q = q.ilike("passenger_name", s); // primary search field; phone/postcode handled client-side over the page
  }
  const start = (filter.page - 1) * filter.limit;
  q = q.order("pickup_at_utc", { ascending: false, nullsFirst: false }).range(start, start + filter.limit - 1);
  const { data, count } = await q;
  return { rows: (data ?? []).map(mapBookingRow), total: count ?? 0 };
}

export async function getBookingDetail(
  bookingId: string,
  client?: SupabaseLike,
): Promise<BookingDetail | null> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("bookings")
    .select(`${BOOKING_COLS}, driver_note, airport_json, conversation_id, raw_dispatch_json, created_at`)
    .eq("id", bookingId)
    .maybeSingle();
  if (!data) return null;
  return {
    ...mapBookingRow(data),
    driverNote: data.driver_note, airportJson: data.airport_json,
    conversationId: data.conversation_id, rawDispatchJson: data.raw_dispatch_json,
    createdAt: data.created_at,
  };
}

function mapBookingRow(r: Record<string, unknown>): BookingRow {
  return {
    id: r.id as string, dispatchRef: (r.dispatch_ref as string) ?? null,
    pickupAtUtc: (r.pickup_at_utc as string) ?? null,
    passengerName: (r.passenger_name as string) ?? null,
    customerHandle: (r.customer_handle as string) ?? null,
    channelType: (r.channel_type as string) ?? null,
    pickupAddress: r.pickup_address ?? null, destinationAddress: r.destination_address ?? null,
    vehicleType: (r.vehicle_type as string) ?? null,
    passengerCount: (r.passenger_count as number) ?? null,
    fare: (r.fare as number) ?? null, currency: (r.currency as string) ?? "GBP",
    status: (r.status as BookingRow["status"]) ?? "confirmed",
    pickupTimeMode: (r.pickup_time_mode as string) ?? null,
  };
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingRow["status"],
  client?: SupabaseLike,
): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase.from("bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", bookingId);
  return !error;
}

const CONVERSATION_COLS =
  "id, customer_name, customer_handle, channel_id, started_at, ended_at, outcome, language";

export async function getConversationsPage(
  args: { automationId: string; filter: ConversationFilter },
  client?: SupabaseLike,
): Promise<{ rows: ConversationRow[]; total: number }> {
  const supabase = client ?? (await createClient());
  const { automationId, filter } = args;
  let q = supabase.from("conversations").select(CONVERSATION_COLS, { count: "exact" }).eq("automation_id", automationId);
  if (filter.outcome) q = q.eq("outcome", filter.outcome);
  if (filter.language) q = q.eq("language", filter.language);
  if (filter.channel) q = q.eq("channel_id", filter.channel);
  if (filter.from) q = q.gte("started_at", filter.from);
  if (filter.to) q = q.lte("started_at", filter.to);
  if (filter.search) q = q.ilike("customer_name", `%${filter.search}%`);
  const start = (filter.page - 1) * filter.limit;
  q = q.order("started_at", { ascending: false }).range(start, start + filter.limit - 1);
  const { data, count } = await q;
  return {
    rows: (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string, customerName: (r.customer_name as string) ?? null,
      customerHandle: r.customer_handle as string, channelId: (r.channel_id as string) ?? null,
      startedAt: r.started_at as string, endedAt: (r.ended_at as string) ?? null,
      outcome: (r.outcome as ConversationRow["outcome"]) ?? null,
      language: (r.language as string) ?? null, messageCount: 0,
    })),
    total: count ?? 0,
  };
}

export async function getConversationDetail(
  conversationId: string,
  client?: SupabaseLike,
): Promise<ConversationDetail | null> {
  const supabase = client ?? (await createClient());
  const { data: c } = await supabase
    .from("conversations")
    .select(`${CONVERSATION_COLS}, abandonment_reason`)
    .eq("id", conversationId)
    .maybeSingle();
  if (!c) return null;
  const messages = await getMessages(conversationId, supabase);
  const { data: booking } = await supabase.from("bookings").select("id").eq("conversation_id", conversationId).maybeSingle();
  return {
    id: c.id, customerName: c.customer_name, customerHandle: c.customer_handle,
    channelId: c.channel_id, startedAt: c.started_at, endedAt: c.ended_at,
    outcome: c.outcome, language: c.language, messageCount: messages.length,
    abandonmentReason: c.abandonment_reason, bookingId: booking?.id ?? null, messages,
  };
}

export async function getMessages(conversationId: string, client?: SupabaseLike): Promise<MessageRow[]> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("messages")
    .select("id, direction, message_type, payload, transcript, intent_extracted, ts")
    .eq("conversation_id", conversationId)
    .order("ts", { ascending: true });
  return (data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string, direction: m.direction as MessageRow["direction"],
    messageType: m.message_type as MessageRow["messageType"], payload: m.payload ?? null,
    transcript: (m.transcript as string) ?? null, intentExtracted: m.intent_extracted ?? null,
    ts: m.ts as string,
  }));
}
```

(Import `AutomationCard` type members used in `channelHealth`/cards via the existing `./types` import; add `import type { AutomationCard }` already present.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dashboard-queries.test.ts`
Expected: PASS. Then `pnpm typecheck` clean.

> If the fake-client `.then` shape trips strict typing in the test, keep the cast `client as never` as written — the test asserts the query shape, not types.

- [ ] **Step 5: Wire `getOrgSummary` into the Task-1 layout** (if Task 1 used the temporary literal). Replace the literal with the real call shown in Task 1 Step 4. Run `pnpm typecheck`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/queries.ts tests/dashboard-queries.test.ts src/app/dashboard/layout.tsx
git commit -m "feat(dashboard): server data-access layer over the RLS client"
```

---

### Task 4: Booking/conversation filter parsing + CSV encoder

**Files:**
- Create: `src/lib/dashboard/bookings-filter.ts`, `src/lib/dashboard/csv.ts`
- Test: `tests/dashboard-bookings-filter.test.ts`, `tests/dashboard-csv.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/dashboard-bookings-filter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseBookingFilter, parseConversationFilter, bookingToCsvRow, BOOKING_CSV_HEADERS } from "@/lib/dashboard/bookings-filter";

describe("parseBookingFilter", () => {
  it("defaults page=1 limit=50 with no params", () => {
    const f = parseBookingFilter(new URLSearchParams());
    expect(f).toMatchObject({ page: 1, limit: 50 });
  });
  it("reads and clamps paging + passes through filters", () => {
    const f = parseBookingFilter(new URLSearchParams("page=3&limit=999&status=confirmed&channel=whatsapp&mode=airport&search=SL1&from=2026-06-01&to=2026-06-07"));
    expect(f.page).toBe(3);
    expect(f.limit).toBe(100); // clamped to max 100
    expect(f).toMatchObject({ status: "confirmed", channel: "whatsapp", mode: "airport", search: "SL1" });
    expect(f.from).toContain("2026-06-01");
    expect(f.to).toContain("2026-06-07");
  });
  it("rejects an out-of-enum status (drops it)", () => {
    const f = parseBookingFilter(new URLSearchParams("status=bogus"));
    expect(f.status).toBeUndefined();
  });
  it("treats page<1 as 1", () => {
    expect(parseBookingFilter(new URLSearchParams("page=0")).page).toBe(1);
    expect(parseBookingFilter(new URLSearchParams("page=-5")).page).toBe(1);
  });
});

describe("parseConversationFilter", () => {
  it("validates outcome enum", () => {
    expect(parseConversationFilter(new URLSearchParams("outcome=booked")).outcome).toBe("booked");
    expect(parseConversationFilter(new URLSearchParams("outcome=nope")).outcome).toBeUndefined();
  });
});

describe("bookingToCsvRow", () => {
  it("emits columns in header order", () => {
    const row = bookingToCsvRow({
      id: "b1", dispatchRef: "AC9", pickupAtUtc: "2026-06-01T14:00:00.000Z",
      passengerName: "Jo", customerHandle: "+447700900000", channelType: "whatsapp",
      pickupAddress: { town: "Slough", postcode: "SL1 1AA" }, destinationAddress: { town: "London", postcode: "W1" },
      vehicleType: "Saloon", passengerCount: 2, fare: 23.5, currency: "GBP",
      status: "confirmed", pickupTimeMode: "asap",
    });
    expect(row.length).toBe(BOOKING_CSV_HEADERS.length);
    expect(row[0]).toBe("b1");
    expect(row).toContain("AC9");
  });
});
```

`tests/dashboard-csv.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/dashboard/csv";

describe("toCsv", () => {
  it("joins headers + rows with CRLF and trailing newline", () => {
    const out = toCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(out).toBe("a,b\r\n1,2\r\n3,4\r\n");
  });
  it("quotes fields containing comma, quote, or newline (RFC 4180)", () => {
    const out = toCsv(["x"], [['a,b'], ['he said "hi"'], ["line\nbreak"]]);
    expect(out).toContain('"a,b"');
    expect(out).toContain('"he said ""hi"""');
    expect(out).toContain('"line\nbreak"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/dashboard-bookings-filter.test.ts tests/dashboard-csv.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the CSV encoder**

`src/lib/dashboard/csv.ts`:

```typescript
/** Minimal RFC-4180 CSV encoder. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((cols) => cols.map(csvField).join(","));
  return lines.join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Write the filter module**

`src/lib/dashboard/bookings-filter.ts`:

```typescript
import type { BookingRow } from "./types";
import { addressOneLine } from "./format";

const BOOKING_STATUSES = ["confirmed", "dispatched", "completed", "cancelled", "no_show"] as const;
const CHANNELS = ["whatsapp", "telegram", "messenger", "instagram", "widget"] as const;
const MODES = ["asap", "scheduled", "airport"] as const;
const OUTCOMES = ["booked", "quoted", "abandoned", "managed", "cancelled", "unknown"] as const;

export interface BookingFilter {
  page: number;
  limit: number;
  status?: (typeof BOOKING_STATUSES)[number];
  channel?: (typeof CHANNELS)[number];
  mode?: (typeof MODES)[number];
  search?: string;
  from?: string;
  to?: string;
}

export interface ConversationFilter {
  page: number;
  limit: number;
  outcome?: (typeof OUTCOMES)[number];
  channel?: string;
  language?: string;
  search?: string;
  from?: string;
  to?: string;
}

function intParam(v: string | null, dflt: number, min: number, max: number): number {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return dflt;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

function pick<T extends readonly string[]>(v: string | null, allowed: T): T[number] | undefined {
  return v && (allowed as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

export function parseBookingFilter(params: URLSearchParams): BookingFilter {
  return {
    page: intParam(params.get("page"), 1, 1, 100000),
    limit: intParam(params.get("limit"), 50, 1, 100),
    status: pick(params.get("status"), BOOKING_STATUSES),
    channel: pick(params.get("channel"), CHANNELS),
    mode: pick(params.get("mode"), MODES),
    search: params.get("search")?.trim() || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  };
}

export function parseConversationFilter(params: URLSearchParams): ConversationFilter {
  return {
    page: intParam(params.get("page"), 1, 1, 100000),
    limit: intParam(params.get("limit"), 50, 1, 100),
    outcome: pick(params.get("outcome"), OUTCOMES),
    channel: params.get("channel") || undefined,
    language: params.get("language") || undefined,
    search: params.get("search")?.trim() || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
  };
}

export const BOOKING_CSV_HEADERS = [
  "Booking ID", "Dispatch Ref", "Pickup (UTC)", "Customer", "Contact",
  "Channel", "Pickup", "Destination", "Vehicle", "Pax", "Fare", "Currency", "Status", "Mode",
] as const;

export function bookingToCsvRow(b: BookingRow): string[] {
  return [
    b.id, b.dispatchRef ?? "", b.pickupAtUtc ?? "", b.passengerName ?? "", b.customerHandle ?? "",
    b.channelType ?? "", addressOneLine(b.pickupAddress), addressOneLine(b.destinationAddress),
    b.vehicleType ?? "", String(b.passengerCount ?? ""), b.fare == null ? "" : String(b.fare),
    b.currency, b.status, b.pickupTimeMode ?? "",
  ];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/dashboard-bookings-filter.test.ts tests/dashboard-csv.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/bookings-filter.ts src/lib/dashboard/csv.ts tests/dashboard-bookings-filter.test.ts tests/dashboard-csv.test.ts
git commit -m "feat(dashboard): filter parsing + RFC-4180 CSV encoder"
```

---

### Task 5: Realtime hook

**Files:**
- Create: `src/hooks/use-realtime-channel.ts`
- Test: `tests/dashboard-realtime-hook.test.ts`

A client hook that subscribes to one Postgres-changes channel and tears it down on unmount (PRD §11). Built on `src/lib/supabase/browser.ts` (`createBrowserClient`), with the client injectable for tests.

- [ ] **Step 1: Write the failing test**

`tests/dashboard-realtime-hook.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

function fakeSupabase() {
  const handlers: Array<(p: unknown) => void> = [];
  const channelObj = {
    on: vi.fn(function (this: unknown, _evt: string, _cfg: unknown, cb: (p: unknown) => void) {
      handlers.push(cb);
      return channelObj;
    }),
    subscribe: vi.fn(() => channelObj),
  };
  const supabase = {
    channel: vi.fn(() => channelObj),
    removeChannel: vi.fn(),
  };
  return { supabase, channelObj, handlers };
}

describe("useRealtimeChannel", () => {
  it("subscribes on mount and removes the channel on unmount", () => {
    const { supabase, channelObj } = fakeSupabase();
    const { unmount } = renderHook(() =>
      useRealtimeChannel(
        { channelName: "bookings:automation_id=a1", table: "bookings", event: "INSERT", filter: "automation_id=eq.a1" },
        () => {},
        supabase as never,
      ),
    );
    expect(supabase.channel).toHaveBeenCalledWith("bookings:automation_id=a1");
    expect(channelObj.subscribe).toHaveBeenCalledTimes(1);
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("invokes the callback with payload.new when a change arrives", () => {
    const { supabase, handlers } = fakeSupabase();
    const onChange = vi.fn();
    renderHook(() =>
      useRealtimeChannel(
        { channelName: "c", table: "bookings", event: "INSERT", filter: "automation_id=eq.a1" },
        onChange,
        supabase as never,
      ),
    );
    handlers[0]?.({ new: { id: "b1" } });
    expect(onChange).toHaveBeenCalledWith({ id: "b1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-realtime-hook.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

`src/hooks/use-realtime-channel.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";

type SupabaseLike = {
  channel: (name: string) => {
    on: (evt: "postgres_changes", cfg: Record<string, unknown>, cb: (payload: { new: unknown }) => void) => unknown;
    subscribe: () => unknown;
  };
  removeChannel: (ch: unknown) => void;
};

export interface RealtimeOptions {
  channelName: string;
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  schema?: string;
}

/**
 * Subscribes to one Realtime channel and tears it down on unmount (PRD §11:
 * one channel per automation view, never org-wide). `onChange` receives
 * `payload.new`. `client` is injectable for tests; defaults to the browser client.
 */
export function useRealtimeChannel(
  options: RealtimeOptions,
  onChange: (row: unknown) => void,
  client?: SupabaseLike,
): void {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const supabase = (client ?? (createClient() as unknown as SupabaseLike));
    const channel = supabase.channel(options.channelName);
    channel
      .on(
        "postgres_changes",
        { event: options.event, schema: options.schema ?? "public", table: options.table, filter: options.filter },
        (payload) => cb.current(payload.new),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.channelName, options.table, options.event, options.filter, options.schema]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dashboard-realtime-hook.test.ts`
Expected: PASS (2 tests).

> If `renderHook` needs a DOM env, ensure the test file uses jsdom. Add `// @vitest-environment jsdom` as the first line of the test file if the repo's vitest config defaults to node.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-realtime-channel.ts tests/dashboard-realtime-hook.test.ts
git commit -m "feat(dashboard): one-channel Realtime subscription hook"
```

---

### Task 6: Shared dashboard UI components

**Use `ui-ux-pro-max`** for visual design. Build the presentational pieces the pages compose.

**Files:**
- Create: `src/components/dashboard/{status-badge,channel-icon,kpi-strip,data-table,slide-over,filter-bar}.tsx`
- Test: extend `tests/dashboard-structure.test.ts` with existence checks for these files

- [ ] **Step 1: Add failing existence assertions** for the six component paths to `tests/dashboard-structure.test.ts` (append to the `files` array in the "files exist" describe). Run it; confirm the new cases FAIL.

- [ ] **Step 2: Build the components** (server components where no interactivity is needed; `"use client"` for `slide-over` and `filter-bar`):

- `status-badge.tsx` — `export function StatusBadge({ status }: { status: string }): React.JSX.Element`. Maps `live→green, building/uat→blue/amber, stopped→zinc, error→red`; booking statuses `confirmed→blue, dispatched→indigo, completed→green, cancelled→zinc, no_show→red`; conversation outcomes. Color paired with text (never color-only). Dashboard palette (not the admin mono style).
- `channel-icon.tsx` — `export function ChannelIcon({ type, health }: { type: ChannelType; health?: ChannelHealth }): React.JSX.Element`. Inline SVG or lucide-style glyph per channel + a health dot (green/amber/red) with an accessible label.
- `kpi-strip.tsx` — `export function KpiStrip({ items }: { items: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] }): React.JSX.Element`. Responsive grid of cards.
- `data-table.tsx` — generic typed table mirroring `src/components/admin/data-table.tsx`'s `Column<Row>`/`DataTable` API **exactly** (same prop names: `columns, rows, getRowKey, getRowHref?, emptyMessage?`) but dashboard-themed.
- `slide-over.tsx` — `"use client"`. `export function SlideOver({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }): React.JSX.Element`. Right-hand panel, focus-trap, Esc-to-close, backdrop click closes, `role="dialog"` + `aria-modal`.
- `filter-bar.tsx` — `"use client"`. Renders the booking/conversation filter controls; on change it builds a `URLSearchParams` and calls `router.replace(\`?${params}\`)` (shallow URL update) so server components re-read filters. Contract:
  ```typescript
  export interface FilterField {
    key: string;
    label: string;
    type: "select" | "search" | "date";
    options?: { value: string; label: string }[];
  }
  export function FilterBar({ fields, values }: { fields: FilterField[]; values: Record<string, string> }): React.JSX.Element
  ```

- [ ] **Step 3: Run structure test + typecheck + lint**

Run: `pnpm vitest run tests/dashboard-structure.test.ts && pnpm typecheck && pnpm lint`
Expected: existence cases PASS; typecheck/lint clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/ tests/dashboard-structure.test.ts
git commit -m "feat(dashboard): shared UI components (badges, table, slide-over, filters, charts host)"
```

---

### Task 7: Chart components (recharts, dark-mode-aware)

**Use `ui-ux-pro-max`** for chart theming.

**Files:**
- Create: `src/components/dashboard/charts/{trend-chart,donut-chart,bar-chart}.tsx`
- Test: extend `tests/dashboard-structure.test.ts` existence checks

- [ ] **Step 1: Add failing existence assertions** for the three chart paths; run; confirm FAIL.

- [ ] **Step 2: Build the charts** — all `"use client"`, wrapping recharts `ResponsiveContainer`. Dark-mode-aware via Tailwind `dark:` classes / CSS variables for stroke/fill. Contracts:

```typescript
// trend-chart.tsx — two series (today vs same weekday last week)
export function TrendChart({ data }: { data: { label: string; current: number; previous: number }[] }): React.JSX.Element

// donut-chart.tsx — proportion breakdown
export function DonutChart({ data }: { data: { name: string; value: number }[] }): React.JSX.Element

// bar-chart.tsx — categorical counts
export function BarChart({ data }: { data: { name: string; value: number }[] }): React.JSX.Element
```

Each renders an accessible empty state ("No data for this period.") when `data` is empty.

- [ ] **Step 3: Structure test + typecheck + lint** — `pnpm vitest run tests/dashboard-structure.test.ts && pnpm typecheck && pnpm lint`. Expected: PASS/clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/charts/ tests/dashboard-structure.test.ts
git commit -m "feat(dashboard): recharts trend/donut/bar chart components"
```

---

### Task 8: Read APIs — automations list/detail + guard tests

**Files:**
- Create: `src/app/api/orgs/[orgId]/automations/route.ts`, `.../[automationId]/route.ts`
- Test: `tests/dashboard-api-guard.test.ts`

The route handlers reuse `requireOrgAccess` (Epic 5) and the SSR query layer. Tests assert guard behavior by mocking `requireOrgAccess` + queries.

- [ ] **Step 1: Write the failing test**

`tests/dashboard-api-guard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

const requireOrgAccess = vi.fn();
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: (...a: unknown[]) => requireOrgAccess(...a) }));
const getAutomationCards = vi.fn();
const getBookingsPage = vi.fn();
vi.mock("@/lib/dashboard/queries", () => ({
  getAutomationCards: (...a: unknown[]) => getAutomationCards(...a),
  getBookingsPage: (...a: unknown[]) => getBookingsPage(...a),
  getBookingDetail: vi.fn(),
  updateBookingStatus: vi.fn(),
  getConversationsPage: vi.fn(),
  getConversationDetail: vi.fn(),
  getMessages: vi.fn(),
}));

import { GET as listAutomations } from "@/app/api/orgs/[orgId]/automations/route";
import { GET as listBookings } from "@/app/api/orgs/[orgId]/automations/[automationId]/bookings/route";

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

beforeEach(() => {
  requireOrgAccess.mockReset();
  getAutomationCards.mockReset();
  getBookingsPage.mockReset();
});

describe("GET automations", () => {
  it("short-circuits with the guard's response when access is denied", async () => {
    requireOrgAccess.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const res = await listAutomations(new Request("http://x/api/orgs/o1/automations"), ctx({ orgId: "o1" }));
    expect(res.status).toBe(403);
    expect(getAutomationCards).not.toHaveBeenCalled();
  });

  it("returns automation cards on allow", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    getAutomationCards.mockResolvedValue([{ id: "a1", name: "Booking Bot" }]);
    const res = await listAutomations(new Request("http://x/api/orgs/o1/automations"), ctx({ orgId: "o1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ automations: [{ id: "a1", name: "Booking Bot" }] });
  });
});

describe("GET bookings", () => {
  it("passes automationId to the guard for restriction enforcement", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    getBookingsPage.mockResolvedValue({ rows: [], total: 0 });
    await listBookings(new Request("http://x/api/orgs/o1/automations/a1/bookings?page=1"), ctx({ orgId: "o1", automationId: "a1" }));
    expect(requireOrgAccess).toHaveBeenCalledWith("o1", expect.objectContaining({ automationId: "a1" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dashboard-api-guard.test.ts`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Write the routes**

`src/app/api/orgs/[orgId]/automations/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getAutomationCards } from "@/lib/dashboard/queries";

export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const automations = await getAutomationCards(orgId);
  return NextResponse.json({ automations });
}
```

`src/app/api/orgs/[orgId]/automations/[automationId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getAutomationCards } from "@/lib/dashboard/queries";

export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const cards = await getAutomationCards(orgId);
  const card = cards.find((c) => c.id === automationId);
  if (!card) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ automation: card });
}
```

> The guard test mocks `requireOrgAccess` to return a plain object on allow, so `instanceof NextResponse` is false and the handler proceeds — matching the real guard which returns `{ claims }` on allow and a `NextResponse` on deny.

- [ ] **Step 4: Run test + typecheck + lint** — `pnpm vitest run tests/dashboard-api-guard.test.ts && pnpm typecheck && pnpm lint`. Expected: the automations cases PASS (bookings case fails until Task 9 — mark it `.todo` here or temporarily skip the bookings import, then unskip in Task 9). **Cleaner:** move the `listBookings` import + its describe into Task 9. Implementer: keep this test file to automations-only now; add the bookings block in Task 9.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/orgs/[orgId]/automations/route.ts" "src/app/api/orgs/[orgId]/automations/[automationId]/route.ts" tests/dashboard-api-guard.test.ts
git commit -m "feat(dashboard): automations list/detail read APIs + guard tests"
```

---

### Task 9: Bookings read APIs (list/detail/PATCH/CSV)

**Files:**
- Create: `.../bookings/route.ts`, `.../bookings/[bookingId]/route.ts`, `.../bookings/export/route.ts`
- Test: extend `tests/dashboard-api-guard.test.ts` (add the bookings list block from Task 8 + a PATCH role test)

- [ ] **Step 1: Add failing tests** — add to `tests/dashboard-api-guard.test.ts`:
  - the `GET bookings` describe block from Task 8 (import `GET as listBookings`).
  - a PATCH test asserting `requireOrgAccess` is called with `minRole: "Admin"` and `automationId`.

```typescript
import { PATCH as patchBooking } from "@/app/api/orgs/[orgId]/automations/[automationId]/bookings/[bookingId]/route";
// ...
describe("PATCH booking status", () => {
  it("requires Admin and enforces automation restriction", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const { updateBookingStatus } = await import("@/lib/dashboard/queries");
    (updateBookingStatus as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const req = new Request("http://x/api/orgs/o1/automations/a1/bookings/b1", {
      method: "PATCH", body: JSON.stringify({ status: "cancelled" }),
    });
    const res = await patchBooking(req, ctx({ orgId: "o1", automationId: "a1", bookingId: "b1" }));
    expect(requireOrgAccess).toHaveBeenCalledWith("o1", expect.objectContaining({ minRole: "Admin", automationId: "a1" }));
    expect(res.status).toBe(200);
  });
  it("rejects an invalid status value with 400", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const req = new Request("http://x/api/orgs/o1/automations/a1/bookings/b1", {
      method: "PATCH", body: JSON.stringify({ status: "bogus" }),
    });
    const res = await patchBooking(req, ctx({ orgId: "o1", automationId: "a1", bookingId: "b1" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run; confirm FAIL** (route modules missing).

- [ ] **Step 3: Write the routes**

`.../bookings/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getBookingsPage } from "@/lib/dashboard/queries";
import { parseBookingFilter } from "@/lib/dashboard/bookings-filter";

export async function GET(req: Request, ctx: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const filter = parseBookingFilter(new URL(req.url).searchParams);
  const { rows, total } = await getBookingsPage({ automationId, filter });
  return NextResponse.json({ rows, total, page: filter.page, limit: filter.limit });
}
```

`.../bookings/[bookingId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getBookingDetail, updateBookingStatus } from "@/lib/dashboard/queries";

const VALID = new Set(["confirmed", "dispatched", "completed", "cancelled", "no_show"]);

export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string; automationId: string; bookingId: string }> }) {
  const { orgId, automationId, bookingId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const booking = await getBookingDetail(bookingId);
  if (!booking) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ booking });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ orgId: string; automationId: string; bookingId: string }> }) {
  const { orgId, automationId, bookingId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin", automationId });
  if (gate instanceof NextResponse) return gate;
  const body = (await req.json().catch(() => null)) as { status?: string } | null;
  if (!body?.status || !VALID.has(body.status)) {
    return new NextResponse("Invalid status", { status: 400 });
  }
  const ok = await updateBookingStatus(bookingId, body.status as never);
  if (!ok) return new NextResponse("Update failed", { status: 500 });
  return NextResponse.json({ ok: true });
}
```

`.../bookings/export/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getBookingsPage } from "@/lib/dashboard/queries";
import { parseBookingFilter, bookingToCsvRow, BOOKING_CSV_HEADERS } from "@/lib/dashboard/bookings-filter";
import { toCsv } from "@/lib/dashboard/csv";

export async function GET(req: Request, ctx: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const filter = parseBookingFilter(new URL(req.url).searchParams);
  // Export all matching rows up to a defensive cap.
  const { rows } = await getBookingsPage({ automationId, filter: { ...filter, page: 1, limit: 100 } });
  const csv = toCsv([...BOOKING_CSV_HEADERS], rows.map(bookingToCsvRow));
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bookings-${automationId}.csv"`,
    },
  });
}
```

> Export note: `getBookingsPage` caps `limit` at 100 (filter validation). For a true full export, a follow-up can loop pages until `total` is reached; for 7a, exporting the current filtered page set (≤100) matches the table's page size and keeps the route simple. Document this as a known limitation in the commit body.

- [ ] **Step 4: Run test + typecheck + lint.** Expected: all `tests/dashboard-api-guard.test.ts` cases PASS; clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/orgs/[orgId]/automations/[automationId]/bookings/" tests/dashboard-api-guard.test.ts
git commit -m "feat(dashboard): bookings list/detail/status/CSV read APIs"
```

---

### Task 10: Conversations read APIs

**Files:**
- Create: `.../conversations/route.ts`, `.../conversations/[conversationId]/route.ts`, `.../conversations/[conversationId]/messages/route.ts`
- Test: extend `tests/dashboard-api-guard.test.ts` with a conversations list guard case.

- [ ] **Step 1: Add failing test** — import `GET as listConversations` and assert it passes `automationId` to `requireOrgAccess` and returns `{ rows, total, page, limit }` on allow (mirror the bookings list case). Run; confirm FAIL.

- [ ] **Step 2: Write the routes** (same guard pattern, `minRole: "Viewer"`, `automationId` enforced):

`.../conversations/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getConversationsPage } from "@/lib/dashboard/queries";
import { parseConversationFilter } from "@/lib/dashboard/bookings-filter";

export async function GET(req: Request, ctx: { params: Promise<{ orgId: string; automationId: string }> }) {
  const { orgId, automationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const filter = parseConversationFilter(new URL(req.url).searchParams);
  const { rows, total } = await getConversationsPage({ automationId, filter });
  return NextResponse.json({ rows, total, page: filter.page, limit: filter.limit });
}
```

`.../conversations/[conversationId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getConversationDetail } from "@/lib/dashboard/queries";

export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string; automationId: string; conversationId: string }> }) {
  const { orgId, automationId, conversationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const conversation = await getConversationDetail(conversationId);
  if (!conversation) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ conversation });
}
```

`.../conversations/[conversationId]/messages/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { getMessages } from "@/lib/dashboard/queries";

export async function GET(_req: Request, ctx: { params: Promise<{ orgId: string; automationId: string; conversationId: string }> }) {
  const { orgId, automationId, conversationId } = await ctx.params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer", automationId });
  if (gate instanceof NextResponse) return gate;
  const messages = await getMessages(conversationId);
  return NextResponse.json({ messages });
}
```

- [ ] **Step 3: Run test + typecheck + lint.** Expected: PASS/clean.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/orgs/[orgId]/automations/[automationId]/conversations/" tests/dashboard-api-guard.test.ts
git commit -m "feat(dashboard): conversations list/detail/messages read APIs"
```

---

### Task 11: Org Overview + Per-Automation Overview pages

**Use `ui-ux-pro-max`** for all page layout/visual work.

**Files:**
- Replace: `src/app/dashboard/page.tsx` (Org Overview §9.3.1)
- Create: `src/app/dashboard/automations/[automationId]/layout.tsx` (guard + subnav)
- Create: `src/app/dashboard/automations/[automationId]/page.tsx` (§9.3.2)
- Create: `src/app/dashboard/automations/[automationId]/live-feed.tsx` (client)
- Test: extend `tests/dashboard-structure.test.ts` existence checks

- [ ] **Step 1: Add failing existence assertions** for the three new page files; run; confirm FAIL.

- [ ] **Step 2: Build Org Overview** — `src/app/dashboard/page.tsx` (Server Component, replace placeholder entirely):
  - `const claims = await requireUser();`
  - `const [org, kpis, cards] = await Promise.all([getOrgSummary(claims.tenant_id), getKpiStrip(claims.tenant_id), getAutomationCards(claims.tenant_id)]);`
  - Header row: org name, plan band, contract renewal (use `formatDateTime`/date), support-contact placeholder.
  - `<KpiStrip items={[{label:"Bookings today", value: kpis.bookingsToday}, {label:"Conversations today", value: kpis.conversationsToday}, {label:"Live automations", value: kpis.liveAutomations}]} />`
  - Automations grid: a card per `AutomationCard` — name + type tag, `StatusBadge`, dispatch-adapter badge, `ChannelIcon`s with health, today's bookings/conversations/conversion%, Start/Stop button (calls the Epic-5 control API; disabled when status is `building`/`uat`), "Open Dashboard" link → `/dashboard/automations/${id}`.
  - "Request a new automation" CTA → links to `/dashboard/support` (built in 7b; link is fine now).
  - **Realtime:** wrap the grid's status badges in a small client component that subscribes via `useRealtimeChannel({ channelName: \`automations:tenant_id=${tenantId}\`, table: "automations", event: "UPDATE", filter: \`tenant_id=eq.${tenantId}\` })` to live-update status. Keep the initial render server-side; hydrate status updates client-side.

- [ ] **Step 3: Build per-automation layout** — `automations/[automationId]/layout.tsx` (Server Component):
  - `const claims = await requireUser();`
  - Enforce automation access: if `claims.automation_restrictions.length > 0 && !claims.automation_restrictions.includes(automationId)` → `notFound()` (import from `next/navigation`).
  - Render `<AutomationSubnav automationId={automationId} />` above `{children}`.

- [ ] **Step 4: Build Per-Automation Overview** — `automations/[automationId]/page.tsx` (Server Component, §9.3.2):
  - Load the automation card (`getAutomationCards` then find, or a dedicated single-automation query), recent bookings (`getBookingsPage` limit 20), recent conversations (`getConversationsPage` limit 10), recent runs (reuse the Epic-5 runs API/query if available; otherwise query `automation_runs` limit 10 — add a `getRecentRuns(automationId)` to `queries.ts` if needed).
  - Header: name, `StatusBadge`, dispatch adapter, Start/Stop/Restart buttons (Epic-5 control API; confirm modal via `SlideOver` or a small confirm dialog), last run timestamp.
  - KPI strip: today's bookings, conversations, conversion %, active channel count, (avg response time — placeholder "—" until analytics in 7b).
  - `TrendChart` (today vs same weekday last week — compute via two `getBookingsPage`/count queries, or a `getTrend` helper; if the trend query is non-trivial, render the chart with `[]` and a "Coming with analytics" note rather than fabricating data — **do not invent numbers**).
  - Booking-type only: `DonutChart` for booking-mode split, `BarChart` for vehicle-type split (aggregate from the recent-bookings query; if insufficient, show empty state).
  - `<LiveFeed automationId={id} initialRows={recentBookings} />` (client).
  - Recent conversations table (last 10) with outcome badges.
  - Last 10 runs table.

- [ ] **Step 5: Build the live feed** — `live-feed.tsx` (`"use client"`):
  ```typescript
  "use client";
  import { useState } from "react";
  import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
  import type { BookingRow } from "@/lib/dashboard/types";
  // Renders a table of the latest bookings; subscribes to INSERTs on bookings
  // filtered by automation_id and prepends new rows (cap at 20).
  export function LiveFeed({ automationId, initialRows }: { automationId: string; initialRows: BookingRow[] }) { /* ... */ }
  ```
  Use `useRealtimeChannel({ channelName: \`bookings:automation_id=${automationId}\`, table: "bookings", event: "INSERT", filter: \`automation_id=eq.${automationId}\` }, (row) => prepend(row))`.

- [ ] **Step 6: Run structure test + typecheck + lint + build**

Run:
```bash
pnpm vitest run tests/dashboard-structure.test.ts
pnpm typecheck
pnpm lint
pnpm build
```
Expected: existence cases PASS; typecheck/lint clean; **`pnpm build` succeeds** (Server/Client component boundaries valid, no `server-only` imported into client files).

- [ ] **Step 7: Commit**

```bash
git add "src/app/dashboard/page.tsx" "src/app/dashboard/automations/" tests/dashboard-structure.test.ts src/lib/dashboard/queries.ts
git commit -m "feat(dashboard): org overview + per-automation overview with live feed + charts"
```

---

### Task 12: Bookings + Conversations pages

**Use `ui-ux-pro-max`** for all page/panel visual work.

**Files:**
- Create: `automations/[automationId]/bookings/page.tsx`, `bookings/bookings-client.tsx`
- Create: `automations/[automationId]/conversations/page.tsx`, `conversations/conversations-client.tsx`
- Test: extend `tests/dashboard-structure.test.ts` existence checks

- [ ] **Step 1: Add failing existence assertions** for the four files; run; confirm FAIL.

- [ ] **Step 2: Build Bookings page** — `bookings/page.tsx` (Server Component, §9.3.3):
  - Reads `searchParams` (Next 15: `searchParams` is a Promise) → `parseBookingFilter`.
  - `const { rows, total } = await getBookingsPage({ automationId, filter });`
  - Renders `<BookingsClient automationId={id} orgId={claims.tenant_id} initialRows={rows} total={total} filter={filter} canEdit={role is Owner/Admin} />`.
  - `bookings-client.tsx` (`"use client"`): `FilterBar` (date range, channel, status, mode, customer search, dispatch-ref search) wired to URL; `DataTable` of `BookingRow` with the §9.3.3 columns (truncated ID, dispatch ref, date/time via `formatDateTime` in tenant TZ, customer, channel icon, pickup/destination one-liners, vehicle, pax, fare via `formatCurrency`, status badge, "View Details"); a `SlideOver` Booking Detail panel that fetches `/api/orgs/${orgId}/automations/${automationId}/bookings/${bookingId}` on open (full addresses, airport section, transcript link, booking JSON collapsed, Cancel/mark-status actions when `canEdit`, calling the PATCH API); a "Download CSV" button linking to the export route with the current query string. **Live updates:** subscribe via `useRealtimeChannel` to booking INSERTs and prepend.

- [ ] **Step 3: Build Conversations page** — `conversations/page.tsx` (Server Component, §9.3.4):
  - `parseConversationFilter` → `getConversationsPage`.
  - `<ConversationsClient ... />` (`"use client"`): `FilterBar` (date range, channel, outcome, language, customer search); `DataTable` columns (conversation ID truncated, customer, channel, started via `formatDateTime`, duration via `formatDurationMs` of ended-started, message count, outcome badge, language); a `SlideOver` transcript panel that fetches `/conversations/${id}` → renders message-by-message (inbound/outbound styling), voice messages show transcript + extracted slots, location messages show lat/lng (Mapbox static is 7b/§9.3.4 enhancement — for 7a show lat/lng text), intent labels per turn, and a booking card link if `bookingId` present.

- [ ] **Step 4: Run structure test + typecheck + lint + build**

Run:
```bash
pnpm vitest run tests/dashboard-structure.test.ts && pnpm typecheck && pnpm lint && pnpm build
```
Expected: PASS/clean; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add "src/app/dashboard/automations/[automationId]/bookings/" "src/app/dashboard/automations/[automationId]/conversations/" tests/dashboard-structure.test.ts
git commit -m "feat(dashboard): bookings table+slide-over+CSV and conversations transcript pages"
```

---

### Task 13: Brand-safety + RLS guard + final gate

**Files:**
- Extend: `tests/dashboard-structure.test.ts` (brand scan + RLS policy presence)

- [ ] **Step 1: Add the failing guard tests** to `tests/dashboard-structure.test.ts`:

```typescript
import { readdirSync, statSync } from "node:fs";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const fp = join(dir, name);
    return statSync(fp).isDirectory() ? tsxFiles(fp) : /\.(ts|tsx)$/.test(fp) ? [fp] : [];
  });
}

describe("dashboard brand safety", () => {
  it("no banned internal vocabulary in dashboard surfaces", () => {
    const banned = /\bn8n\b|\bCabLab\b/i; // 'workflow'/'execution' may appear in engine code, never on dashboard
    const dirs = ["src/app/dashboard", "src/components/dashboard", "src/lib/dashboard"];
    for (const d of dirs) {
      for (const f of tsxFiles(p(d))) {
        expect(readFileSync(f, "utf8"), `${f}`).not.toMatch(banned);
      }
    }
  });

  it("no service-role key usage on dashboard/api-orgs surfaces", () => {
    const dirs = ["src/app/dashboard", "src/components/dashboard", "src/lib/dashboard", "src/app/api/orgs"];
    for (const d of dirs) {
      for (const f of tsxFiles(p(d))) {
        expect(readFileSync(f, "utf8"), `${f} must not use the service-role key`).not.toMatch(/SERVICE_ROLE/);
      }
    }
  });
});

describe("RLS policies present on read tables (regression guard)", () => {
  it("0005 migration has a SELECT/ALL policy for each read table", () => {
    const sql = readFileSync(p("supabase/migrations/0005_rls_policies.sql"), "utf8");
    for (const t of ["bookings", "conversations", "messages", "automation_runs", "channels", "automations"]) {
      expect(sql, `policy for ${t}`).toMatch(new RegExp(`on\\s+public\\.${t}|on\\s+${t}`, "i"));
    }
  });
});
```

- [ ] **Step 2: Run; fix only if a real problem surfaces.** If the brand scan or service-role scan fails, STOP and report the exact `file:line` — do not weaken the regex. If the RLS check fails, the read tables lack policies (a real Plan-1 gap) — STOP and escalate; do not add service-role workarounds.

- [ ] **Step 3: Full gate**

Run:
```bash
pnpm vitest run tests/dashboard-*.test.ts
pnpm typecheck
pnpm lint
pnpm build
```
Report totals. Expected: all dashboard tests pass; typecheck/lint clean; production build succeeds.

- [ ] **Step 4: Commit**

```bash
git add tests/dashboard-structure.test.ts
git commit -m "test(dashboard): brand-safety, service-role, and RLS-presence guards"
```

---

## Self-review against the spec

**Spec coverage (PRD §9.3.1–9.3.4, §12.2–12.4, §8.3, §11):**
- Org Overview (§9.3.1): header, KPI strip, automations grid with status/dispatch/channel-health/today-counts/conversion/Start-Stop/Open, request-automation CTA, Realtime status — Task 11 ✅
- Per-Automation Overview (§9.3.2): header+controls, KPI strip, trend/donut/bar charts, live recent-bookings feed, recent conversations, last 10 runs — Task 11 ✅
- Bookings (§9.3.3): filters, full column set, slide-over detail (addresses, airport, transcript link, JSON, status actions Owner/Admin), CSV — Tasks 9, 12 ✅
- Conversations (§9.3.4): filters, table, transcript panel (voice transcript+slots, location, intent labels, state path, booking link) — Tasks 10, 12 ✅ (Mapbox static preview deferred to 7b; lat/lng shown)
- APIs §12.2–12.4 — Tasks 8, 9, 10 ✅
- Realtime §8.3 + one-channel rule §11 — Task 5 + Tasks 11, 12 ✅
- Responsive ≥360px, p95 ≤1.5s — design via `ui-ux-pro-max`; server components keep payloads small ✅

**Placeholder scan:** library/API tasks (2–10, 13) contain complete code + complete tests. UI tasks (1, 6, 7, 11, 12) intentionally delegate pixel-level styling to `ui-ux-pro-max` per the roadmap mandate, but specify exact files, component contracts (prop names/types), data wiring, and structural/guard tests — no "TBD" logic. The dashboard's correctness surface (data, filters, guards, realtime, CSV) is fully test-covered; visual polish is the skill's job.

**Type consistency:** `BookingFilter`/`ConversationFilter` defined once in `bookings-filter.ts`, consumed by `queries.ts` and every booking/conversation route. DTOs in `types.ts` flow through queries → APIs → pages unchanged. `requireOrgAccess(orgId, { minRole, automationId })` signature matches Epic-5's `src/lib/api/guard.ts`. The `data-table.tsx` `Column<Row>` API matches the admin table's prop names so the pattern is familiar.

**Known limitations (documented):** CSV export covers the filtered page set (≤100 rows) — a paged full-export loop is a 7b/follow-up; avg-response-time KPI + Mapbox location preview land in 7b with analytics.

---

## Execution handoff

Sequence note for the executor: **Tasks 2–5 are independent leaves** (formatters, queries, filters/CSV, realtime hook) that only depend on Task 2's types — after Task 2 they are genuinely parallelizable **if** run in isolated worktrees; otherwise run sequentially to avoid git-index contention. Tasks 6–7 (UI components/charts) depend on Task 2 types. Tasks 8–10 (APIs) depend on Tasks 3–4. Tasks 11–12 (pages) depend on everything prior. Task 13 is the final gate. Build with subagent-driven-development; review the data/guard/realtime tasks (3, 5, 9) and the page-build tasks (11, 12) most carefully.
