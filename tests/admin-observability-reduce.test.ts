// tests/admin-observability-reduce.test.ts
import { describe, it, expect } from "vitest";
import { reduceUsage, reducePlatformHealth, type UsageCounterRow } from "@/lib/admin/observability/reduce";

const tenants = new Map([["t1", "Premier Cabs"], ["t2", "City Cars"]]);

describe("reduceUsage", () => {
  const counters: UsageCounterRow[] = [
    { tenant_id: "t1", feature_key: "alerting", used: 120, limit_amount: 2000 },
    { tenant_id: "t1", feature_key: "ai_copilot", used: 3400, limit_amount: null },
    { tenant_id: "t2", feature_key: "alerting", used: 50, limit_amount: 200 },
  ];
  it("groups usage rows by tenant with the tenant name", () => {
    const rows = reduceUsage(counters, tenants);
    const t1 = rows.find((r) => r.tenantId === "t1")!;
    expect(t1.tenantName).toBe("Premier Cabs");
    expect(t1.features).toHaveLength(2);
  });
  it("computes a utilisation % when a limit is set, null when unlimited", () => {
    const t1 = reduceUsage(counters, tenants).find((r) => r.tenantId === "t1")!;
    const alerting = t1.features.find((f) => f.featureKey === "alerting")!;
    expect(alerting.utilisationPct).toBe(6); // 120/2000
    const copilot = t1.features.find((f) => f.featureKey === "ai_copilot")!;
    expect(copilot.utilisationPct).toBeNull();
  });
  it("flags tenants over 80% of any quota", () => {
    const overCounters: UsageCounterRow[] = [{ tenant_id: "t2", feature_key: "alerting", used: 190, limit_amount: 200 }];
    expect(reduceUsage(overCounters, tenants)[0].nearLimit).toBe(true);
  });
});

describe("reducePlatformHealth", () => {
  it("computes automation success rate", () => {
    const h = reducePlatformHealth({
      runs: [{ status: "success" }, { status: "success" }, { status: "error" }, { status: "running" }],
      dispatch: [],
      notifications: [],
    });
    expect(h.automations.total).toBe(4);
    expect(h.automations.successRate).toBe(50); // 2 success of 4
  });
  it("computes dispatch success rate per adapter", () => {
    const h = reducePlatformHealth({
      runs: [],
      dispatch: [{ adapter: "autocab", status: "success" }, { adapter: "autocab", status: "failed" }],
      notifications: [],
    });
    expect(h.dispatch.find((d) => d.adapter === "autocab")!.successRate).toBe(50);
  });
  it("computes notification deliverability", () => {
    const h = reducePlatformHealth({
      runs: [],
      dispatch: [],
      notifications: [{ status: "sent" }, { status: "sent" }, { status: "failed" }],
    });
    expect(h.notifications.total).toBe(3);
    expect(h.notifications.deliveredRate).toBeCloseTo(66.7, 1);
  });
});
