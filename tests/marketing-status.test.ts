import { describe, it, expect } from "vitest";
import {
  STATUS_COMPONENTS, PERF_TARGETS, overallStatus, STATUS_LABEL,
  type StatusComponent,
} from "@/lib/marketing/status";

describe("overallStatus", () => {
  const ok: StatusComponent = { name: "x", description: "d", status: "operational" };
  it("is operational when every component is operational", () => {
    expect(overallStatus([ok, ok])).toBe("operational");
  });
  it("is the worst status present", () => {
    expect(overallStatus([ok, { ...ok, status: "degraded" }])).toBe("degraded");
    expect(overallStatus([{ ...ok, status: "degraded" }, { ...ok, status: "outage" }])).toBe("outage");
  });
  it("defaults to operational for an empty catalogue", () => {
    expect(overallStatus([])).toBe("operational");
  });
});

describe("status catalogue", () => {
  it("ships a non-empty service catalogue and perf targets", () => {
    expect(STATUS_COMPONENTS.length).toBeGreaterThan(0);
    expect(PERF_TARGETS.length).toBeGreaterThan(0);
  });
  it("labels every status value", () => {
    expect(STATUS_LABEL.operational).toMatch(/operational/i);
    expect(STATUS_LABEL.degraded).toBeTruthy();
    expect(STATUS_LABEL.outage).toBeTruthy();
  });
  it("uses brand-safe component names (no forbidden engine vocabulary)", () => {
    const blob = JSON.stringify(STATUS_COMPONENTS).toLowerCase();
    for (const banned of ["n8n", "workflow", "execution", "cablab"]) {
      expect(blob.includes(banned), banned).toBe(false);
    }
  });
});
