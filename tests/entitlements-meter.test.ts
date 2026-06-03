// tests/entitlements-meter.test.ts
import { describe, it, expect } from "vitest";
import { withinQuota, periodBounds } from "@/lib/entitlements/meter";

describe("withinQuota", () => {
  it("allows when under an explicit limit", () => {
    expect(withinQuota(5, 10)).toBe(true);
  });
  it("blocks when at or over the limit", () => {
    expect(withinQuota(10, 10)).toBe(false);
    expect(withinQuota(11, 10)).toBe(false);
  });
  it("always allows when the limit is null (unlimited)", () => {
    expect(withinQuota(9_999_999, null)).toBe(true);
  });
});

describe("periodBounds", () => {
  it("month period spans the calendar month", () => {
    const { start, end } = periodBounds("month", new Date("2026-06-15T12:00:00Z"));
    expect(start).toBe("2026-06-01");
    expect(end).toBe("2026-06-30");
  });
  it("day period is a single day", () => {
    const { start, end } = periodBounds("day", new Date("2026-06-15T12:00:00Z"));
    expect(start).toBe("2026-06-15");
    expect(end).toBe("2026-06-15");
  });
});
