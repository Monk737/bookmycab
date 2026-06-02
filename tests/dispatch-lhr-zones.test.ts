import { describe, it, expect } from "vitest";
import { lhrZoneForTerminal } from "@/lib/dispatch/lhr-zones";

describe("lhrZoneForTerminal", () => {
  it("maps terminals 1/2/3 to LHR T123", () => {
    for (const t of ["1", "2", "3", "T1", "T2", "T3", "t3", "Terminal 2"]) {
      expect(lhrZoneForTerminal(t)).toBe("LHR T123");
    }
  });
  it("maps terminal 4 to LHR T4", () => {
    expect(lhrZoneForTerminal("4")).toBe("LHR T4");
    expect(lhrZoneForTerminal("T4")).toBe("LHR T4");
    expect(lhrZoneForTerminal("Terminal 4")).toBe("LHR T4");
  });
  it("maps terminal 5 to LHR T5", () => {
    expect(lhrZoneForTerminal("5")).toBe("LHR T5");
    expect(lhrZoneForTerminal("T5")).toBe("LHR T5");
  });
  it("returns null for unknown / empty terminals", () => {
    expect(lhrZoneForTerminal("6")).toBeNull();
    expect(lhrZoneForTerminal("")).toBeNull();
    expect(lhrZoneForTerminal("North")).toBeNull();
  });
});
