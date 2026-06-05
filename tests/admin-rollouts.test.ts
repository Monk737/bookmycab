import { describe, it, expect } from "vitest";
import { validateRollout } from "@/lib/admin/rollouts";

describe("validateRollout", () => {
  it("accepts a valid percentage rollout", () => {
    expect(validateRollout({ strategy: "percentage", percentage: 25, killSwitch: false })).toEqual({ ok: true });
  });
  it("accepts all/off/allowlist strategies", () => {
    for (const strategy of ["all", "off", "allowlist"] as const) {
      expect(validateRollout({ strategy, percentage: 100, killSwitch: false }).ok).toBe(true);
    }
  });
  it("rejects an unknown strategy", () => {
    expect(validateRollout({ strategy: "sideways" as never, percentage: 100, killSwitch: false }).ok).toBe(false);
  });
  it("rejects a percentage outside 0–100", () => {
    expect(validateRollout({ strategy: "percentage", percentage: 150, killSwitch: false }).ok).toBe(false);
    expect(validateRollout({ strategy: "percentage", percentage: -1, killSwitch: false }).ok).toBe(false);
  });
});
