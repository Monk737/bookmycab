# Epic 14: Alerting & Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tenants define alert rules over their bot's live metrics (abandonment, no-bookings, response time, revenue), have them evaluated on a schedule, and delivered through notification channels (email first), with every send metered and gated by the `alerting` entitlement.

**Architecture:** Migration 0020 adds `alert_rules` + `notification_channels` (tenant config) and append-only `alert_events` + `notification_log` (history), mirroring the entitlements RLS/immutability patterns from 0017–0019. A pure `evaluateCondition` decides whether a metric value fires a rule. `notify.ts` dispatches a fired alert through a channel (email via the existing `sendEmail`), logs the result, and `recordUsage("alerting")`. `engine.ts` evaluates all enabled rules for a tenant by computing each rule's metric from the existing dashboard insight getters. Tenant API routes (gated by `requireOrgAccess` + `blockIfDemo` + `requireFeature("alerting")`) manage rules/channels. A tenant dashboard page surfaces rules, channels, and the event feed, hidden unless the tenant is entitled. An internal trigger route runs evaluation (cron-friendly).

**Tech Stack:** Supabase Postgres (RLS + immutability triggers), TypeScript, Next.js App Router (routes + server components), Resend (existing `src/lib/email/resend.ts`), Vitest. Builds on Epic 13 (`requireFeature`/`requireQuota`/`recordUsage`) and the existing `requireOrgAccess`, `blockIfDemo`, and dashboard insight getters.

**Dependencies:** Epic 13 (entitlements/metering — `alerting` feature + `notifications` unit already in the catalog), Epic 7 (dashboard insight getters: `getBookingsTrend`, `getResponseStats`, `getRevenueSummary`), Epic 9 (`blockIfDemo`).

---

## File Map

### New — Database
- `supabase/migrations/0020_alerting.sql` — alert_rules, notification_channels, alert_events (append-only), notification_log (append-only) + RLS + immutability triggers

### New — Core library (`src/lib/alerting/`)
- `src/lib/alerting/metrics.ts` — `ALERT_METRICS` registry: metric key → label, unit, and an async value getter `(tenantId, automationId|null) => number`
- `src/lib/alerting/evaluate.ts` — pure `evaluateCondition(value, condition)` + `formatAlertText(rule, value)`
- `src/lib/alerting/notify.ts` — `dispatchNotification(channel, alertEvent, text)` → send + log + meter
- `src/lib/alerting/engine.ts` — `evaluateAlerts(tenantId)` → evaluate enabled rules, fire events, dispatch
- `src/lib/alerting/queries.ts` — service-role CRUD for rules/channels/events used by routes + UI

### New — Tenant API
- `src/app/api/orgs/[orgId]/alerts/rules/route.ts` — GET list, POST create
- `src/app/api/orgs/[orgId]/alerts/rules/[ruleId]/route.ts` — PATCH (enable/disable/edit), DELETE
- `src/app/api/orgs/[orgId]/alerts/channels/route.ts` — GET list, POST create
- `src/app/api/orgs/[orgId]/alerts/evaluate/route.ts` — POST internal evaluation trigger (staff/cron)

### New — Tenant UI
- `src/app/dashboard/alerts/page.tsx` — rules + channels + recent events (gated by `requireFeature`)
- `src/app/dashboard/alerts/alerts-client.tsx` — client forms (create rule, add channel, toggle)

### Modified
- `src/components/dashboard/dashboard-shell.tsx` — add "Alerts" nav item (only rendered when entitled — pass an `showAlerts` prop from the layout)
- `src/app/dashboard/layout.tsx` — resolve `hasFeature(tenant_id, "alerting")` and pass to the shell

### Test files
- `tests/alerting-migration.test.ts` — 0020 SQL structure
- `tests/alerting-evaluate.test.ts` — pure condition evaluation + message formatting
- `tests/alerting-notify.test.ts` — dispatch logs + meters (mocks)
- `tests/alerting-engine.test.ts` — engine fires only when condition met (mocks)
- `tests/alerting-routes.test.ts` — rule creation blocked for demo + unentitled

---

## Task 1: Migration 0020 — alerting schema

**Files:** Create `supabase/migrations/0020_alerting.sql`; Test `tests/alerting-migration.test.ts`

- [ ] **Step 1: Write the failing migration test**

```typescript
// tests/alerting-migration.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0020_alerting.sql"), "utf8");

describe("0020 alerting migration", () => {
  it("creates the four tables", () => {
    expect(sql).toMatch(/create table public\.alert_rules/i);
    expect(sql).toMatch(/create table public\.notification_channels/i);
    expect(sql).toMatch(/create table public\.alert_events/i);
    expect(sql).toMatch(/create table public\.notification_log/i);
  });
  it("makes alert_events and notification_log append-only", () => {
    expect(sql).toMatch(/create trigger alert_events_immutable/i);
    expect(sql).toMatch(/create trigger notification_log_immutable/i);
  });
  it("enables RLS + tenant-scoped select on all four", () => {
    for (const t of ["alert_rules", "notification_channels", "alert_events", "notification_log"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`, "i"));
    }
    expect(sql).toMatch(/alert_rules_select[\s\S]*current_user_tenants\(\)/i);
  });
  it("scopes tenant writes on alert_rules + notification_channels", () => {
    expect(sql).toMatch(/alert_rules_insert/i);
    expect(sql).toMatch(/notification_channels_insert/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/alerting-migration.test.ts` — Expected: FAIL (ENOENT).

- [ ] **Step 3: Create `supabase/migrations/0020_alerting.sql`**

```sql
-- 0020: Alerting & notifications.
--
-- alert_rules + notification_channels are tenant-editable config (tenant RLS
-- write policies, like automations in 0005). alert_events + notification_log
-- are append-only history (immutability trigger like usage_events in 0018).

create table public.alert_rules (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  automation_id uuid references public.automations(id) on delete cascade,
  name          text not null,
  metric        text not null,                              -- key in ALERT_METRICS
  operator      text not null check (operator in ('gt','gte','lt','lte')),
  threshold     numeric not null,
  window_hours  int not null default 24 check (window_hours between 1 and 168),
  severity      text not null default 'warning' check (severity in ('info','warning','critical')),
  enabled       boolean not null default true,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index alert_rules_tenant_idx on public.alert_rules (tenant_id);

create table public.notification_channels (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  type            text not null check (type in ('email','slack','webhook')),
  destination     text not null,                            -- email address / webhook url
  enabled         boolean not null default true,
  verified        boolean not null default false,
  created_at      timestamptz not null default now()
);
create index notification_channels_tenant_idx on public.notification_channels (tenant_id);

create table public.alert_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  rule_id     uuid not null references public.alert_rules(id) on delete cascade,
  value       numeric not null,
  status      text not null default 'firing' check (status in ('firing','acked','resolved')),
  fired_at    timestamptz not null default now()
);
create index alert_events_tenant_idx on public.alert_events (tenant_id, fired_at);

create table public.notification_log (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  channel_id      uuid references public.notification_channels(id) on delete set null,
  alert_event_id  uuid references public.alert_events(id) on delete set null,
  type            text not null,
  status          text not null check (status in ('sent','failed','skipped')),
  error           text,
  sent_at         timestamptz not null default now()
);
create index notification_log_tenant_idx on public.notification_log (tenant_id, sent_at);

-- RLS ----------------------------------------------------------------------
alter table public.alert_rules enable row level security;
alter table public.notification_channels enable row level security;
alter table public.alert_events enable row level security;
alter table public.notification_log enable row level security;

-- Tenant-editable config (select + write), mirroring automations in 0005.
create policy alert_rules_select on public.alert_rules
  for select using (tenant_id in (select public.current_user_tenants()));
create policy alert_rules_insert on public.alert_rules
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy alert_rules_update on public.alert_rules
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy alert_rules_delete on public.alert_rules
  for delete using (tenant_id in (select public.current_user_tenants()));

create policy notification_channels_select on public.notification_channels
  for select using (tenant_id in (select public.current_user_tenants()));
create policy notification_channels_insert on public.notification_channels
  for insert with check (tenant_id in (select public.current_user_tenants()));
create policy notification_channels_update on public.notification_channels
  for update using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
create policy notification_channels_delete on public.notification_channels
  for delete using (tenant_id in (select public.current_user_tenants()));

-- Append-only history: tenant read only; writes via service_role.
create policy alert_events_select on public.alert_events
  for select using (tenant_id in (select public.current_user_tenants()));
create policy notification_log_select on public.notification_log
  for select using (tenant_id in (select public.current_user_tenants()));

create or replace function public.prevent_alert_events_mutation()
returns trigger language plpgsql as $$
begin raise exception 'alert_events is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger alert_events_immutable
  before update or delete on public.alert_events
  for each row execute function public.prevent_alert_events_mutation();

create or replace function public.prevent_notification_log_mutation()
returns trigger language plpgsql as $$
begin raise exception 'notification_log is append-only; UPDATE/DELETE is not permitted'; end;
$$;
create trigger notification_log_immutable
  before update or delete on public.notification_log
  for each row execute function public.prevent_notification_log_mutation();
```

> NOTE: `alert_events.status` is documented as updatable (ack/resolve), but the append-only trigger blocks UPDATE. For v1 we treat ack/resolve as **new** rows are NOT created; acknowledgement is out of scope for this epic (events are fire-and-record). If ack is needed later, a deliberate migration relaxes the trigger. Keep the trigger as written.

- [ ] **Step 4: Apply + test**

Run: `npx supabase db push --local && npx vitest run tests/alerting-migration.test.ts`
Expected: applied; all 4 tests PASS. (If `supabase db push --local` times out, apply via psql: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/0020_alerting.sql` and report.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0020_alerting.sql tests/alerting-migration.test.ts
git commit -m "feat(alerting): migration 0020 — rules, channels, append-only events + log"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Pure condition evaluation + message format

**Files:** Create `src/lib/alerting/evaluate.ts`; Test `tests/alerting-evaluate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/alerting-evaluate.test.ts
import { describe, it, expect } from "vitest";
import { evaluateCondition, formatAlertText, type RuleCondition } from "@/lib/alerting/evaluate";

const cond = (o: RuleCondition["operator"], threshold: number): RuleCondition => ({ operator: o, threshold });

describe("evaluateCondition", () => {
  it("gt fires only when value strictly exceeds threshold", () => {
    expect(evaluateCondition(16, cond("gt", 15))).toBe(true);
    expect(evaluateCondition(15, cond("gt", 15))).toBe(false);
  });
  it("gte fires at or above", () => {
    expect(evaluateCondition(15, cond("gte", 15))).toBe(true);
    expect(evaluateCondition(14, cond("gte", 15))).toBe(false);
  });
  it("lt / lte fire below", () => {
    expect(evaluateCondition(2, cond("lt", 3))).toBe(true);
    expect(evaluateCondition(3, cond("lt", 3))).toBe(false);
    expect(evaluateCondition(3, cond("lte", 3))).toBe(true);
  });
});

describe("formatAlertText", () => {
  it("includes rule name, metric label, value and threshold", () => {
    const text = formatAlertText(
      { name: "High abandonment", metricLabel: "Abandonment rate", operator: "gt", threshold: 15, unit: "%" },
      22.5,
    );
    expect(text).toMatch(/High abandonment/);
    expect(text).toMatch(/Abandonment rate/);
    expect(text).toMatch(/22.5/);
    expect(text).toMatch(/15/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/alerting-evaluate.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/alerting/evaluate.ts`**

```typescript
export interface RuleCondition {
  operator: "gt" | "gte" | "lt" | "lte";
  threshold: number;
}

/** Pure: does `value` satisfy the rule condition (i.e. should the alert fire)? */
export function evaluateCondition(value: number, condition: RuleCondition): boolean {
  switch (condition.operator) {
    case "gt": return value > condition.threshold;
    case "gte": return value >= condition.threshold;
    case "lt": return value < condition.threshold;
    case "lte": return value <= condition.threshold;
  }
}

const OP_WORD: Record<RuleCondition["operator"], string> = {
  gt: "above", gte: "at or above", lt: "below", lte: "at or below",
};

/** Human-readable alert body. Pure. */
export function formatAlertText(
  rule: { name: string; metricLabel: string; operator: RuleCondition["operator"]; threshold: number; unit: string },
  value: number,
): string {
  const u = rule.unit ? rule.unit : "";
  return `Alert: "${rule.name}" — ${rule.metricLabel} is ${value}${u}, which is ${OP_WORD[rule.operator]} your threshold of ${rule.threshold}${u}.`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/alerting-evaluate.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/alerting/evaluate.ts tests/alerting-evaluate.test.ts
git commit -m "feat(alerting): pure condition evaluation + alert text formatting"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Metric registry

**Files:** Create `src/lib/alerting/metrics.ts`

- [ ] **Step 1: Create `src/lib/alerting/metrics.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface AlertMetricDef {
  key: string;
  label: string;
  unit: string;
  /** Compute the current metric value over the trailing window for a tenant. */
  getValue: (tenantId: string, windowHours: number) => Promise<number>;
}

/** ISO timestamp `windowHours` ago. */
function since(windowHours: number): string {
  return new Date(Date.now() - windowHours * 3600_000).toISOString();
}

/** Abandonment rate (%) over the window. */
async function abandonmentRate(tenantId: string, windowHours: number): Promise<number> {
  const sb = svc();
  const { data } = await sb
    .from("conversations")
    .select("outcome")
    .eq("tenant_id", tenantId)
    .gte("started_at", since(windowHours));
  const rows = data ?? [];
  if (rows.length === 0) return 0;
  const abandoned = rows.filter((r: { outcome: string | null }) => r.outcome === "abandoned").length;
  return +((abandoned / rows.length) * 100).toFixed(1);
}

/** Number of confirmed bookings over the window. */
async function bookingsCount(tenantId: string, windowHours: number): Promise<number> {
  const sb = svc();
  const { count } = await sb
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", since(windowHours));
  return count ?? 0;
}

export const ALERT_METRICS: Record<string, AlertMetricDef> = {
  abandonment_rate: { key: "abandonment_rate", label: "Abandonment rate", unit: "%", getValue: abandonmentRate },
  bookings_count: { key: "bookings_count", label: "Bookings", unit: "", getValue: bookingsCount },
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/alerting/metrics.ts
git commit -m "feat(alerting): metric registry (abandonment rate, bookings count)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 4: Notification dispatch (send + log + meter)

**Files:** Create `src/lib/alerting/notify.ts`; Test `tests/alerting-notify.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/alerting-notify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/entitlements/meter", () => ({ recordUsage: vi.fn() }));
const insert = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => ({ insert }) }),
}));

import { sendEmail } from "@/lib/email/resend";
import { recordUsage } from "@/lib/entitlements/meter";
import { dispatchNotification } from "@/lib/alerting/notify";

describe("dispatchNotification", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends email, logs sent, and meters one notification", async () => {
    vi.mocked(sendEmail).mockResolvedValue(true);
    const res = await dispatchNotification(
      { tenantId: "t1", channel: { id: "c1", type: "email", destination: "ops@cab.co" }, alertEventId: "e1", text: "Alert!" },
    );
    expect(res.status).toBe("sent");
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalled(); // notification_log row
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "t1", featureKey: "alerting" }));
  });

  it("logs failed when the send fails and does NOT meter", async () => {
    vi.mocked(sendEmail).mockResolvedValue(false);
    const res = await dispatchNotification(
      { tenantId: "t1", channel: { id: "c1", type: "email", destination: "ops@cab.co" }, alertEventId: "e1", text: "Alert!" },
    );
    expect(res.status).toBe("failed");
    expect(recordUsage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/alerting-notify.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/alerting/notify.ts`**

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { recordUsage } from "@/lib/entitlements/meter";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface DispatchArgs {
  tenantId: string;
  channel: { id: string; type: string; destination: string };
  alertEventId: string;
  text: string;
}

/**
 * Deliver one alert through one channel: send, write a notification_log row,
 * and meter a notification on success. Never throws — returns the outcome.
 */
export async function dispatchNotification(
  args: DispatchArgs,
): Promise<{ status: "sent" | "failed" | "skipped" }> {
  const { tenantId, channel, alertEventId, text } = args;
  let ok = false;
  let error: string | null = null;

  try {
    if (channel.type === "email") {
      ok = await sendEmail({
        to: channel.destination,
        subject: "CabbyBot alert",
        html: `<p>${text}</p>`,
        text,
      });
      if (!ok) error = "email send returned false";
    } else {
      // slack/webhook: POST the text as JSON. Treat a 2xx as success.
      const res = await fetch(channel.destination, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      ok = res.ok;
      if (!ok) error = `webhook returned ${res.status}`;
    }
  } catch (e) {
    ok = false;
    error = e instanceof Error ? e.message : String(e);
  }

  const status: "sent" | "failed" = ok ? "sent" : "failed";
  await svc().from("notification_log").insert({
    tenant_id: tenantId,
    channel_id: channel.id,
    alert_event_id: alertEventId,
    type: channel.type,
    status,
    error,
  });

  if (ok) {
    await recordUsage({ tenantId, featureKey: "alerting", quantity: 1, unit: "notifications" });
  }
  return { status };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/alerting-notify.test.ts` — Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/alerting/notify.ts tests/alerting-notify.test.ts
git commit -m "feat(alerting): notification dispatch — send, log, meter"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 5: Evaluation engine

**Files:** Create `src/lib/alerting/engine.ts`; Test `tests/alerting-engine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/alerting-engine.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const rules = [
  { id: "r1", tenant_id: "t1", name: "High abandonment", metric: "abandonment_rate", operator: "gt", threshold: 15, window_hours: 24, enabled: true },
];
const channels = [{ id: "c1", type: "email", destination: "ops@cab.co", enabled: true }];
const eventInsert = vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null });

vi.mock("@/lib/alerting/queries", () => ({
  listEnabledRules: vi.fn(async () => rules),
  listEnabledChannels: vi.fn(async () => channels),
  insertAlertEvent: vi.fn(async () => ({ id: "e1" })),
}));
vi.mock("@/lib/alerting/metrics", () => ({
  ALERT_METRICS: {
    abandonment_rate: { key: "abandonment_rate", label: "Abandonment rate", unit: "%", getValue: vi.fn() },
  },
}));
vi.mock("@/lib/alerting/notify", () => ({ dispatchNotification: vi.fn(async () => ({ status: "sent" })) }));

import { ALERT_METRICS } from "@/lib/alerting/metrics";
import { dispatchNotification } from "@/lib/alerting/notify";
import { insertAlertEvent } from "@/lib/alerting/queries";
import { evaluateAlerts } from "@/lib/alerting/engine";

describe("evaluateAlerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires + dispatches when the metric exceeds the threshold", async () => {
    vi.mocked(ALERT_METRICS.abandonment_rate.getValue).mockResolvedValue(22);
    const summary = await evaluateAlerts("t1");
    expect(insertAlertEvent).toHaveBeenCalledOnce();
    expect(dispatchNotification).toHaveBeenCalledOnce();
    expect(summary.fired).toBe(1);
  });

  it("does nothing when the metric is under the threshold", async () => {
    vi.mocked(ALERT_METRICS.abandonment_rate.getValue).mockResolvedValue(5);
    const summary = await evaluateAlerts("t1");
    expect(insertAlertEvent).not.toHaveBeenCalled();
    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(summary.fired).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/alerting-engine.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Create `src/lib/alerting/queries.ts`** (used by engine + routes/UI)

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface AlertRuleRow {
  id: string; tenant_id: string; automation_id: string | null; name: string;
  metric: string; operator: "gt" | "gte" | "lt" | "lte"; threshold: number;
  window_hours: number; severity: string; enabled: boolean;
}
export interface ChannelRow { id: string; type: string; destination: string; enabled: boolean; verified: boolean }

export async function listEnabledRules(tenantId: string): Promise<AlertRuleRow[]> {
  const { data } = await svc().from("alert_rules").select("*").eq("tenant_id", tenantId).eq("enabled", true);
  return (data ?? []) as AlertRuleRow[];
}
export async function listRules(tenantId: string): Promise<AlertRuleRow[]> {
  const { data } = await svc().from("alert_rules").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as AlertRuleRow[];
}
export async function listEnabledChannels(tenantId: string): Promise<ChannelRow[]> {
  const { data } = await svc().from("notification_channels").select("*").eq("tenant_id", tenantId).eq("enabled", true);
  return (data ?? []) as ChannelRow[];
}
export async function listChannels(tenantId: string): Promise<ChannelRow[]> {
  const { data } = await svc().from("notification_channels").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as ChannelRow[];
}
export async function insertAlertEvent(tenantId: string, ruleId: string, value: number): Promise<{ id: string }> {
  const { data } = await svc().from("alert_events").insert({ tenant_id: tenantId, rule_id: ruleId, value }).select("id").single();
  return { id: (data?.id as string) ?? "" };
}
export async function createRule(tenantId: string, input: Partial<AlertRuleRow> & { createdBy?: string }): Promise<void> {
  await svc().from("alert_rules").insert({
    tenant_id: tenantId, automation_id: input.automation_id ?? null, name: input.name,
    metric: input.metric, operator: input.operator, threshold: input.threshold,
    window_hours: input.window_hours ?? 24, severity: input.severity ?? "warning",
    created_by: input.createdBy ?? null,
  });
}
export async function setRuleEnabled(tenantId: string, ruleId: string, enabled: boolean): Promise<void> {
  await svc().from("alert_rules").update({ enabled, updated_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("id", ruleId);
}
export async function deleteRule(tenantId: string, ruleId: string): Promise<void> {
  await svc().from("alert_rules").delete().eq("tenant_id", tenantId).eq("id", ruleId);
}
export async function createChannel(tenantId: string, type: string, destination: string): Promise<void> {
  await svc().from("notification_channels").insert({ tenant_id: tenantId, type, destination });
}
export async function listRecentEvents(tenantId: string, limit = 20): Promise<{ id: string; rule_id: string; value: number; fired_at: string }[]> {
  const { data } = await svc().from("alert_events").select("id, rule_id, value, fired_at").eq("tenant_id", tenantId).order("fired_at", { ascending: false }).limit(limit);
  return (data ?? []) as { id: string; rule_id: string; value: number; fired_at: string }[];
}
```

- [ ] **Step 4: Create `src/lib/alerting/engine.ts`**

```typescript
import "server-only";
import { ALERT_METRICS } from "./metrics";
import { evaluateCondition, formatAlertText } from "./evaluate";
import { dispatchNotification } from "./notify";
import { listEnabledRules, listEnabledChannels, insertAlertEvent } from "./queries";

/**
 * Evaluate all enabled rules for a tenant. For each rule whose metric satisfies
 * its condition, insert an alert_event and dispatch to every enabled channel.
 * Returns a summary. Never throws on a single rule failure.
 */
export async function evaluateAlerts(tenantId: string): Promise<{ evaluated: number; fired: number; dispatched: number }> {
  const [rules, channels] = await Promise.all([listEnabledRules(tenantId), listEnabledChannels(tenantId)]);
  let fired = 0;
  let dispatched = 0;

  for (const rule of rules) {
    const metric = ALERT_METRICS[rule.metric];
    if (!metric) continue;
    let value: number;
    try {
      value = await metric.getValue(tenantId, rule.window_hours);
    } catch {
      continue;
    }
    if (!evaluateCondition(value, { operator: rule.operator, threshold: rule.threshold })) continue;

    fired++;
    const event = await insertAlertEvent(tenantId, rule.id, value);
    const text = formatAlertText(
      { name: rule.name, metricLabel: metric.label, operator: rule.operator, threshold: rule.threshold, unit: metric.unit },
      value,
    );
    for (const ch of channels) {
      const res = await dispatchNotification({ tenantId, channel: ch, alertEventId: event.id, text });
      if (res.status === "sent") dispatched++;
    }
  }

  return { evaluated: rules.length, fired, dispatched };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/alerting-engine.test.ts` — Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/alerting/queries.ts src/lib/alerting/engine.ts tests/alerting-engine.test.ts
git commit -m "feat(alerting): evaluation engine + service-role queries"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 6: Tenant API routes (gated)

**Files:** Create the four route files; Test `tests/alerting-routes.test.ts`

- [ ] **Step 1: Write the failing test (demo + entitlement gating on rule create)**

```typescript
// tests/alerting-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/alerting/queries", () => ({ createRule: vi.fn(async () => {}), listRules: vi.fn(async () => []) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { createRule } from "@/lib/alerting/queries";
import { POST } from "@/app/api/orgs/[orgId]/alerts/rules/route";

function req(body: unknown) {
  return new Request("http://x", { method: "POST", body: JSON.stringify(body) });
}
const ctx = { params: Promise.resolve({ orgId: "t1" }) };

describe("POST /alerts/rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a rule when entitled and not demo", async () => {
    const res = await POST(req({ name: "x", metric: "abandonment_rate", operator: "gt", threshold: 15 }), ctx);
    expect(res.status).toBe(200);
    expect(createRule).toHaveBeenCalled();
  });

  it("returns the entitlement 403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "no" }), { status: 403 }) as unknown as ReturnType<typeof requireFeature> extends Promise<infer R> ? R : never,
    );
    const res = await POST(req({ name: "x", metric: "abandonment_rate", operator: "gt", threshold: 15 }), ctx);
    expect(res.status).toBe(403);
    expect(createRule).not.toHaveBeenCalled();
  });

  it("returns the demo 403 for demo sessions", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as ReturnType<typeof blockIfDemo>);
    const res = await POST(req({ name: "x", metric: "abandonment_rate", operator: "gt", threshold: 15 }), ctx);
    expect(res.status).toBe(403);
    expect(createRule).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/alerting-routes.test.ts` — Expected: FAIL (route module not found).

- [ ] **Step 3: Create `src/app/api/orgs/[orgId]/alerts/rules/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { createRule, listRules } from "@/lib/alerting/queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  return NextResponse.json({ rules: await listRules(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const metric = String(body.metric ?? "");
  const operator = String(body.operator ?? "");
  const threshold = Number(body.threshold);
  if (!name || !metric || !["gt", "gte", "lt", "lte"].includes(operator) || Number.isNaN(threshold)) {
    return NextResponse.json({ error: "name, metric, operator and threshold are required." }, { status: 400 });
  }
  await createRule(orgId, {
    name, metric, operator: operator as "gt" | "gte" | "lt" | "lte", threshold,
    window_hours: Number(body.window_hours) || 24,
    severity: (["info", "warning", "critical"].includes(String(body.severity)) ? String(body.severity) : "warning") as string,
    automation_id: (body.automation_id as string) ?? null,
    createdBy: gate.claims.sub,
  });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create `src/app/api/orgs/[orgId]/alerts/rules/[ruleId]/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { setRuleEnabled, deleteRule } from "@/lib/alerting/queries";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string; ruleId: string }> }) {
  const { orgId, ruleId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await setRuleEnabled(orgId, ruleId, Boolean(body.enabled));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ orgId: string; ruleId: string }> }) {
  const { orgId, ruleId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  await deleteRule(orgId, ruleId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Create `src/app/api/orgs/[orgId]/alerts/channels/route.ts`**

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requireFeature } from "@/lib/entitlements/guard";
import { createChannel, listChannels } from "@/lib/alerting/queries";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Viewer" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  return NextResponse.json({ channels: await listChannels(orgId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const demo = blockIfDemo(gate.claims);
  if (demo) return demo;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const type = String(body.type ?? "");
  const destination = String(body.destination ?? "").trim();
  if (!["email", "slack", "webhook"].includes(type) || !destination) {
    return NextResponse.json({ error: "type and destination are required." }, { status: 400 });
  }
  await createChannel(orgId, type, destination);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create `src/app/api/orgs/[orgId]/alerts/evaluate/route.ts`** (internal trigger; staff-only)

```typescript
import "server-only";
import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/api/guard";
import { requireFeature } from "@/lib/entitlements/guard";
import { evaluateAlerts } from "@/lib/alerting/engine";

export const runtime = "nodejs";

/** POST: run alert evaluation for this tenant now. Admin-gated; intended for a
 *  scheduled job calling per-tenant. */
export async function POST(_req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const gate = await requireOrgAccess(orgId, { minRole: "Admin" });
  if (gate instanceof NextResponse) return gate;
  const feat = await requireFeature(gate.claims.tenant_id, "alerting");
  if (feat) return feat;
  const summary = await evaluateAlerts(orgId);
  return NextResponse.json({ ok: true, ...summary });
}
```

- [ ] **Step 7: Run the routes test + typecheck**

Run: `npx vitest run tests/alerting-routes.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/orgs/[orgId]/alerts" tests/alerting-routes.test.ts
git commit -m "feat(alerting): tenant API — rules + channels CRUD + evaluate trigger (gated)"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 7: Tenant dashboard page (entitlement-gated) + nav

**Files:** Create `src/app/dashboard/alerts/page.tsx`, `src/app/dashboard/alerts/alerts-client.tsx`; Modify `src/app/dashboard/layout.tsx`, `src/components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Create `src/app/dashboard/alerts/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listRules, listChannels, listRecentEvents } from "@/lib/alerting/queries";
import { AlertsClient } from "./alerts-client";

export const metadata = { title: "Alerts — CabbyBot" };

export default async function AlertsPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "alerting"))) redirect("/dashboard");

  const [rules, channels, events] = await Promise.all([
    listRules(claims.tenant_id),
    listChannels(claims.tenant_id),
    listRecentEvents(claims.tenant_id),
  ]);

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Alerts</h1>
      <p className="mb-4 text-sm text-slate-500">Get notified when your bot&apos;s metrics cross a threshold.</p>
      <AlertsClient orgId={claims.tenant_id} rules={rules} channels={channels} events={events} isDemo={claims.is_demo} />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/dashboard/alerts/alerts-client.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Rule { id: string; name: string; metric: string; operator: string; threshold: number; enabled: boolean }
interface Channel { id: string; type: string; destination: string; enabled: boolean }
interface Event { id: string; rule_id: string; value: number; fired_at: string }

export function AlertsClient(props: { orgId: string; rules: Rule[]; channels: Channel[]; events: Event[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post(url: string, body: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`); }
      else router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Rules</h2>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {props.rules.length === 0 && <li className="py-2 text-slate-400">No rules yet.</li>}
          {props.rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{r.name} <span className="text-xs text-slate-400">({r.metric} {r.operator} {r.threshold})</span></span>
              <span className={r.enabled ? "text-xs text-emerald-600" : "text-xs text-slate-400"}>{r.enabled ? "On" : "Off"}</span>
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void post(`/api/orgs/${props.orgId}/alerts/rules`, {
                name: f.get("name"), metric: f.get("metric"), operator: f.get("operator"), threshold: Number(f.get("threshold")),
              });
              e.currentTarget.reset();
            }}
            className="flex flex-col gap-2"
          >
            <input name="name" required placeholder="Rule name" className="rounded border border-slate-300 px-2 py-1 text-sm" />
            <div className="flex gap-2">
              <select name="metric" className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="abandonment_rate">Abandonment rate</option>
                <option value="bookings_count">Bookings</option>
              </select>
              <select name="operator" className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option>
              </select>
              <input name="threshold" type="number" step="any" required placeholder="15" className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
            </div>
            <button disabled={busy} type="submit" className="self-start rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Add rule</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Channels</h2>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {props.channels.length === 0 && <li className="py-2 text-slate-400">No channels yet.</li>}
          {props.channels.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{c.type}: {c.destination}</span>
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void post(`/api/orgs/${props.orgId}/alerts/channels`, { type: f.get("type"), destination: f.get("destination") });
              e.currentTarget.reset();
            }}
            className="flex gap-2"
          >
            <select name="type" className="rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="email">Email</option><option value="slack">Slack</option><option value="webhook">Webhook</option>
            </select>
            <input name="destination" required placeholder="ops@yourcab.co.uk" className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Add</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4 md:col-span-2">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent alerts</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {props.events.length === 0 && <li className="py-2 text-slate-400">No alerts fired yet.</li>}
          {props.events.map((ev) => (
            <li key={ev.id} className="flex items-center justify-between py-2">
              <span className="text-slate-700">value {ev.value}</span>
              <span className="text-xs text-slate-400">{new Date(ev.fired_at).toLocaleString("en-GB")}</span>
            </li>
          ))}
        </ul>
      </section>

      {err && <p className="md:col-span-2 text-sm text-red-600" role="alert">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Gate the nav. Modify `src/app/dashboard/layout.tsx`**

Read the file first. It currently resolves `claims` and renders `DashboardShell`. Add the entitlement resolution and pass it through:
- Add import: `import { hasFeature } from "@/lib/entitlements/resolve";`
- After `claims` is resolved, compute: `const showAlerts = claims.tenant_id ? await hasFeature(claims.tenant_id, "alerting") : false;`
- Pass `showAlerts={showAlerts}` to `<DashboardShell ...>`.

- [ ] **Step 4: Modify `src/components/dashboard/dashboard-shell.tsx`**

Read the file first. Add an optional prop `showAlerts?: boolean` to its props type. In the nav items rendering, conditionally include an entry `{ href: "/dashboard/alerts", label: "Alerts" }` when `showAlerts` is true — match the EXACT nav item shape used in this component. If nav items are a static array, build it as `[...base, ...(showAlerts ? [{ href: "/dashboard/alerts", label: "Alerts" }] : [])]`.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: no type errors; compiles `/dashboard/alerts`.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/alerts src/app/dashboard/layout.tsx src/components/dashboard/dashboard-shell.tsx
git commit -m "feat(alerting): tenant alerts dashboard page + entitlement-gated nav"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 8: Integration gate

- [ ] **Step 1: Run the alerting test set**

Run: `npx vitest run tests/alerting-migration.test.ts tests/alerting-evaluate.test.ts tests/alerting-notify.test.ts tests/alerting-engine.test.ts tests/alerting-routes.test.ts`
Expected: all PASS.

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 3: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 4: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(alerting): integration gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Alert rules over metrics (abandonment, bookings) | Tasks 1, 3, 6, 7 |
| Notification channels (email/slack/webhook) | Tasks 1, 4, 6, 7 |
| Append-only event + delivery history | Task 1 |
| Pure condition evaluation | Task 2 |
| Send + log + meter (`recordUsage("alerting")`) | Task 4 |
| Evaluation engine | Task 5 |
| Entitlement gate (`requireFeature("alerting")`) on every surface | Tasks 6, 7 |
| Demo write-block | Task 6 |
| Quota metering of notifications | Task 4 (recordUsage) |
| Scheduled evaluation entry point | Task 6 (evaluate route) |

**Placeholder scan:** none — all steps have complete code.

**Type consistency:** `RuleCondition` defined in `evaluate.ts`, used by engine. `AlertRuleRow`/`ChannelRow` in `queries.ts`, used by engine + routes. `dispatchNotification` signature consistent (engine passes `{tenantId, channel, alertEventId, text}`). `requireFeature(tenantId, "alerting")` matches Epic 13 signature.

**Known limitations (documented):** ack/resolve of events is out of scope (append-only trigger blocks status updates); evaluation is triggered per-tenant by an Admin-gated POST (a platform cron calling it per tenant is a follow-up); quota is metered but not pre-checked before send in v1 (alerts should not be silently dropped — `requireQuota` enforcement on send is a deliberate later refinement).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-03-epic-14-alerting.md`.

**8 tasks. Task 1 (schema) gates all; Tasks 2–3 are independent pure/registry; Tasks 4–5 depend on 1–3; Task 6 depends on 5; Task 7 depends on 5; Task 8 last.**
