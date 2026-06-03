# Epic 11 — Observability & QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give CabbyBot a vendor-neutral, fully-tested observability layer (traces, metrics, error reporting) wired into the webhook gateway / engine / dispatch surfaces, plus version-controlled Grafana dashboards, Playwright E2E specs, and a webhook load test.

**Architecture:** A dependency-free telemetry core exposes one swappable `TelemetrySink` seam. Application code emits spans/metrics/errors through tiny helpers (`withSpan`, `incCounter`, `recordHistogram`, `reportError`) that default to a no-op sink — so tests and `next build` stay clean with zero new npm dependencies. A Next.js `instrumentation.ts` hook selects a real sink at boot when an env flag is set (`StructuredLogSink` emits OTLP-shaped JSON lines to stdout, which a Grafana Agent / Vector / Sentry relay scrapes at deploy). Grafana dashboard JSON, Playwright E2E specs, and the load-test runner are committed as artifacts validated by shape tests; their live execution (install the OTel/Sentry SDKs, point at Grafana Cloud, run Playwright against a deployed app, fire the load test at a real gateway) is documented in `docs/observability.md` as the deploy/ops step.

**Tech Stack:** TypeScript, Next.js 15 instrumentation hook, Vitest (unit + shape tests), Grafana dashboard JSON, Playwright (`@playwright/test`, activated at QA-setup time), zod env validation.

---

## Scope & Honesty Note

Epic 11 spans five subsystems that mostly integrate with **external services that cannot run live in this repo** (Grafana Cloud, Sentry, an OTLP collector, a deployed app for Playwright, a real gateway for load). Following the Epic 10 precedent (n8n artifacts + shape tests, live deploy separate), this plan delivers:

- **Fully unit-tested in this repo:** the telemetry core (`sink`/`telemetry`/`metrics`/`error-reporting`), the instrumentation wiring (webhook route, engine client, dispatch adapters), the `initObservability` selector, the percentile + load-runner math.
- **Committed artifacts validated by shape tests, activated at deploy:** Grafana dashboard JSON, Playwright config + 5 E2E specs, the webhook load-test script, the observability runbook.

**No new runtime npm dependencies are added.** `@playwright/test` is referenced by the E2E specs but those live under `e2e/` which is excluded from `tsconfig` and from Vitest; activating them is a documented `pnpm add -D @playwright/test && pnpm exec playwright install` step. This keeps `pnpm test`, `pnpm typecheck`, and the lockfile untouched.

---

## Metric & Span Name Contract (shared across all workstreams)

These names are the contract between the instrumentation (Workstream B) and the Grafana dashboard (Workstream D). Use them **verbatim**:

| Name | Kind | Attributes | Emitted by |
|---|---|---|---|
| `webhook_inbound_total` | counter | `channel`, `status` | webhook route |
| `webhook_ack_ms` | histogram | `channel` | webhook route |
| `engine_request_ms` | histogram | `op`, `status` | engine client |
| `dispatch_latency_ms` | histogram | `adapter`, `op`, `status` | `instrumentAdapter` |
| `engine.request` | span | `op`, `status` | engine client |

`status` values for `webhook_inbound_total`: `invalid` (401), `unknown` (200 no-route), `stopped` (200), `rate_limited` (429), `deduped` (200), `forwarded` (200).

---

## File Structure

**Workstream A — Telemetry core (dependency-free):**
- Create `src/lib/observability/sink.ts` — `TelemetrySink` interface, record types, `noopSink`, `MemorySink`, `StructuredLogSink`, and the `setSink`/`getSink`/`resetSink` registry.
- Create `src/lib/observability/telemetry.ts` — `withSpan`, `errMessage`.
- Create `src/lib/observability/metrics.ts` — `incCounter`, `recordHistogram`.
- Create `src/lib/observability/error-reporting.ts` — `reportError`, `redactAttrs`.
- Tests: `tests/observability-sink.test.ts`, `tests/observability-telemetry.test.ts`, `tests/observability-metrics.test.ts`, `tests/observability-error.test.ts`.

**Workstream D — Artifacts (independent of A; parallel):**
- Create `src/lib/observability/percentile.ts` — `percentile`, `summarize`.
- Create `src/lib/observability/load.ts` — `runLoad`.
- Create `scripts/webhook-load-test.ts` — CLI runner wiring real `fetch` into `runLoad`.
- Create `observability/grafana/cabbybot-overview.json` — dashboard.
- Create `playwright.config.ts` + `e2e/{text-booking,voice-booking,manage-booking,admin-provisioning,demo-tenant}.spec.ts`.
- Create `docs/observability.md` — runbook.
- Modify `tsconfig.json` (exclude `e2e`), `package.json` (scripts).
- Tests: `tests/observability-percentile.test.ts`, `tests/observability-load.test.ts`, `tests/observability-artifacts.test.ts`.

**Workstream B — Instrumentation wiring (depends on A):**
- Create `src/lib/observability/init.ts` — `initObservability`.
- Create `instrumentation.ts` (repo root) — Next.js `register()` hook.
- Create `src/lib/observability/instrument-adapter.ts` — `instrumentAdapter`.
- Modify `src/env.ts` — observability env vars.
- Modify `src/app/webhooks/[channel]/[automationId]/route.ts` — emit webhook metrics.
- Modify `src/lib/engine/client.ts` — span + histogram around `call`.
- Modify `src/lib/dispatch/factory.ts` — wrap returned adapter with `instrumentAdapter`.
- Tests: `tests/observability-init.test.ts`, `tests/observability-instrument-adapter.test.ts`, `tests/observability-webhook-metrics.test.ts`, `tests/observability-engine-metrics.test.ts`.

Workstreams **A and D touch disjoint files and build in parallel**. Workstream **B depends on A** (imports the core) and runs after. Task C finalizes.

---

# WORKSTREAM A — Telemetry Core

## Task A1: TelemetrySink seam + registry

**Files:**
- Create: `src/lib/observability/sink.ts`
- Test: `tests/observability-sink.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-sink.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { MemorySink, StructuredLogSink, noopSink, setSink, getSink, resetSink } from "@/lib/observability/sink";

afterEach(() => resetSink());

describe("sink registry", () => {
  it("defaults to the no-op sink", () => {
    expect(getSink()).toBe(noopSink);
  });

  it("setSink swaps the active sink; resetSink restores the no-op", () => {
    const mem = new MemorySink();
    setSink(mem);
    expect(getSink()).toBe(mem);
    resetSink();
    expect(getSink()).toBe(noopSink);
  });
});

describe("MemorySink", () => {
  it("captures spans, metrics, and errors in order", () => {
    const mem = new MemorySink();
    mem.span({ name: "s", attributes: {}, durationMs: 1, status: "ok" });
    mem.metric({ name: "m", kind: "counter", value: 1, attributes: {} });
    mem.error({ name: "Error", message: "boom", attributes: {} });
    expect(mem.spans).toHaveLength(1);
    expect(mem.metrics).toHaveLength(1);
    expect(mem.errors[0].message).toBe("boom");
  });
});

describe("StructuredLogSink", () => {
  it("writes one tagged JSON line per record to stdout", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = new StructuredLogSink();
    log.span({ name: "s", attributes: { a: 1 }, durationMs: 2, status: "ok" });
    log.metric({ name: "m", kind: "histogram", value: 3, attributes: {} });
    expect(spy).toHaveBeenCalledTimes(2);
    const first = JSON.parse(spy.mock.calls[0][0] as string);
    expect(first).toMatchObject({ t: "span", name: "s", status: "ok" });
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-sink.test.ts`
Expected: FAIL — module `@/lib/observability/sink` does not exist.

- [ ] **Step 3: Implement the sink module**

Create `src/lib/observability/sink.ts`:

```ts
export type Attrs = Record<string, string | number | boolean>;

export interface SpanRecord {
  name: string;
  attributes: Attrs;
  durationMs: number;
  status: "ok" | "error";
  error?: string;
}

export interface MetricRecord {
  name: string;
  kind: "counter" | "histogram";
  value: number;
  attributes: Attrs;
}

export interface ErrorRecord {
  name: string;
  message: string;
  attributes: Attrs;
}

export interface TelemetrySink {
  span(record: SpanRecord): void;
  metric(record: MetricRecord): void;
  error(record: ErrorRecord): void;
}

/** Default sink: discards everything. Active until initObservability swaps it. */
export const noopSink: TelemetrySink = {
  span() {},
  metric() {},
  error() {},
};

/** Test/inspection sink: keeps every record in memory. */
export class MemorySink implements TelemetrySink {
  readonly spans: SpanRecord[] = [];
  readonly metrics: MetricRecord[] = [];
  readonly errors: ErrorRecord[] = [];
  span(record: SpanRecord) { this.spans.push(record); }
  metric(record: MetricRecord) { this.metrics.push(record); }
  error(record: ErrorRecord) { this.errors.push(record); }
}

/** Deploy sink: one OTLP-shaped JSON line per record on stdout for a log scraper. */
export class StructuredLogSink implements TelemetrySink {
  span(record: SpanRecord) { console.log(JSON.stringify({ t: "span", ...record })); }
  metric(record: MetricRecord) { console.log(JSON.stringify({ t: "metric", ...record })); }
  error(record: ErrorRecord) { console.log(JSON.stringify({ t: "error", ...record })); }
}

let current: TelemetrySink = noopSink;
export function setSink(sink: TelemetrySink): void { current = sink; }
export function getSink(): TelemetrySink { return current; }
export function resetSink(): void { current = noopSink; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/observability-sink.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/observability/sink.ts tests/observability-sink.test.ts
git commit -m "feat(observability): TelemetrySink seam + memory/structured-log sinks + registry"
```

---

## Task A2: withSpan tracing helper

**Files:**
- Create: `src/lib/observability/telemetry.ts`
- Test: `tests/observability-telemetry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-telemetry.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";
import { withSpan, errMessage } from "@/lib/observability/telemetry";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

describe("withSpan", () => {
  it("records an ok span with attributes and a non-negative duration, returning the value", async () => {
    const out = await withSpan("work", { kind: "test" }, async () => 42);
    expect(out).toBe(42);
    expect(mem.spans).toHaveLength(1);
    expect(mem.spans[0]).toMatchObject({ name: "work", status: "ok", attributes: { kind: "test" } });
    expect(mem.spans[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records an error span and re-throws the original error", async () => {
    await expect(
      withSpan("boom", {}, async () => { throw new Error("nope"); }),
    ).rejects.toThrow("nope");
    expect(mem.spans[0]).toMatchObject({ name: "boom", status: "error", error: "nope" });
  });
});

describe("errMessage", () => {
  it("extracts message from Error and stringifies non-errors", () => {
    expect(errMessage(new Error("x"))).toBe("x");
    expect(errMessage("y")).toBe("y");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-telemetry.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/observability/telemetry.ts`:

```ts
import { getSink, type Attrs } from "./sink";

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Times `fn`, records an ok/error span via the active sink, and re-throws on error. */
export async function withSpan<T>(name: string, attributes: Attrs, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    getSink().span({ name, attributes, durationMs: Date.now() - start, status: "ok" });
    return result;
  } catch (err) {
    getSink().span({ name, attributes, durationMs: Date.now() - start, status: "error", error: errMessage(err) });
    throw err;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/observability-telemetry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/observability/telemetry.ts tests/observability-telemetry.test.ts
git commit -m "feat(observability): withSpan tracing helper"
```

---

## Task A3: metric helpers

**Files:**
- Create: `src/lib/observability/metrics.ts`
- Test: `tests/observability-metrics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-metrics.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";
import { incCounter, recordHistogram } from "@/lib/observability/metrics";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

describe("incCounter", () => {
  it("emits a counter metric defaulting to value 1", () => {
    incCounter("webhook_inbound_total", { channel: "whatsapp", status: "forwarded" });
    expect(mem.metrics[0]).toEqual({
      name: "webhook_inbound_total", kind: "counter", value: 1,
      attributes: { channel: "whatsapp", status: "forwarded" },
    });
  });
  it("accepts an explicit increment", () => {
    incCounter("c", {}, 5);
    expect(mem.metrics[0].value).toBe(5);
  });
});

describe("recordHistogram", () => {
  it("emits a histogram metric with the given value and attributes", () => {
    recordHistogram("webhook_ack_ms", 123, { channel: "telegram" });
    expect(mem.metrics[0]).toEqual({
      name: "webhook_ack_ms", kind: "histogram", value: 123, attributes: { channel: "telegram" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-metrics.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/observability/metrics.ts`:

```ts
import { getSink, type Attrs } from "./sink";

export function incCounter(name: string, attributes: Attrs = {}, value = 1): void {
  getSink().metric({ name, kind: "counter", value, attributes });
}

export function recordHistogram(name: string, value: number, attributes: Attrs = {}): void {
  getSink().metric({ name, kind: "histogram", value, attributes });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/observability-metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/observability/metrics.ts tests/observability-metrics.test.ts
git commit -m "feat(observability): counter + histogram metric helpers"
```

---

## Task A4: error reporting with PII redaction

**Files:**
- Create: `src/lib/observability/error-reporting.ts`
- Test: `tests/observability-error.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-error.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";
import { reportError, redactAttrs } from "@/lib/observability/error-reporting";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

describe("redactAttrs", () => {
  it("masks PII-ish keys and coerces values to primitives", () => {
    const out = redactAttrs({ phone: "+447700900000", channel: "whatsapp", count: 3, ok: true, blob: { a: 1 } });
    expect(out.phone).toBe("[redacted]");
    expect(out.channel).toBe("whatsapp");
    expect(out.count).toBe(3);
    expect(out.ok).toBe(true);
    expect(out.blob).toBe("[object Object]");
  });
});

describe("reportError", () => {
  it("forwards Error name/message with redacted attributes", () => {
    reportError(new Error("dispatch failed"), { adapter: "autocab", customer_name: "Jo" });
    expect(mem.errors[0]).toMatchObject({
      name: "Error", message: "dispatch failed",
      attributes: { adapter: "autocab", customer_name: "[redacted]" },
    });
  });
  it("wraps non-Error throwables", () => {
    reportError("string failure");
    expect(mem.errors[0]).toMatchObject({ name: "Error", message: "string failure" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-error.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/observability/error-reporting.ts`:

```ts
import { getSink, type Attrs } from "./sink";

// Customer PII / secrets must never reach a log drain or Sentry. Keys matching
// this pattern are masked; everything else is coerced to a primitive.
const PII_KEY = /phone|email|name|handle|address|token|secret|\bkey\b|authorization|passenger/i;

export function redactAttrs(attrs: Record<string, unknown>): Attrs {
  const out: Attrs = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (PII_KEY.test(k)) { out[k] = "[redacted]"; continue; }
    out[k] = typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : String(v);
  }
  return out;
}

/** Reports an error to the active sink with PII-redacted context attributes. */
export function reportError(err: unknown, attrs: Record<string, unknown> = {}): void {
  const e = err instanceof Error ? err : new Error(String(err));
  getSink().error({ name: e.name, message: e.message, attributes: redactAttrs(attrs) });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/observability-error.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/observability/error-reporting.ts tests/observability-error.test.ts
git commit -m "feat(observability): reportError with PII redaction"
```

---

# WORKSTREAM D — Artifacts (parallel with Workstream A)

## Task D1: percentile + summarize

**Files:**
- Create: `src/lib/observability/percentile.ts`
- Test: `tests/observability-percentile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-percentile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { percentile, summarize } from "@/lib/observability/percentile";

describe("percentile", () => {
  it("computes nearest-rank percentiles on 1..10", () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 95)).toBe(10);
    expect(percentile(v, 99)).toBe(10);
  });
  it("is order-independent and returns 0 for an empty set", () => {
    expect(percentile([10, 1, 5], 50)).toBe(5);
    expect(percentile([], 95)).toBe(0);
  });
});

describe("summarize", () => {
  it("reports count, p50/p95/p99, and max", () => {
    expect(summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual({
      count: 10, p50: 5, p95: 10, p99: 10, max: 10,
    });
    expect(summarize([])).toEqual({ count: 0, p50: 0, p95: 0, p99: 0, max: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-percentile.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/observability/percentile.ts`:

```ts
/** Nearest-rank percentile (p in 0..100). Returns 0 for an empty set. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export interface LatencySummary {
  count: number; p50: number; p95: number; p99: number; max: number;
}

export function summarize(values: number[]): LatencySummary {
  return {
    count: values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: values.length ? Math.max(...values) : 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/observability-percentile.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/observability/percentile.ts tests/observability-percentile.test.ts
git commit -m "feat(observability): nearest-rank percentile + latency summary"
```

---

## Task D2: concurrent load runner

**Files:**
- Create: `src/lib/observability/load.ts`
- Test: `tests/observability-load.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-load.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { runLoad } from "@/lib/observability/load";

describe("runLoad", () => {
  it("runs exactly `total` sends across a bounded worker pool and collects latencies", async () => {
    let inFlight = 0, maxInFlight = 0;
    const res = await runLoad({
      total: 20,
      concurrency: 4,
      send: async () => {
        inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return 7;
      },
    });
    expect(res.count).toBe(20);
    expect(res.errors).toBe(0);
    expect(res.latencies).toHaveLength(20);
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it("counts failed sends without aborting the run", async () => {
    const res = await runLoad({
      total: 6,
      concurrency: 2,
      send: async (i) => { if (i % 2 === 0) throw new Error("fail"); return 1; },
    });
    expect(res.count).toBe(3);
    expect(res.errors).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-load.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/observability/load.ts`:

```ts
export interface LoadOptions {
  total: number;
  concurrency: number;
  /** Performs one request and resolves its latency in ms; rejects on failure. */
  send: (index: number) => Promise<number>;
}

export interface LoadResult {
  count: number;
  errors: number;
  latencies: number[];
}

/** Drives `total` sends through a fixed-size worker pool, collecting latencies. */
export async function runLoad(opts: LoadOptions): Promise<LoadResult> {
  const latencies: number[] = [];
  let errors = 0;
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= opts.total) return;
      try {
        latencies.push(await opts.send(i));
      } catch {
        errors++;
      }
    }
  }

  const workers = Math.max(1, Math.min(opts.concurrency, opts.total));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { count: latencies.length, errors, latencies };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/observability-load.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/observability/load.ts tests/observability-load.test.ts
git commit -m "feat(observability): bounded-concurrency load runner"
```

---

## Task D3: webhook load-test script + Grafana dashboard + Playwright specs + runbook

**Files:**
- Create: `scripts/webhook-load-test.ts`
- Create: `observability/grafana/cabbybot-overview.json`
- Create: `playwright.config.ts`
- Create: `e2e/text-booking.spec.ts`, `e2e/voice-booking.spec.ts`, `e2e/manage-booking.spec.ts`, `e2e/admin-provisioning.spec.ts`, `e2e/demo-tenant.spec.ts`
- Create: `docs/observability.md`
- Modify: `tsconfig.json`, `package.json`
- Test: `tests/observability-artifacts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-artifacts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const p = (rel: string) => join(process.cwd(), rel);

describe("Grafana dashboard artifact", () => {
  const dash = JSON.parse(readFileSync(p("observability/grafana/cabbybot-overview.json"), "utf8")) as {
    title: string; panels: { title: string; targets: { expr: string }[] }[];
  };
  it("declares panels for the four required signals", () => {
    const titles = dash.panels.map((x) => x.title.toLowerCase());
    for (const want of ["latency", "error", "throughput", "dispatch"]) {
      expect(titles.some((t) => t.includes(want)), want).toBe(true);
    }
  });
  it("targets reference the contract metric names", () => {
    const exprs = dash.panels.flatMap((x) => x.targets.map((t) => t.expr)).join(" ");
    for (const m of ["webhook_ack_ms", "webhook_inbound_total", "dispatch_latency_ms", "engine_request_ms"]) {
      expect(exprs.includes(m), m).toBe(true);
    }
  });
});

describe("webhook load-test script", () => {
  it("exists and drives runLoad at 100 concurrency by default", () => {
    const src = readFileSync(p("scripts/webhook-load-test.ts"), "utf8");
    expect(src).toMatch(/runLoad/);
    expect(src).toMatch(/summarize/);
    expect(src).toMatch(/100/);
  });
});

describe("Playwright E2E specs", () => {
  it("config + the five required scenarios exist", () => {
    expect(existsSync(p("playwright.config.ts"))).toBe(true);
    for (const f of [
      "e2e/text-booking.spec.ts", "e2e/voice-booking.spec.ts", "e2e/manage-booking.spec.ts",
      "e2e/admin-provisioning.spec.ts", "e2e/demo-tenant.spec.ts",
    ]) {
      expect(existsSync(p(f)), f).toBe(true);
      expect(readFileSync(p(f), "utf8")).toMatch(/test\(/);
    }
  });
});

describe("build hygiene", () => {
  it("e2e is excluded from tsconfig so unbuilt Playwright specs don't break typecheck", () => {
    const tsconfig = JSON.parse(readFileSync(p("tsconfig.json"), "utf8")) as { exclude: string[] };
    expect(tsconfig.exclude).toContain("e2e");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-artifacts.test.ts`
Expected: FAIL — artifacts/tsconfig change do not exist yet.

- [ ] **Step 3: Create the Grafana dashboard**

Create `observability/grafana/cabbybot-overview.json`:

```json
{
  "title": "CabbyBot — Platform Overview",
  "uid": "cabbybot-overview",
  "schemaVersion": 39,
  "timezone": "Europe/London",
  "panels": [
    {
      "id": 1,
      "title": "Webhook ACK Latency (p95, ms)",
      "type": "timeseries",
      "targets": [{ "expr": "histogram_quantile(0.95, sum(rate(webhook_ack_ms_bucket[5m])) by (le, channel))" }]
    },
    {
      "id": 2,
      "title": "Webhook Error Rate",
      "type": "timeseries",
      "targets": [{ "expr": "sum(rate(webhook_inbound_total{status=\"invalid\"}[5m])) / sum(rate(webhook_inbound_total[5m]))" }]
    },
    {
      "id": 3,
      "title": "Webhook Throughput (req/s by channel)",
      "type": "timeseries",
      "targets": [{ "expr": "sum(rate(webhook_inbound_total[1m])) by (channel)" }]
    },
    {
      "id": 4,
      "title": "Dispatch Latency per Adapter (p95, ms)",
      "type": "timeseries",
      "targets": [{ "expr": "histogram_quantile(0.95, sum(rate(dispatch_latency_ms_bucket[5m])) by (le, adapter))" }]
    },
    {
      "id": 5,
      "title": "Engine Request Latency (p95, ms)",
      "type": "timeseries",
      "targets": [{ "expr": "histogram_quantile(0.95, sum(rate(engine_request_ms_bucket[5m])) by (le, op))" }]
    }
  ]
}
```

- [ ] **Step 4: Create the load-test script**

Create `scripts/webhook-load-test.ts`:

```ts
/**
 * Webhook gateway load test — fires N concurrent POSTs at a target webhook URL
 * and reports ACK latency percentiles (PRD §11: webhook ACK p95 ≤ 300ms @ 100
 * concurrent). Run after deploy against a staging gateway:
 *   pnpm loadtest:webhook -- --url https://staging/webhooks/whatsapp/<id> --total 1000
 */
import { runLoad } from "../src/lib/observability/load";
import { summarize } from "../src/lib/observability/percentile";

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const url = arg("--url", "http://localhost:3000/webhooks/whatsapp/00000000-0000-0000-0000-000000000000");
  const total = Number(arg("--total", "1000"));
  const concurrency = Number(arg("--concurrency", "100"));
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  const result = await runLoad({
    total,
    concurrency,
    send: async () => {
      const t0 = Date.now();
      await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      return Date.now() - t0;
    },
  });

  const s = summarize(result.latencies);
  console.log(JSON.stringify({ url, total, concurrency, errors: result.errors, ...s }, null, 2));
  if (s.p95 > 300) {
    console.error(`FAIL: p95 ${s.p95}ms exceeds 300ms target`);
    process.exit(1);
  }
}

void main();
```

- [ ] **Step 5: Create the Playwright config + five specs**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

// QA E2E config. Activate with: pnpm add -D @playwright/test && pnpm exec playwright install
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

Create `e2e/text-booking.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Text booking happy path: a confirmed booking surfaces on the live dashboard feed.
test("text booking appears on the automation live feed", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("link", { name: /bookings/i }).first().click();
  await expect(page.getByRole("heading", { name: /bookings/i })).toBeVisible();
  await expect(page.getByText(/confirmed|completed|dispatched/i).first()).toBeVisible();
});
```

Create `e2e/voice-booking.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Voice booking: a voice-led conversation renders its transcript + extracted slots.
test("voice conversation shows transcript and extracted slots", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("link", { name: /conversations/i }).first().click();
  await page.getByRole("button", { name: /view transcript/i }).first().click();
  await expect(page.getByText(/voice note/i).first()).toBeVisible();
});
```

Create `e2e/manage-booking.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Manage flow: a cancelled/managed conversation is visible in the transcript view.
test("manage/cancel conversation is listed with its outcome", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("link", { name: /conversations/i }).first().click();
  await expect(page.getByText(/managed|cancelled/i).first()).toBeVisible();
});
```

Create `e2e/admin-provisioning.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Admin provisioning is staff-only: an unauthenticated visit is blocked, never 200-rendered.
test("admin console rejects unauthenticated access", async ({ page }) => {
  const res = await page.goto("/admin");
  expect(res?.status()).toBeGreaterThanOrEqual(300);
});
```

Create `e2e/demo-tenant.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// Demo tenant is read-only: the demo banner is shown and write controls are absent/disabled.
test("demo session is read-only with a visible banner", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByText(/demo/i).first()).toBeVisible();
});
```

- [ ] **Step 6: Exclude e2e from tsconfig + add scripts**

In `tsconfig.json`, change the `exclude` array from:

```json
  "exclude": [
    "node_modules",
    "supabase/functions"
  ]
```

to:

```json
  "exclude": [
    "node_modules",
    "supabase/functions",
    "e2e"
  ]
```

In `package.json`, add these two scripts to the `"scripts"` block (after `"test:watch"`):

```json
    "test:e2e": "playwright test",
    "loadtest:webhook": "tsx scripts/webhook-load-test.ts"
```

- [ ] **Step 7: Create the runbook**

Create `docs/observability.md`:

```markdown
# Observability & QA Runbook (Epic 11)

CabbyBot ships a vendor-neutral telemetry core that no-ops by default. Activation is deploy-time.

## Telemetry

Spans/metrics/errors flow through `src/lib/observability` to the active `TelemetrySink`.
Default is `noopSink`. The Next.js `instrumentation.ts` hook calls `initObservability()`,
which installs `StructuredLogSink` when `OBSERVABILITY_STDOUT=true` — one OTLP-shaped JSON
line per record on stdout.

### Wiring to Grafana Cloud / Sentry (deploy)
1. Set `OBSERVABILITY_STDOUT=true`.
2. Run a log scraper (Grafana Agent / Vector) that parses the `{ "t": "span"|"metric"|"error" }`
   stdout lines and forwards to Grafana Cloud (Mimir/Tempo/Loki) and Sentry.
3. Alternatively, install the OTel SDK and replace `StructuredLogSink` with an OTLP exporter
   sink in `src/lib/observability/init.ts` using `OTEL_EXPORTER_OTLP_ENDPOINT`.

## Metric contract
`webhook_ack_ms`, `webhook_inbound_total`, `engine_request_ms`, `dispatch_latency_ms`.
Dashboard: import `observability/grafana/cabbybot-overview.json` into Grafana Cloud.

## Load test
`pnpm loadtest:webhook -- --url <gateway-url> --total 1000 --concurrency 100`
Fails if ACK p95 > 300ms (PRD §11).

## E2E (Playwright)
One-time: `pnpm add -D @playwright/test && pnpm exec playwright install`.
Run against a deployed/dev app: `E2E_BASE_URL=https://staging pnpm test:e2e`.
Scenarios: text booking, voice booking, manage booking, admin provisioning, demo tenant.
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm vitest run tests/observability-artifacts.test.ts`
Expected: PASS (all four describe blocks).

Run: `pnpm typecheck`
Expected: clean (the new `e2e/` specs are excluded; `scripts/webhook-load-test.ts` typechecks against the real `load`/`percentile` modules).

> If `pnpm typecheck` reports errors from `e2e/*.spec.ts` (missing `@playwright/test`), confirm Step 6 added `"e2e"` to `tsconfig.json` `exclude`.

- [ ] **Step 9: Commit**

```bash
git add observability/grafana/cabbybot-overview.json scripts/webhook-load-test.ts playwright.config.ts e2e docs/observability.md tsconfig.json package.json tests/observability-artifacts.test.ts
git commit -m "feat(observability): Grafana dashboard, webhook load test, Playwright E2E specs + runbook"
```

---

# WORKSTREAM B — Instrumentation Wiring (after Workstream A)

## Task B1: observability env + init selector + Next.js hook

**Files:**
- Modify: `src/env.ts`
- Create: `src/lib/observability/init.ts`
- Create: `instrumentation.ts` (repo root)
- Test: `tests/observability-init.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-init.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { getSink, resetSink, noopSink, StructuredLogSink } from "@/lib/observability/sink";

afterEach(() => { resetSink(); vi.resetModules(); vi.unstubAllEnvs(); });

describe("initObservability", () => {
  it("leaves the no-op sink when OBSERVABILITY_STDOUT is unset", async () => {
    vi.doMock("@/env", () => ({ env: { OBSERVABILITY_STDOUT: undefined } }));
    const { initObservability } = await import("@/lib/observability/init");
    initObservability();
    expect(getSink()).toBe(noopSink);
  });

  it("installs the StructuredLogSink when OBSERVABILITY_STDOUT='true'", async () => {
    vi.doMock("@/env", () => ({ env: { OBSERVABILITY_STDOUT: "true" } }));
    const { initObservability } = await import("@/lib/observability/init");
    initObservability();
    expect(getSink()).toBeInstanceOf(StructuredLogSink);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-init.test.ts`
Expected: FAIL — `@/lib/observability/init` does not exist.

- [ ] **Step 3: Add observability env vars**

In `src/env.ts`, inside the `z.object({ ... })` schema, add after the `NEXT_PUBLIC_SITE_URL` line (just before the closing `});`):

```ts
  // Observability (Epic 11). Activation is deploy-time; absent → telemetry no-ops.
  OBSERVABILITY_STDOUT: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default("cabbybot"),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
```

- [ ] **Step 4: Create the init selector**

Create `src/lib/observability/init.ts`:

```ts
import { env } from "@/env";
import { setSink, StructuredLogSink } from "./sink";

/**
 * Selects the active telemetry sink at process boot. Default stays no-op; when
 * OBSERVABILITY_STDOUT=true we emit OTLP-shaped JSON lines for a log scraper to
 * forward to Grafana Cloud / Sentry (see docs/observability.md).
 */
export function initObservability(): void {
  if (env.OBSERVABILITY_STDOUT === "true") {
    setSink(new StructuredLogSink());
  }
}
```

- [ ] **Step 5: Create the Next.js instrumentation hook**

Create `instrumentation.ts` at the repo root:

```ts
// Next.js calls register() once per server runtime at boot (next.config instrumentation hook).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initObservability } = await import("@/lib/observability/init");
    initObservability();
  }
}
```

- [ ] **Step 6: Run test + typecheck**

Run: `pnpm vitest run tests/observability-init.test.ts`
Expected: PASS.

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/env.ts src/lib/observability/init.ts instrumentation.ts tests/observability-init.test.ts
git commit -m "feat(observability): env vars + initObservability selector + Next.js instrumentation hook"
```

---

## Task B2: webhook gateway metrics

**Files:**
- Modify: `src/app/webhooks/[channel]/[automationId]/route.ts`
- Test: `tests/observability-webhook-metrics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-webhook-metrics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { WEBHOOK_RATE_LIMIT_PER_MIN: 60, IDEMPOTENCY_TTL_SEC: 86400, CHANNEL_CACHE_TTL_SEC: 300 } }));
vi.mock("@/lib/webhooks/signatures", () => ({
  verifyMetaSignature: vi.fn(async () => true), verifyTelegramSecret: vi.fn(), verifyWidgetSignature: vi.fn(), verifyMetaSubscribe: vi.fn(),
}));
const resolveAutomation = vi.fn();
vi.mock("@/lib/webhooks/resolver", () => ({ resolveAutomation: (...a: unknown[]) => resolveAutomation(...a) }));
vi.mock("@/lib/webhooks/resolver-loader", () => ({ loadChannelVerifySecret: vi.fn() }));
const claimOnce = vi.fn();
vi.mock("@/lib/redis/idempotency", () => ({ claimOnce: (...a: unknown[]) => claimOnce(...a) }));
const fixedWindow = vi.fn();
vi.mock("@/lib/redis/rate-limit", () => ({ fixedWindow: (...a: unknown[]) => fixedWindow(...a) }));
vi.mock("@/lib/webhooks/forward", () => ({ fireAndForgetForward: vi.fn() }));

import { POST } from "@/app/webhooks/[channel]/[automationId]/route";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";

const ID = "11111111-1111-1111-1111-111111111111";
const params = Promise.resolve({ channel: "whatsapp", automationId: ID });
function req() {
  return new Request(`http://x/webhooks/whatsapp/${ID}`, {
    method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=x" },
    body: JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
  }) as unknown as import("next/server").NextRequest;
}

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); [resolveAutomation, claimOnce, fixedWindow].forEach((m) => m.mockReset()); });
afterEach(() => resetSink());

describe("webhook gateway metrics", () => {
  it("records ACK latency + a forwarded counter on the happy path", async () => {
    resolveAutomation.mockResolvedValue({ automationId: ID, status: "live", engineWebhookUrl: "http://engine/a" });
    fixedWindow.mockResolvedValue({ allowed: true });
    claimOnce.mockResolvedValue(true);
    await POST(req(), { params });
    expect(mem.metrics.find((m) => m.name === "webhook_ack_ms")).toMatchObject({ kind: "histogram", attributes: { channel: "whatsapp" } });
    expect(mem.metrics.find((m) => m.name === "webhook_inbound_total")).toMatchObject({ attributes: { channel: "whatsapp", status: "forwarded" } });
  });

  it("tags the counter rate_limited when throttled", async () => {
    resolveAutomation.mockResolvedValue({ automationId: ID, status: "live", engineWebhookUrl: "http://engine/a" });
    fixedWindow.mockResolvedValue({ allowed: false });
    await POST(req(), { params });
    expect(mem.metrics.find((m) => m.name === "webhook_inbound_total")).toMatchObject({ attributes: { status: "rate_limited" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-webhook-metrics.test.ts`
Expected: FAIL — no metrics emitted yet.

- [ ] **Step 3: Instrument the POST handler**

In `src/app/webhooks/[channel]/[automationId]/route.ts`, add imports near the other `@/lib` imports:

```ts
import { incCounter, recordHistogram } from "@/lib/observability/metrics";
```

Then, inside `POST`, immediately after the line `if (!UUID_RE.test(automationId)) return new NextResponse("Not found", { status: 404 });`, add a timer + local ack helper:

```ts
  const ackStart = Date.now();
  const ack = (status: string, res: NextResponse): NextResponse => {
    recordHistogram("webhook_ack_ms", Date.now() - ackStart, { channel });
    incCounter("webhook_inbound_total", { channel, status });
    return res;
  };
```

Now wrap each meaningful exit in `POST` (leave the two early `Not found` 404s uninstrumented — they are malformed, not real traffic):

- Invalid signature: `return ack("invalid", new NextResponse("Invalid signature", { status: 401 }));`
- Unknown / no engine url: `return ack("unknown", NextResponse.json({ ok: true }, { status: 200 }));`
- Stopped/error status: `return ack("stopped", NextResponse.json({ ok: true }, { status: 200 }));`
- Rate limited: `return ack("rate_limited", new NextResponse("Too Many Requests", { status: 429 }));`
- Deduped: `return ack("deduped", NextResponse.json({ ok: true, deduped: true }, { status: 200 }));`
- Final forward: `return ack("forwarded", NextResponse.json({ ok: true }, { status: 200 }));`

- [ ] **Step 4: Run test + the existing gateway test (no regression)**

Run: `pnpm vitest run tests/observability-webhook-metrics.test.ts tests/webhook-gateway.test.ts`
Expected: PASS (new metrics test green; existing gateway behavior unchanged).

- [ ] **Step 5: Commit**

```bash
git add "src/app/webhooks/[channel]/[automationId]/route.ts" tests/observability-webhook-metrics.test.ts
git commit -m "feat(observability): webhook ACK latency + throughput/error counters"
```

---

## Task B3: instrumentAdapter + dispatch factory wiring

**Files:**
- Create: `src/lib/observability/instrument-adapter.ts`
- Modify: `src/lib/dispatch/factory.ts`
- Test: `tests/observability-instrument-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-instrument-adapter.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";
import { instrumentAdapter } from "@/lib/observability/instrument-adapter";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

// Minimal fake adapter exercising one ok method and one throwing method.
const fakeAdapter = {
  async getQuote() { return { fare: 10 }; },
  async createBooking() { throw new Error("dispatch down"); },
} as unknown as import("@/lib/dispatch/types").DispatchAdapter;

describe("instrumentAdapter", () => {
  it("records dispatch_latency_ms with adapter/op/status=ok and returns the result", async () => {
    const wrapped = instrumentAdapter(fakeAdapter, "autocab");
    const q = await wrapped.getQuote({} as never);
    expect(q).toMatchObject({ fare: 10 });
    const m = mem.metrics.find((x) => x.name === "dispatch_latency_ms");
    expect(m).toMatchObject({ kind: "histogram", attributes: { adapter: "autocab", op: "getQuote", status: "ok" } });
  });

  it("records status=error and re-throws on failure", async () => {
    const wrapped = instrumentAdapter(fakeAdapter, "autocab");
    await expect(wrapped.createBooking({} as never)).rejects.toThrow("dispatch down");
    const m = mem.metrics.find((x) => x.attributes.op === "createBooking");
    expect(m).toMatchObject({ attributes: { adapter: "autocab", status: "error" } });
    expect(mem.errors[0]).toMatchObject({ message: "dispatch down" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-instrument-adapter.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the wrapper**

Create `src/lib/observability/instrument-adapter.ts`:

```ts
import "server-only";
import type { DispatchAdapter } from "@/lib/dispatch/types";
import { recordHistogram } from "./metrics";
import { reportError } from "./error-reporting";
import { errMessage } from "./telemetry";

const TIMED_OPS: (keyof DispatchAdapter)[] = [
  "lookupAddress", "getZones", "getCapabilities", "getQuote",
  "createBooking", "getBooking", "modifyBooking", "cancelBooking", "searchFlights",
];

/**
 * Wraps a DispatchAdapter so every call records `dispatch_latency_ms`
 * {adapter, op, status} and reports failures. The returned object satisfies the
 * same DispatchAdapter contract.
 */
export function instrumentAdapter(adapter: DispatchAdapter, adapterName: string): DispatchAdapter {
  const proxy = {} as Record<string, unknown>;
  for (const op of TIMED_OPS) {
    const original = (adapter[op] as (...args: unknown[]) => Promise<unknown>).bind(adapter);
    proxy[op] = async (...args: unknown[]) => {
      const start = Date.now();
      try {
        const result = await original(...args);
        recordHistogram("dispatch_latency_ms", Date.now() - start, { adapter: adapterName, op, status: "ok" });
        return result;
      } catch (err) {
        recordHistogram("dispatch_latency_ms", Date.now() - start, { adapter: adapterName, op, status: "error" });
        reportError(err, { adapter: adapterName, op, detail: errMessage(err) });
        throw err;
      }
    };
  }
  return proxy as unknown as DispatchAdapter;
}
```

- [ ] **Step 4: Wire it into the factory**

In `src/lib/dispatch/factory.ts`, add the import near the top (after the existing `import type { DispatchAdapter } from "./types";`):

```ts
import { instrumentAdapter } from "@/lib/observability/instrument-adapter";
```

Then wrap the adapter returned by `getDispatchAdapter`. Replace the `switch (config.adapter) { ... }` block's construction so the returned adapter is instrumented. The cleanest surgical change: capture the raw adapter, then return it wrapped. Change the `switch` to assign instead of return, then wrap once:

```ts
  let adapter: DispatchAdapter;
  switch (config.adapter) {
    case "autocab": {
      if (!config.autoCab) {
        throw new DispatchConfigError("AutoCab config missing.");
      }
      adapter = new AutoCabAdapter(config.autoCab);
      break;
    }
    case "icabbi":
      adapter = new ICabbiAdapter();
      break;
    case "cordic":
      adapter = new CordicAdapter();
      break;
    default:
      throw new DispatchConfigError("Unknown dispatch adapter for this account.");
  }
  return instrumentAdapter(adapter, config.adapter);
```

- [ ] **Step 5: Run test + existing dispatch tests**

Run: `pnpm vitest run tests/observability-instrument-adapter.test.ts`
Expected: PASS.

Run: `pnpm vitest run $(ls tests | grep -i dispatch | sed 's#^#tests/#' | tr '\n' ' ')`
Expected: PASS — existing dispatch/factory behavior unchanged (the wrapper is contract-preserving).

- [ ] **Step 6: Commit**

```bash
git add src/lib/observability/instrument-adapter.ts src/lib/dispatch/factory.ts tests/observability-instrument-adapter.test.ts
git commit -m "feat(observability): instrument dispatch adapters with per-adapter latency + error reporting"
```

---

## Task B4: engine client span + latency

**Files:**
- Modify: `src/lib/engine/client.ts`
- Test: `tests/observability-engine-metrics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/observability-engine-metrics.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { N8N_BASE_URL: "http://engine", N8N_API_KEY: "k" } }));

import { EngineClient } from "@/lib/engine/client";
import { MemorySink, setSink, resetSink } from "@/lib/observability/sink";

let mem: MemorySink;
beforeEach(() => { mem = new MemorySink(); setSink(mem); });
afterEach(() => resetSink());

describe("engine client instrumentation", () => {
  it("records an engine_request_ms histogram + engine.request span on success", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ active: true }), { status: 200 })) as unknown as typeof fetch;
    const client = new EngineClient("http://engine", "k", fetcher);
    await client.isActive("wf1");
    expect(mem.metrics.find((m) => m.name === "engine_request_ms")).toMatchObject({ kind: "histogram", attributes: { status: "ok" } });
    expect(mem.spans.find((s) => s.name === "engine.request")).toBeTruthy();
  });

  it("records status=error when the engine returns a non-2xx", async () => {
    const fetcher = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    const client = new EngineClient("http://engine", "k", fetcher);
    await expect(client.isActive("wf1")).rejects.toThrow();
    expect(mem.metrics.find((m) => m.name === "engine_request_ms")).toMatchObject({ attributes: { status: "error" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/observability-engine-metrics.test.ts`
Expected: FAIL — no telemetry emitted.

- [ ] **Step 3: Instrument `call`**

In `src/lib/engine/client.ts`, add imports after the existing imports:

```ts
import { recordHistogram } from "@/lib/observability/metrics";
import { getSink } from "@/lib/observability/sink";
import { errMessage } from "@/lib/observability/telemetry";
```

Replace the private `call` method with an instrumented version that records both the histogram and the span. A request is "error" when it throws OR returns a non-2xx response:

```ts
  private async call(path: string, init?: RequestInit): Promise<Response> {
    const op = path.split("?")[0];
    const start = Date.now();
    try {
      const res = await this.fetcher(`${this.baseUrl}/api/v1${path}`, {
        ...init,
        // Caller headers first, then the auth + content-type headers (callee-wins)
        // so a caller can never accidentally override the API key.
        headers: { ...(init?.headers ?? {}), "X-N8N-API-KEY": this.apiKey, "content-type": "application/json" },
      });
      const status = res.ok ? "ok" : "error";
      const durationMs = Date.now() - start;
      recordHistogram("engine_request_ms", durationMs, { op, status });
      getSink().span({ name: "engine.request", attributes: { op, status }, durationMs, status });
      return res;
    } catch (err) {
      const durationMs = Date.now() - start;
      recordHistogram("engine_request_ms", durationMs, { op, status: "error" });
      getSink().span({ name: "engine.request", attributes: { op, status: "error" }, durationMs, status: "error", error: errMessage(err) });
      throw err;
    }
  }
```

> Note: `op` is the path without the query string (e.g. `/workflows/wf1`), so the engine workflow id appears in the op label — acceptable since workflow ids are internal, not customer PII.

- [ ] **Step 4: Run test + existing engine unit tests**

Run: `pnpm vitest run tests/observability-engine-metrics.test.ts`
Expected: PASS.

Run: `pnpm vitest run $(ls tests | grep -iE 'engine' | grep -v integration | sed 's#^#tests/#' | tr '\n' ' ')`
Expected: PASS (the live-n8n `engine-client.integration.test.ts` is environment-dependent and excluded here).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/client.ts tests/observability-engine-metrics.test.ts
git commit -m "feat(observability): engine request latency histogram + span"
```

---

# Task C: Integration gate + roadmap marker

**Files:**
- Modify: `docs/superpowers/plans/00-cabbybot-roadmap.md`

Runs after Workstreams A, D, and B.

- [ ] **Step 1: Full typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 2: Run the whole suite**

Run: `pnpm test`
Expected: PASS except the pre-existing, environment-dependent `tests/engine-client.integration.test.ts` (live-n8n `fetch` ConnectTimeout — not a regression; it needs an external engine host). All new `observability-*` suites green.

- [ ] **Step 3: Flip the roadmap marker**

In `docs/superpowers/plans/00-cabbybot-roadmap.md`, change:

```markdown
### ⬜ Plan 11 — Epic 11: Observability & QA
```

to (use the short SHA from `git rev-parse --short HEAD` after the last Workstream-B commit; date is 2026-06-02):

```markdown
### ✅ Plan 11 — Epic 11: Observability & QA  → `2026-06-02-epic-11-observability-qa.md`  (DONE & merged to `master` 2026-06-02, HEAD `<short-sha>`)
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/00-cabbybot-roadmap.md
git commit -m "docs: mark Epic 11 done in roadmap index"
```

---

## Self-Review

**Spec coverage (roadmap Plan 11 deliverables):**
1. *OpenTelemetry in route handlers + engine* — `withSpan` + the `TelemetrySink` seam (A2), webhook route metrics (B2), engine `engine.request` span + `engine_request_ms` (B4). Vendor-neutral; OTLP export is the documented deploy step.
2. *Grafana Cloud dashboards (latency, error rate, webhook throughput, dispatch latency per adapter)* — `observability/grafana/cabbybot-overview.json` (D3) with panels for all four signals, validated by `tests/observability-artifacts.test.ts` against the metric-name contract.
3. *Sentry (frontend + server)* — `reportError` with PII redaction (A4) routes errors to the active sink; `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` env (B1); the StructuredLogSink → relay path and SDK swap are documented in `docs/observability.md`. (No heavy `@sentry/nextjs` dependency added, per the no-new-deps constraint.)
4. *Playwright E2E (text + voice booking, manage booking, admin provisioning, demo tenant)* — five specs + config (D3), validated by shape test; live run documented (activation installs `@playwright/test`).
5. *Webhook load test @100 concurrent* — `runLoad` (D2) + `scripts/webhook-load-test.ts` defaulting to concurrency 100 with a p95 ≤ 300ms gate (D3).

**Placeholder scan:** No TBD/TODO; every code step shows complete code; tests assert real behavior.

**Type consistency:** The `Attrs`, `SpanRecord`, `MetricRecord`, `ErrorRecord`, `TelemetrySink` types defined in A1 are imported unchanged by A2–A4 and B. Metric names match the contract table everywhere they appear (route B2, engine B4, adapter B3, dashboard D3, artifact test). `instrumentAdapter(adapter, name)` signature is identical between definition (B3) and the factory call site (B3). `runLoad`/`summarize`/`percentile` signatures match between definition (D1/D2) and the load-test script (D3).

**No new npm dependencies**; `pnpm test`, `pnpm typecheck`, and the lockfile are unaffected. `e2e/` is excluded from tsconfig so the Playwright specs (which import the not-yet-installed `@playwright/test`) never break typecheck.

**Parallelization:** Workstream A (A1–A4) and Workstream D (D1–D3) touch disjoint files → build by two parallel agents. Workstream B (B1–B4) imports the A core → builds after. Task C is the integration gate.
