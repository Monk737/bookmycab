// tests/entitlements-catalog.test.ts
import { describe, it, expect } from "vitest";
import { FEATURE_KEYS, FEATURE_CATALOG, type FeatureKey } from "@/lib/entitlements/catalog";

describe("feature catalog", () => {
  it("every key has a catalog entry whose key matches", () => {
    for (const k of FEATURE_KEYS) {
      expect(FEATURE_CATALOG[k]).toBeDefined();
      expect(FEATURE_CATALOG[k].key).toBe(k);
    }
  });

  it("metered features declare a unit", () => {
    for (const k of FEATURE_KEYS) {
      const f = FEATURE_CATALOG[k];
      if (f.metered) expect(typeof f.unit).toBe("string");
    }
  });

  it("includes the foundational gateable features", () => {
    const keys = FEATURE_KEYS as readonly string[];
    expect(keys).toContain("alerting");
    expect(keys).toContain("ai_copilot");
    expect(keys).toContain("live_takeover");
  });
});
