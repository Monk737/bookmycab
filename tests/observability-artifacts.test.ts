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
