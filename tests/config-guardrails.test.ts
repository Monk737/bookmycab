// tests/config-guardrails.test.ts
import { describe, it, expect } from "vitest";
import { validateConfig, type Guardrail } from "@/lib/config/guardrails";

const guards: Guardrail[] = [
  { field: "service_area", locked: true, min_value: null, max_value: null },
  { field: "min_fare", locked: false, min_value: 5, max_value: 20 },
];

describe("validateConfig", () => {
  it("passes when nothing violates guardrails", () => {
    const r = validateConfig({ min_fare: 10 }, guards, { service_area: "London" }, { service_area: "London" });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
  it("flags a change to a locked field", () => {
    const r = validateConfig({}, guards, { service_area: "Manchester" }, { service_area: "London" });
    expect(r.ok).toBe(false);
    expect(r.violations).toContainEqual({ field: "service_area", reason: "locked" });
  });
  it("allows a locked field if unchanged", () => {
    const r = validateConfig({}, guards, { service_area: "London" }, { service_area: "London" });
    expect(r.ok).toBe(true);
  });
  it("flags a numeric value below min or above max", () => {
    expect(validateConfig({ min_fare: 2 }, guards, {}, {}).violations).toContainEqual({ field: "min_fare", reason: "below_min" });
    expect(validateConfig({ min_fare: 25 }, guards, {}, {}).violations).toContainEqual({ field: "min_fare", reason: "above_max" });
  });
});
