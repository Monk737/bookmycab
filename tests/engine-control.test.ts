import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

const activate = vi.fn(), deactivate = vi.fn(), isActive = vi.fn(), listRuns = vi.fn();
vi.mock("@/lib/engine/client", () => ({
  EngineClient: { fromEnv: () => ({ activate, deactivate, isActive, listRuns }) },
}));
const writeAudit = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => writeAudit(...a) }));
const updateStatus = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/engine/control-db", () => ({
  setAutomationStatus: (...a: unknown[]) => updateStatus(...a),
  getEngineWorkflowId: vi.fn().mockResolvedValue("wf1"),
}));

import { startAutomation, stopAutomation, getStatus } from "@/lib/engine/control";
import { neutralRunStatus } from "@/lib/engine/types";

beforeEach(() => [activate, deactivate, isActive, listRuns, writeAudit, updateStatus].forEach((m) => m.mockClear()));

describe("control layer", () => {
  it("startAutomation activates, sets live, audits", async () => {
    await startAutomation({ automationId: "a1", tenantId: "t1", actorUserId: "u1" });
    expect(activate).toHaveBeenCalledWith("wf1");
    expect(updateStatus).toHaveBeenCalledWith("a1", "live");
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "automation.start", targetId: "a1" }));
  });
  it("stopAutomation deactivates, sets stopped, audits", async () => {
    await stopAutomation({ automationId: "a1", tenantId: "t1", actorUserId: "u1" });
    expect(deactivate).toHaveBeenCalledWith("wf1");
    expect(updateStatus).toHaveBeenCalledWith("a1", "stopped");
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "automation.stop" }));
  });
  it("getStatus maps engine active→live", async () => {
    isActive.mockResolvedValue(true);
    expect(await getStatus({ automationId: "a1" })).toMatchObject({ status: "live" });
  });
});

describe("neutralRunStatus", () => {
  it("maps success→completed", () => expect(neutralRunStatus("success")).toBe("completed"));
  it("maps error→failed", () => expect(neutralRunStatus("error")).toBe("failed"));
  it("maps crashed→failed", () => expect(neutralRunStatus("crashed")).toBe("failed"));
  it("maps running→running", () => expect(neutralRunStatus("running")).toBe("running"));
  it("maps waiting→pending", () => expect(neutralRunStatus("waiting")).toBe("pending"));
  it("maps canceled/cancelled→cancelled", () => {
    expect(neutralRunStatus("canceled")).toBe("cancelled");
    expect(neutralRunStatus("cancelled")).toBe("cancelled");
  });
  it("maps null→unknown", () => expect(neutralRunStatus(null)).toBe("unknown"));
  it("maps an unrecognised status→unknown", () => expect(neutralRunStatus("weird")).toBe("unknown"));
});
