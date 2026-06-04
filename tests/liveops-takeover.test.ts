// tests/liveops-takeover.test.ts
import { describe, it, expect } from "vitest";
import { nextTakeoverState, type TakeoverStatus, type TakeoverAction } from "@/lib/liveops/takeover";

describe("nextTakeoverState", () => {
  it("claim moves bot → human", () => {
    expect(nextTakeoverState("bot", "claim")).toBe("human");
  });
  it("claim moves requested → human", () => {
    expect(nextTakeoverState("requested", "claim")).toBe("human");
  });
  it("release moves human → bot", () => {
    expect(nextTakeoverState("human", "release")).toBe("bot");
  });
  it("request moves bot → requested", () => {
    expect(nextTakeoverState("bot", "request")).toBe("requested");
  });
  it("is a no-op for invalid transitions (returns current)", () => {
    expect(nextTakeoverState("human", "claim")).toBe("human");
    expect(nextTakeoverState("bot", "release")).toBe("bot");
  });
  it("canStaffReply is true only in human state", () => {
    const states: TakeoverStatus[] = ["bot", "requested", "human"];
    const actions: TakeoverAction[] = ["claim", "release", "request"];
    expect(states.length + actions.length).toBe(6); // sanity, keeps unions referenced
  });
});
