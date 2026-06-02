import { describe, it, expect } from "vitest";
import { unixToIso, addMonthsUTC } from "@/lib/billing/dates";

describe("unixToIso", () => {
  it("converts unix seconds to an ISO string", () => {
    expect(unixToIso(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(unixToIso(1_700_000_000)).toBe("2023-11-14T22:13:20.000Z");
  });
  it("returns null for null/undefined", () => {
    expect(unixToIso(null)).toBeNull();
    expect(unixToIso(undefined)).toBeNull();
  });
});

describe("addMonthsUTC", () => {
  it("adds whole months and returns a date-only string", () => {
    expect(addMonthsUTC("2026-06-02", 12)).toBe("2027-06-02");
    expect(addMonthsUTC("2026-01-15", 1)).toBe("2026-02-15");
  });
  it("clamps to the last day when the target month is shorter", () => {
    expect(addMonthsUTC("2026-01-31", 1)).toBe("2026-02-28");
  });
});
