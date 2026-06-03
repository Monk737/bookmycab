// tests/entitlements-merge.test.ts
import { describe, it, expect } from "vitest";
import { mergeEntitlements, type Effective } from "@/lib/entitlements/merge";

const NOW = new Date("2026-06-03T00:00:00Z");

describe("mergeEntitlements", () => {
  it("uses the plan default when there is no override", () => {
    const eff = mergeEntitlements({
      planFeatures: [{ feature_key: "alerting", enabled: true, quota_limit: 100, quota_period: "month" }],
      overrides: [],
      rollouts: [],
      tenantId: "t1",
      now: NOW,
    });
    expect(eff.get("alerting")).toEqual<Effective>({ enabled: true, quotaLimit: 100, quotaPeriod: "month" });
  });

  it("override wins over the plan default", () => {
    const eff = mergeEntitlements({
      planFeatures: [{ feature_key: "alerting", enabled: false, quota_limit: null, quota_period: null }],
      overrides: [{ feature_key: "alerting", enabled: true, quota_limit: 500, quota_period: "month", expires_at: null }],
      rollouts: [],
      tenantId: "t1",
      now: NOW,
    });
    expect(eff.get("alerting")?.enabled).toBe(true);
    expect(eff.get("alerting")?.quotaLimit).toBe(500);
  });

  it("ignores an expired override", () => {
    const eff = mergeEntitlements({
      planFeatures: [{ feature_key: "alerting", enabled: false, quota_limit: null, quota_period: null }],
      overrides: [{ feature_key: "alerting", enabled: true, quota_limit: 500, quota_period: "month", expires_at: "2026-06-01T00:00:00Z" }],
      rollouts: [],
      tenantId: "t1",
      now: NOW,
    });
    expect(eff.get("alerting")?.enabled).toBe(false);
  });

  it("a kill-switch / off rollout forces the feature disabled regardless of plan/override", () => {
    const eff = mergeEntitlements({
      planFeatures: [{ feature_key: "ai_copilot", enabled: true, quota_limit: null, quota_period: null }],
      overrides: [{ feature_key: "ai_copilot", enabled: true, quota_limit: null, quota_period: null, expires_at: null }],
      rollouts: [{ feature_key: "ai_copilot", strategy: "off", percentage: 100, allowlist: [], kill_switch: false }],
      tenantId: "t1",
      now: NOW,
    });
    expect(eff.get("ai_copilot")?.enabled).toBe(false);
  });

  it("allowlist rollout enables only listed tenants", () => {
    const base = {
      planFeatures: [{ feature_key: "ai_copilot", enabled: true, quota_limit: null, quota_period: null }],
      overrides: [],
      rollouts: [{ feature_key: "ai_copilot", strategy: "allowlist", percentage: 100, allowlist: ["t-allowed"], kill_switch: false }],
      now: NOW,
    } as const;
    expect(mergeEntitlements({ ...base, tenantId: "t-allowed" }).get("ai_copilot")?.enabled).toBe(true);
    expect(mergeEntitlements({ ...base, tenantId: "t-other" }).get("ai_copilot")?.enabled).toBe(false);
  });
});
