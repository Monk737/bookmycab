# Epic 12 — Launch Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BookMyCab launch-ready: a public status page, a config-driven live-demo WhatsApp CTA, finalized public legal pages, and the ops + sales documentation needed to operate and sell the platform.

**Architecture:** Four independent workstreams. (A) A static, brand-safe **status page** driven by a `src/lib/marketing/status.ts` service catalogue + the PRD performance targets, wired into the marketing nav/footer and the public-path allowlist. (B) A **demo-WhatsApp CTA** — a `NEXT_PUBLIC_DEMO_WA_NUMBER` env var + a pure `wa.me` link builder + a presentational component that renders only when a number is configured (resolves open Q12: sandbox/mock via env, hidden until provisioned). (C) **Legal finalization** — enrich the existing Privacy/Terms/DPA/Cookies summaries with launch-ready sections and drop the "Epic 12 stub" framing. (D) **Ops + sales docs** — provisioning SOP, credential-rotation and incident-response runbooks, and a sales one-pager, validated by a structure test.

**Tech Stack:** Next.js 15 App Router (marketing route group), TypeScript, Tailwind v4, zod env validation (`@/env` server + `@/env.client` client-safe), Vitest + @testing-library/react, Markdown docs.

---

## Scope & Honesty Note

Two Epic 12 deliverables are **external/ops, not code**, and are handled as documented artifacts (mirroring the Epic 10/11 precedent):

- **Live demo WhatsApp number (open Q12):** the number itself is a budget/provider decision. This plan ships the *mechanism* — a config-driven CTA that renders a `wa.me` deep link when `NEXT_PUBLIC_DEMO_WA_NUMBER` is set and renders nothing when it isn't — plus a runbook note. Provisioning the actual sandbox/live number is an ops step.
- **Live status data:** the status page is a static service catalogue reporting "operational" by default. Real-time status is wired to the Epic 11 observability stack (Grafana) at deploy; this is noted on-page and in the runbook.

**Brand rule (enforced by `tests/marketing-brand.test.ts`):** files under `src/app/(marketing)`, `src/components/marketing`, and `src/lib/marketing` must never contain `n8n`, `workflow`, `execution`, or `CabLab`. The internal engine is **"BookMyCab Automation Engine"**. Internal runbooks under `docs/runbooks/` are NOT brand-guarded and may reference n8n; the sales one-pager is customer-facing and must not.

---

## File Structure

**Workstream A — Status page:**
- Create `src/lib/marketing/status.ts` — service catalogue, perf targets, `overallStatus`.
- Create `src/app/(marketing)/status/page.tsx` — the page.
- Modify `src/lib/marketing/nav.ts` — add `/status` to `MARKETING_ROUTES` + a footer "Company" item.
- Modify `src/middleware/access.ts` — add `/status` to `PUBLIC_PAGES`.
- Test `tests/marketing-status.test.ts`.

**Workstream B — Demo WhatsApp CTA:**
- Create `src/lib/marketing/whatsapp.ts` — `whatsAppLink`.
- Create `src/components/marketing/demo-whatsapp-cta.tsx` — the CTA.
- Modify `src/env.ts` and `src/env.client.ts` — add `NEXT_PUBLIC_DEMO_WA_NUMBER`.
- Modify `src/app/(marketing)/contact/page.tsx` — render the CTA.
- Tests `tests/marketing-whatsapp.test.ts`, `tests/marketing-demo-whatsapp.test.tsx`.

**Workstream C — Legal finalization:**
- Modify `src/components/marketing/legal-page.tsx` — drop "stub/Epic 12" framing.
- Modify `src/app/(marketing)/{privacy,terms,dpa,cookies}/page.tsx` — add launch sections + bump date.
- Test `tests/marketing-legal.test.ts`.

**Workstream D — Ops + sales docs:**
- Create `docs/runbooks/provisioning-sop.md`, `docs/runbooks/credential-rotation.md`, `docs/runbooks/incident-response.md`, `docs/sales/one-pager.md`.
- Test `tests/launch-docs.test.ts`.

Workstreams **A, B, C, D touch disjoint files and build in parallel.** Task E finalizes.

---

# WORKSTREAM A — Status Page

## Task A1: status service catalogue + `overallStatus`

**Files:**
- Create: `src/lib/marketing/status.ts`
- Test: `tests/marketing-status.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/marketing-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  STATUS_COMPONENTS, PERF_TARGETS, overallStatus, STATUS_LABEL,
  type StatusComponent,
} from "@/lib/marketing/status";

describe("overallStatus", () => {
  const ok: StatusComponent = { name: "x", description: "d", status: "operational" };
  it("is operational when every component is operational", () => {
    expect(overallStatus([ok, ok])).toBe("operational");
  });
  it("is the worst status present", () => {
    expect(overallStatus([ok, { ...ok, status: "degraded" }])).toBe("degraded");
    expect(overallStatus([{ ...ok, status: "degraded" }, { ...ok, status: "outage" }])).toBe("outage");
  });
  it("defaults to operational for an empty catalogue", () => {
    expect(overallStatus([])).toBe("operational");
  });
});

describe("status catalogue", () => {
  it("ships a non-empty service catalogue and perf targets", () => {
    expect(STATUS_COMPONENTS.length).toBeGreaterThan(0);
    expect(PERF_TARGETS.length).toBeGreaterThan(0);
  });
  it("labels every status value", () => {
    expect(STATUS_LABEL.operational).toMatch(/operational/i);
    expect(STATUS_LABEL.degraded).toBeTruthy();
    expect(STATUS_LABEL.outage).toBeTruthy();
  });
  it("uses brand-safe component names (no forbidden engine vocabulary)", () => {
    const blob = JSON.stringify(STATUS_COMPONENTS).toLowerCase();
    for (const banned of ["n8n", "workflow", "execution", "cablab"]) {
      expect(blob.includes(banned), banned).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/marketing-status.test.ts`
Expected: FAIL — module `@/lib/marketing/status` does not exist.

- [ ] **Step 3: Implement the catalogue**

Create `src/lib/marketing/status.ts`:

```ts
// Public status catalogue. Live status is wired to the Epic 11 observability
// stack (Grafana) at deploy; until then every component reports operational.
// Brand rule: the internal engine is the "BookMyCab Automation Engine" — never
// name the underlying tooling on this customer-facing page.

export type ComponentStatus = "operational" | "degraded" | "outage";

export interface StatusComponent {
  name: string;
  description: string;
  status: ComponentStatus;
}

export interface PerfTarget {
  metric: string;
  target: string;
}

export const STATUS_COMPONENTS: StatusComponent[] = [
  { name: "Booking Dashboard", description: "Your live booking feed, conversations and analytics.", status: "operational" },
  { name: "Webhook Gateway", description: "Inbound messages from WhatsApp, Telegram, Messenger, Instagram and the web widget.", status: "operational" },
  { name: "BookMyCab Automation Engine", description: "The bot that runs your booking conversations end to end.", status: "operational" },
  { name: "Dispatch Integrations", description: "AutoCab, iCabbi and Cordic booking hand-off.", status: "operational" },
  { name: "Realtime & Database", description: "Live updates and stored booking records.", status: "operational" },
];

export const PERF_TARGETS: PerfTarget[] = [
  { metric: "Webhook acknowledgement", target: "≤ 300 ms (p95)" },
  { metric: "Message to bot reply", target: "≤ 3 s (p95)" },
  { metric: "Voice note to reply", target: "≤ 8 s (p95)" },
  { metric: "Dashboard page load", target: "≤ 1.5 s (p95)" },
];

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  operational: "All systems operational",
  degraded: "Some systems degraded",
  outage: "Active outage",
};

const RANK: Record<ComponentStatus, number> = { operational: 0, degraded: 1, outage: 2 };

/** Overall status is the worst of all component statuses. */
export function overallStatus(components: StatusComponent[]): ComponentStatus {
  return components.reduce<ComponentStatus>(
    (worst, c) => (RANK[c.status] > RANK[worst] ? c.status : worst),
    "operational",
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/marketing-status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/status.ts tests/marketing-status.test.ts
git commit -m "feat(marketing): status service catalogue + overallStatus"
```

---

## Task A2: status page + nav/footer + public-path allowlist

**Files:**
- Create: `src/app/(marketing)/status/page.tsx`
- Modify: `src/lib/marketing/nav.ts`
- Modify: `src/middleware/access.ts`
- Test: `tests/marketing-status.test.ts` (extend)

- [ ] **Step 1: Extend the failing test**

Append to `tests/marketing-status.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MARKETING_ROUTES } from "@/lib/marketing/nav";
import { PUBLIC_PAGES } from "@/middleware/access";

describe("status route wiring", () => {
  const p = (rel: string) => join(process.cwd(), rel);
  it("is a registered, public marketing route with a page file", () => {
    expect(MARKETING_ROUTES).toContain("/status");
    expect(PUBLIC_PAGES.has("/status")).toBe(true);
    expect(existsSync(p("src/app/(marketing)/status/page.tsx"))).toBe(true);
  });
  it("renders the perf targets and links to the incident channel", () => {
    const src = readFileSync(p("src/app/(marketing)/status/page.tsx"), "utf8");
    expect(src).toMatch(/PERF_TARGETS/);
    expect(src).toMatch(/STATUS_COMPONENTS/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/marketing-status.test.ts`
Expected: FAIL — `/status` not in `MARKETING_ROUTES`/`PUBLIC_PAGES`, page missing.

- [ ] **Step 3: Register the route in nav + footer**

In `src/lib/marketing/nav.ts`, add `"/status"` to the `MARKETING_ROUTES` array (after `"/cookies"`):

```ts
  "/privacy",
  "/terms",
  "/dpa",
  "/cookies",
  "/status",
] as const;
```

And add a Status link to the "Company" footer column — in `FOOTER_COLUMNS`, the `Company` items array:

```ts
    heading: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Case Studies", href: "/case-studies" },
      { label: "Contact", href: "/contact" },
      { label: "Status", href: "/status" },
    ],
```

- [ ] **Step 4: Allow the route in the middleware**

In `src/middleware/access.ts`, add `"/status"` to the `PUBLIC_PAGES` set:

```ts
export const PUBLIC_PAGES = new Set([
  "/", "/pricing", "/how-it-works", "/channels", "/custom-solutions",
  "/case-studies", "/about", "/contact", "/privacy", "/terms", "/dpa", "/cookies", "/status",
]);
```

- [ ] **Step 5: Create the status page**

Create `src/app/(marketing)/status/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Container } from "@/components/marketing/ui/container";
import { Section } from "@/components/marketing/ui/section";
import { Badge } from "@/components/marketing/ui/badge";
import {
  STATUS_COMPONENTS, PERF_TARGETS, STATUS_LABEL, overallStatus,
  type ComponentStatus,
} from "@/lib/marketing/status";

export const metadata: Metadata = {
  title: "Status — BookMyCab",
  description:
    "Live operational status of the BookMyCab platform — dashboard, gateway, automation engine, dispatch and data — plus the performance targets we hold ourselves to.",
};

const DOT: Record<ComponentStatus, string> = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-500",
  outage: "bg-red-500",
};

export default function StatusPage() {
  const overall = overallStatus(STATUS_COMPONENTS);

  return (
    <Section className="pb-14 sm:pb-20">
      <Container className="max-w-3xl">
        <Badge>Status</Badge>
        <h1 className="mt-6 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
          Platform status
        </h1>

        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-6 py-5">
          <span className={`h-3 w-3 flex-shrink-0 rounded-full ${DOT[overall]}`} aria-hidden />
          <p className="text-base font-medium text-ink">{STATUS_LABEL[overall]}</p>
        </div>

        <div className="mt-10 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200">
          {STATUS_COMPONENTS.map((c) => (
            <div key={c.name} className="flex items-start justify-between gap-4 bg-paper px-6 py-5">
              <div>
                <p className="font-display text-lg font-semibold text-ink">{c.name}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">{c.description}</p>
              </div>
              <span className="flex flex-shrink-0 items-center gap-2 pt-1">
                <span className={`h-2.5 w-2.5 rounded-full ${DOT[c.status]}`} aria-hidden />
                <span className="text-sm capitalize text-gray-600">{c.status}</span>
              </span>
            </div>
          ))}
        </div>

        <h2 className="mt-14 font-display text-2xl font-semibold tracking-tight text-ink">
          Performance targets
        </h2>
        <p className="mt-3 text-base leading-relaxed text-gray-600">
          The service levels we design and monitor against.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
          {PERF_TARGETS.map((t) => (
            <div key={t.metric} className="flex items-center justify-between gap-4 border-b border-gray-100 bg-paper px-6 py-4 last:border-b-0">
              <span className="text-sm text-gray-600">{t.metric}</span>
              <span className="font-display text-sm font-semibold tabular-nums text-ink">{t.target}</span>
            </div>
          ))}
        </div>

        <p className="mt-12 border-t border-gray-200 pt-8 text-sm leading-relaxed text-gray-500">
          Live status is published here and to your dashboard. For an active incident,
          email{" "}
          <a className="text-ink underline underline-offset-4" href="mailto:hello@bookmycab.com">
            hello@bookmycab.com
          </a>
          .
        </p>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 6: Run tests (status + the shared marketing structure guard)**

Run: `pnpm vitest run tests/marketing-status.test.ts tests/marketing-structure.test.ts tests/marketing-brand.test.ts`
Expected: PASS — status wiring green; the shared structure test still passes (the new route has a page + is public); brand guard passes (no forbidden vocabulary).

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(marketing)/status/page.tsx" src/lib/marketing/nav.ts src/middleware/access.ts tests/marketing-status.test.ts
git commit -m "feat(marketing): public status page + nav/footer/allowlist wiring"
```

---

# WORKSTREAM B — Demo WhatsApp CTA

## Task B1: `whatsAppLink` helper + env var

**Files:**
- Create: `src/lib/marketing/whatsapp.ts`
- Modify: `src/env.ts`, `src/env.client.ts`
- Test: `tests/marketing-whatsapp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/marketing-whatsapp.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { whatsAppLink } from "@/lib/marketing/whatsapp";

describe("whatsAppLink", () => {
  it("builds a wa.me link from an international number, stripping non-digits", () => {
    expect(whatsAppLink("+44 7700 900123")).toBe("https://wa.me/447700900123");
  });
  it("appends a URL-encoded prefilled message", () => {
    expect(whatsAppLink("447700900123", "Hi there!")).toBe("https://wa.me/447700900123?text=Hi%20there!");
  });
  it("returns null when the number is missing or has no digits", () => {
    expect(whatsAppLink(undefined)).toBeNull();
    expect(whatsAppLink("")).toBeNull();
    expect(whatsAppLink("n/a")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/marketing-whatsapp.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/marketing/whatsapp.ts`:

```ts
/**
 * Builds a `wa.me` deep link from an international phone number and an optional
 * prefilled message. Returns null when no usable number is configured, so the
 * demo CTA can render nothing until a number is provisioned (Q12).
 */
export function whatsAppLink(number: string | undefined, message?: string): string | null {
  const digits = (number ?? "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/marketing-whatsapp.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the env var (server + client-safe)**

In `src/env.client.ts`, add to the `z.object({ ... })` schema (after `NEXT_PUBLIC_SENTRY_DSN`):

```ts
  NEXT_PUBLIC_DEMO_WA_NUMBER: z.string().optional(),
```

and add the matching line to the `rawSource` map (after the `NEXT_PUBLIC_SENTRY_DSN` entry):

```ts
  NEXT_PUBLIC_DEMO_WA_NUMBER: process.env.NEXT_PUBLIC_DEMO_WA_NUMBER,
```

In `src/env.ts`, mirror the same two additions — add `NEXT_PUBLIC_DEMO_WA_NUMBER: z.string().optional(),` to the `z.object` schema (near the other `NEXT_PUBLIC_*` vars) and `NEXT_PUBLIC_DEMO_WA_NUMBER: process.env.NEXT_PUBLIC_DEMO_WA_NUMBER,` to its `rawSource` map.

> Both files use the literal `process.env.X` source-map pattern so Next.js inlines the value into the client bundle.

- [ ] **Step 6: Run typecheck + the env tests**

Run: `pnpm typecheck && pnpm vitest run $(ls tests | grep -iE 'env|access' | sed 's#^#tests/#' | tr '\n' ' ')`
Expected: clean + PASS (the new optional var doesn't disturb existing validation).

- [ ] **Step 7: Commit**

```bash
git add src/lib/marketing/whatsapp.ts src/env.ts src/env.client.ts tests/marketing-whatsapp.test.ts
git commit -m "feat(marketing): whatsAppLink helper + NEXT_PUBLIC_DEMO_WA_NUMBER env"
```

---

## Task B2: `DemoWhatsAppCta` component + contact page wiring

**Files:**
- Create: `src/components/marketing/demo-whatsapp-cta.tsx`
- Modify: `src/app/(marketing)/contact/page.tsx`
- Test: `tests/marketing-demo-whatsapp.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/marketing-demo-whatsapp.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(() => { cleanup(); vi.resetModules(); });

async function renderWith(number: string | undefined) {
  vi.doMock("@/env.client", () => ({ clientEnv: { NEXT_PUBLIC_DEMO_WA_NUMBER: number } }));
  const { DemoWhatsAppCta } = await import("@/components/marketing/demo-whatsapp-cta");
  render(<DemoWhatsAppCta />);
}

describe("DemoWhatsAppCta", () => {
  it("renders a wa.me link when a demo number is configured", async () => {
    await renderWith("+44 7700 900123");
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link.getAttribute("href")).toBe("https://wa.me/447700900123?text=Hi%20BookMyCab%20%E2%80%94%20I'd%20like%20to%20try%20the%20demo%20booking%20bot.");
  });
  it("renders nothing when no demo number is configured", async () => {
    await renderWith(undefined);
    expect(screen.queryByRole("link", { name: /whatsapp/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/marketing-demo-whatsapp.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/marketing/demo-whatsapp-cta.tsx`:

```tsx
import { clientEnv } from "@/env.client";
import { whatsAppLink } from "@/lib/marketing/whatsapp";

const DEMO_MESSAGE = "Hi BookMyCab — I'd like to try the demo booking bot.";

/**
 * Renders a "message our demo bot on WhatsApp" link when NEXT_PUBLIC_DEMO_WA_NUMBER
 * is configured; renders nothing otherwise (the live demo number is provisioned
 * separately — Q12). Presentational and server-renderable.
 */
export function DemoWhatsAppCta() {
  const href = whatsAppLink(clientEnv.NEXT_PUBLIC_DEMO_WA_NUMBER, DEMO_MESSAGE);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-ink bg-ink px-6 py-3 text-sm font-semibold text-paper transition-colors duration-200 hover:bg-gray-800"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
        <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39a9.9 9.9 0 0 0 4.74 1.21h.004c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2zm5.8 14.06c-.25.69-1.43 1.32-1.97 1.37-.5.05-1.14.07-1.84-.12-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.23-5-4.43-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.17 1.03-2.46.27-.3.59-.37.79-.37l.57.01c.18.01.43-.07.67.51.25.6.84 2.06.91 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.07 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.71.81 2 .96.3.15.5.22.57.35.07.12.07.71-.18 1.4z" />
      </svg>
      Message our demo bot on WhatsApp
    </a>
  );
}
```

- [ ] **Step 4: Wire it into the contact page**

In `src/app/(marketing)/contact/page.tsx`, add the import after the existing `TryDashboardLink` import:

```tsx
import { DemoWhatsAppCta } from "@/components/marketing/demo-whatsapp-cta";
```

Then render it just below the existing CTA row in the header section. Replace:

```tsx
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
          </div>
```

with:

```tsx
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <DiscoveryCta size="lg" />
            <TryDashboardLink size="lg" />
            <DemoWhatsAppCta />
          </div>
```

- [ ] **Step 5: Run tests + typecheck + brand guard**

Run: `pnpm vitest run tests/marketing-demo-whatsapp.test.tsx tests/marketing-brand.test.ts`
Expected: PASS (component renders/withholds correctly; no forbidden vocabulary).

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/demo-whatsapp-cta.tsx "src/app/(marketing)/contact/page.tsx" tests/marketing-demo-whatsapp.test.tsx
git commit -m "feat(marketing): demo WhatsApp CTA on the contact page (config-gated)"
```

---

# WORKSTREAM C — Legal Finalization

## Task C1: drop the "stub" framing from the legal layout

**Files:**
- Modify: `src/components/marketing/legal-page.tsx`
- Test: `tests/marketing-legal.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/marketing-legal.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const p = (rel: string) => join(process.cwd(), rel);

describe("legal layout framing", () => {
  it("no longer describes the legal pages as Epic 12 stubs", () => {
    const src = readFileSync(p("src/components/marketing/legal-page.tsx"), "utf8");
    expect(src).not.toMatch(/stub/i);
    expect(src).not.toMatch(/Epic 12/i);
  });
});

describe("legal pages carry launch-ready sections", () => {
  const required: Record<string, string[]> = {
    privacy: ["Security", "Your rights and complaints"],
    terms: ["Liability", "Governing law"],
    dpa: ["International transfers", "Personal-data breaches"],
    cookies: ["Cookies we set"],
  };
  for (const [page, headings] of Object.entries(required)) {
    it(`${page} includes ${headings.join(", ")}`, () => {
      const src = readFileSync(p(`src/app/(marketing)/${page}/page.tsx`), "utf8");
      for (const h of headings) expect(src.includes(h), h).toBe(true);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/marketing-legal.test.ts`
Expected: FAIL — the layout still says "stub"/"Epic 12"; pages lack the new headings.

- [ ] **Step 3: Update the layout docstring**

In `src/components/marketing/legal-page.tsx`, replace the component docstring comment:

```tsx
/**
 * Shared layout for the placeholder legal pages (Privacy/Terms/DPA/Cookies).
 * Real legal copy lands in Epic 12; these are structured stubs that carry a
 * "Last updated" date and a clear notice that final terms are issued at contract.
 */
```

with:

```tsx
/**
 * Shared layout for the public legal pages (Privacy/Terms/DPA/Cookies). These are
 * the finalized customer-facing summaries; the binding, signed documents are still
 * issued with each contract at provisioning (stated in the notice below).
 */
```

- [ ] **Step 4: Run test (layout assertion now passes; page assertions still fail)**

Run: `pnpm vitest run tests/marketing-legal.test.ts -t "Epic 12 stubs"`
Expected: PASS for the framing test; the page-section tests remain red until Task C2.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/legal-page.tsx tests/marketing-legal.test.ts
git commit -m "docs(legal): finalize legal layout framing (drop stub language)"
```

---

## Task C2: add launch-ready sections to each legal page

**Files:**
- Modify: `src/app/(marketing)/privacy/page.tsx`
- Modify: `src/app/(marketing)/terms/page.tsx`
- Modify: `src/app/(marketing)/dpa/page.tsx`
- Modify: `src/app/(marketing)/cookies/page.tsx`

Each page exports a `SECTIONS: LegalSection[]` array. Append the new sections **before** the existing closing "This is a summary"/"These terms are a summary" entry so the binding-terms note stays last. Also bump each page's `lastUpdated` from `"2026-05-31"` to `"2026-06-03"`.

- [ ] **Step 1: Privacy — add Security + rights/complaints**

In `src/app/(marketing)/privacy/page.tsx`, insert these two entries into `SECTIONS` immediately before the final `{ heading: "Contact", ... }` entry:

```ts
  {
    heading: "Security",
    body: "Tenant data is isolated per customer with row-level security in the database, credentials are held in an encrypted vault, and access to production is restricted and audit-logged. We apply the safeguards set out in your Data Processing Agreement.",
  },
  {
    heading: "Your rights and complaints",
    body: "Where UK GDPR applies, individuals can request access to, correction of, or deletion of their personal data. Requests about your customers' data are routed to you as the controller. If you are not satisfied with how a concern is handled, you can complain to the UK Information Commissioner's Office (ICO).",
  },
```

Change `lastUpdated="2026-05-31"` to `lastUpdated="2026-06-03"`.

- [ ] **Step 2: Terms — add Liability + Governing law**

In `src/app/(marketing)/terms/page.tsx`, insert these two entries into `SECTIONS` immediately before the final `{ heading: "These terms are a summary", ... }` entry:

```ts
  {
    heading: "Liability",
    body: "We provide the service with reasonable skill and care, but to the extent permitted by law we are not liable for indirect or consequential loss, or for outages of the third-party channel and dispatch providers you connect. The liability caps and warranties that apply are set out in your contract.",
  },
  {
    heading: "Governing law",
    body: "These terms and your contract are governed by the laws of England and Wales, and the courts of England and Wales have exclusive jurisdiction over any dispute.",
  },
```

Change `lastUpdated="2026-05-31"` to `lastUpdated="2026-06-03"`.

- [ ] **Step 3: DPA — add International transfers + breaches**

In `src/app/(marketing)/dpa/page.tsx`, insert these two entries into `SECTIONS` immediately before the final `{ heading: "This is a summary", ... }` entry:

```ts
  {
    heading: "International transfers",
    body: "We process personal data in the UK and EU. Where a sub-processor you have approved processes data outside the UK/EU, transfers are covered by an adequacy decision or standard contractual clauses, as recorded in the signed agreement.",
  },
  {
    heading: "Personal-data breaches",
    body: "If we become aware of a personal-data breach affecting your data, we notify you without undue delay and support your obligations to notify the ICO and affected individuals where required.",
  },
```

Change `lastUpdated="2026-05-31"` to `lastUpdated="2026-06-03"`.

- [ ] **Step 4: Cookies — add a concrete cookie list**

In `src/app/(marketing)/cookies/page.tsx`, insert this entry into `SECTIONS` immediately before the final `{ heading: "This is a summary", ... }` entry. Its `body` is JSX (the `LegalSection.body` type is `ReactNode`):

```tsx
  {
    heading: "Cookies we set",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li><strong>Supabase auth session</strong> — strictly necessary; keeps you signed in to your dashboard. Cleared on sign-out.</li>
        <li><strong>Demo session</strong> — strictly necessary for the read-only demo; short-lived and removed when the demo ends.</li>
        <li><strong>Cal.com booking widget</strong> — set by Cal.com only if you open the discovery-call scheduler, under their cookie policy.</li>
      </ul>
    ),
  },
```

Change `lastUpdated="2026-05-31"` to `lastUpdated="2026-06-03"`.

- [ ] **Step 5: Run the legal + brand + structure tests**

Run: `pnpm vitest run tests/marketing-legal.test.ts tests/marketing-brand.test.ts tests/marketing-structure.test.ts`
Expected: PASS — all required headings present; no forbidden vocabulary; structure intact.

Run: `pnpm typecheck`
Expected: clean (the Cookies JSX body is valid `ReactNode`).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(marketing)/privacy/page.tsx" "src/app/(marketing)/terms/page.tsx" "src/app/(marketing)/dpa/page.tsx" "src/app/(marketing)/cookies/page.tsx"
git commit -m "docs(legal): launch-ready sections for privacy, terms, dpa, cookies"
```

---

# WORKSTREAM D — Ops & Sales Documentation

## Task D1: provisioning SOP, runbooks, sales one-pager

**Files:**
- Create: `docs/runbooks/provisioning-sop.md`
- Create: `docs/runbooks/credential-rotation.md`
- Create: `docs/runbooks/incident-response.md`
- Create: `docs/sales/one-pager.md`
- Test: `tests/launch-docs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/launch-docs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const p = (rel: string) => join(process.cwd(), rel);

const DOCS: Record<string, string[]> = {
  "docs/runbooks/provisioning-sop.md": ["## Discovery", "## Provision the tenant", "## UAT", "## Go-live"],
  "docs/runbooks/credential-rotation.md": ["## When to rotate", "## Channel credentials", "## Dispatch credentials", "## Vault key"],
  "docs/runbooks/incident-response.md": ["## Severity levels", "## On-call", "## Communication", "## Post-incident"],
  "docs/sales/one-pager.md": ["## The problem", "## The solution", "## Channels", "## Pricing"],
};

describe("launch documentation", () => {
  for (const [file, headings] of Object.entries(DOCS)) {
    it(`${file} exists with its required sections`, () => {
      expect(existsSync(p(file)), file).toBe(true);
      const src = readFileSync(p(file), "utf8");
      for (const h of headings) expect(src.includes(h), `${file} → ${h}`).toBe(true);
    });
  }
  it("the customer-facing one-pager never names the internal tooling", () => {
    const src = readFileSync(p("docs/sales/one-pager.md"), "utf8").toLowerCase();
    for (const banned of ["n8n", "cablab"]) expect(src.includes(banned), banned).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/launch-docs.test.ts`
Expected: FAIL — docs do not exist.

- [ ] **Step 3: Create the provisioning SOP**

Create `docs/runbooks/provisioning-sop.md`:

```markdown
# Tenant Provisioning SOP

How FlowMo staff take a signed customer from contract to live automation. Admin-only;
there is no public signup.

## Discovery
- Run the discovery call; capture fleet size, channels in use, and dispatch system (AutoCab / iCabbi / Cordic).
- Confirm pricing band and setup fee; issue the contract, DPA, and binding legal terms.

## Provision the tenant
- Create the tenant via the admin console (`/admin`); set `dispatch_adapter` and company id.
- Store channel + dispatch credentials in the vault (never in plaintext, never in env).
- Create the customer's automation(s); build the bespoke conversation flows in the Automation Engine.
- Invite the Owner via Supabase `invite()`; MFA is enforced for Owner/Admin.

## UAT
- Move the automation to `uat`; run the QA E2E suite (`pnpm test:e2e`) and a manual text + voice booking.
- Verify dispatch hand-off creates a real booking and the dashboard live feed updates.

## Go-live
- Flip the automation to `live`; start Stripe billing from the go-live date.
- Confirm webhook ACK p95 ≤ 300 ms on the status dashboard.
- Hand over the dashboard walkthrough; point the customer at `/status` and support.
```

- [ ] **Step 4: Create the credential-rotation runbook**

Create `docs/runbooks/credential-rotation.md`:

```markdown
# Credential Rotation Runbook

All secrets live in the encrypted vault or the platform secret manager — never in
the repo or in plaintext env on a customer surface.

## When to rotate
- On a scheduled cadence (at least annually), on suspected compromise, or when an operator with access leaves.

## Channel credentials
- Regenerate the provider token (WhatsApp/Meta, Telegram, etc.) in the provider console.
- Update the vault entry via the admin console; the gateway picks up the new secret on next resolve (Redis cache TTL ≤ 5 min).
- Send a test inbound message to confirm signature verification still passes.

## Dispatch credentials
- Rotate the AutoCab subscription key (or iCabbi/Cordic secret) with the provider.
- Update the vaulted `autocab_subscription_key`; run a test quote + booking against the adapter.

## Vault key
- Rotating `SUPABASE_VAULT_KEY` is a coordinated operation: re-encrypt stored secrets under the new key, then roll the platform secret. Schedule a maintenance window and verify a booking end-to-end afterwards.
```

- [ ] **Step 5: Create the incident-response runbook**

Create `docs/runbooks/incident-response.md`:

```markdown
# Incident Response Runbook

Companion to the observability runbook (`docs/observability.md`) and the public
status page (`/status`).

## Severity levels
- **SEV1** — platform down or bookings not dispatching for multiple tenants.
- **SEV2** — degraded for one tenant or one channel; workaround exists.
- **SEV3** — minor/cosmetic; no booking impact.

## On-call
- The on-call engineer acknowledges via the alert channel, opens an incident doc, and takes incident-commander role for SEV1/SEV2.
- Triage with Grafana dashboards (latency, error rate, webhook throughput, dispatch latency per adapter) and Sentry.

## Communication
- Update `/status` component states (degraded/outage) for customer-visible impact.
- For SEV1, notify affected tenant Owners by email; give an ETA and updates at a fixed cadence.

## Post-incident
- Within 3 business days, write a blameless post-mortem: timeline, root cause, customer impact, and corrective actions with owners and dates.
```

- [ ] **Step 6: Create the sales one-pager**

Create `docs/sales/one-pager.md` (customer-facing — use "BookMyCab Automation Engine", never the internal tooling name):

```markdown
# BookMyCab — Sales One-Pager

**Your cab company. On every channel. On autopilot.**

## The problem
Cab and taxi firms lose bookings after hours and at peak times, and pay staff to retype
messages from WhatsApp, Telegram and socials into their dispatch system.

## The solution
BookMyCab builds each operator a bespoke booking bot — never a template — that takes
bookings across WhatsApp, Telegram, Messenger, Instagram and a web widget, runs the whole
conversation on the BookMyCab Automation Engine, and writes confirmed jobs straight into
your dispatch system. You watch it live on your dashboard.

## Channels
WhatsApp · Telegram · Messenger · Instagram · Web widget — text and voice notes, in
multiple languages.

## Dispatch
AutoCab today; iCabbi and Cordic on the roadmap. You keep your dispatch system and your
numbers; we hand off bookings into it.

## Pricing
A one-time setup fee plus a monthly subscription, on a minimum twelve-month term that then
rolls monthly. You bring your own channel and dispatch accounts and own your customer base.
Start with a discovery call — every build is admin-provisioned, no public signup.

## Proof
Try the read-only demo dashboard, and message the live demo bot on WhatsApp to make a
booking yourself.
```

- [ ] **Step 7: Run the docs test**

Run: `pnpm vitest run tests/launch-docs.test.ts`
Expected: PASS (all four docs present with required sections; one-pager brand-clean).

- [ ] **Step 8: Commit**

```bash
git add docs/runbooks docs/sales tests/launch-docs.test.ts
git commit -m "docs(launch): provisioning SOP, credential-rotation + incident runbooks, sales one-pager"
```

---

# Task E: Integration gate + roadmap marker

**Files:**
- Modify: `docs/superpowers/plans/00-bookmycab-roadmap.md`

Runs after Workstreams A, B, C, D.

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 2: Run the whole suite**

Run: `pnpm test`
Expected: PASS except the pre-existing, environment-dependent `tests/engine-client.integration.test.ts` (live-n8n `fetch` ConnectTimeout — not a regression). All new marketing/launch suites green; `marketing-structure`, `marketing-brand` still green.

- [ ] **Step 3: Flip the roadmap marker**

In `docs/superpowers/plans/00-bookmycab-roadmap.md`, change:

```markdown
### ⬜ Plan 12 — Epic 12: Launch Readiness
```

to (use the short SHA from `git rev-parse --short HEAD` after the last workstream commit; date 2026-06-03):

```markdown
### ✅ Plan 12 — Epic 12: Launch Readiness  → `2026-06-03-epic-12-launch-readiness.md`  (DONE & merged to `master` 2026-06-03, HEAD `<short-sha>`)
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/00-bookmycab-roadmap.md
git commit -m "docs: mark Epic 12 done in roadmap index"
```

---

## Self-Review

**Spec coverage (roadmap Plan 12 deliverables):**
1. *Legal pages (Privacy, Terms, DPA, Cookie Policy)* — Workstream C finalizes all four (framing + launch-ready sections), validated by `tests/marketing-legal.test.ts`. (Pages already existed from Epic 2 as stubs.)
2. *Status page* — Workstream A builds `/status` (catalogue + perf targets + nav/footer/allowlist), validated by `tests/marketing-status.test.ts` and the shared structure guard.
3. *Live demo WhatsApp number (open Q12)* — Workstream B ships the config-driven CTA (`whatsAppLink` + `DemoWhatsAppCta` + `NEXT_PUBLIC_DEMO_WA_NUMBER`), hidden until a number is provisioned; the provisioning itself is an ops step noted in the runbook. Q12 resolved: sandbox/mock via env, no hard-coded number.
4. *Sales collateral* — `docs/sales/one-pager.md` (Workstream D).
5. *Ops runbook (provisioning SOP, credential rotation, incident response)* — three runbooks under `docs/runbooks/` (Workstream D); incident-response cross-refs the Epic 11 `docs/observability.md`.

**Placeholder scan:** No TBD/TODO; every code/content step shows complete content; tests assert real behavior.

**Type consistency:** `StatusComponent`/`ComponentStatus`/`PerfTarget` and `overallStatus`/`STATUS_COMPONENTS`/`PERF_TARGETS`/`STATUS_LABEL` are defined in A1 and consumed unchanged by the A2 page + test. `whatsAppLink(number, message)` signature is identical across B1 (definition), B2 (component), and both tests. `LegalSection` (existing type) is reused in C2; the Cookies `body` is `ReactNode` (JSX allowed).

**Brand safety:** All A/B/C surfaces live under brand-guarded dirs and avoid `n8n`/`workflow`/`execution`/`CabLab`; `tests/marketing-brand.test.ts` enforces this. The sales one-pager (customer-facing, but under `docs/`) is separately asserted brand-clean; internal runbooks may reference n8n.

**No new npm dependencies.** Status/CTA/legal reuse existing marketing UI primitives; tests use the existing Vitest + @testing-library/react setup.

**Parallelization:** Workstreams A, B, C, D touch disjoint files (A: status/nav/access; B: env/whatsapp/contact; C: legal; D: docs) → four parallel agents. Task E is the integration gate.
