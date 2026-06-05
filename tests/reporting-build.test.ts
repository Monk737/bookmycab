// tests/reporting-build.test.ts
import { describe, it, expect } from "vitest";
import { buildReport, resolveBranding, REPORT_METRICS } from "@/lib/reporting/build";

describe("buildReport", () => {
  it("emits one section per known metric key in order", () => {
    const r = buildReport(["revenue", "response_time"], { revenue: { total: 1234.5, completed: 40 }, response_time: { p50Sec: 3, p95Sec: 9 } });
    expect(r.sections).toHaveLength(2);
    expect(r.sections[0].key).toBe("revenue");
    expect(r.sections[1].key).toBe("response_time");
  });
  it("skips unknown metric keys", () => {
    const r = buildReport(["revenue", "bogus"], { revenue: { total: 1, completed: 1 } });
    expect(r.sections).toHaveLength(1);
  });
  it("renders the metric's label + values", () => {
    const r = buildReport(["revenue"], { revenue: { total: 100, completed: 5 } });
    expect(r.sections[0].title).toBe(REPORT_METRICS.revenue.label);
    expect(r.sections[0].rows.length).toBeGreaterThan(0);
  });
  it("includes generatedAt + title", () => {
    const r = buildReport(["revenue"], { revenue: { total: 1, completed: 1 } }, "Weekly summary");
    expect(r.title).toBe("Weekly summary");
    expect(typeof r.generatedAt).toBe("string");
  });
});

describe("resolveBranding", () => {
  it("falls back to platform defaults when branding is empty", () => {
    const b = resolveBranding({});
    expect(b.primary).toBe("#1E40AF");
    expect(b.logoUrl).toBeNull();
  });
  it("tenant values override defaults", () => {
    const b = resolveBranding({ primary: "#FF0000", logoUrl: "https://x/logo.png" });
    expect(b.primary).toBe("#FF0000");
    expect(b.logoUrl).toBe("https://x/logo.png");
  });
});
