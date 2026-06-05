// tests/channels-provision.test.ts
import { describe, it, expect } from "vitest";
import { validateChannelRequest, nextProvisioningState, type ProvisioningStatus } from "@/lib/channels/provision";

describe("validateChannelRequest", () => {
  it("accepts a valid whatsapp request", () => {
    const r = validateChannelRequest({ type: "whatsapp", externalId: "+44 7700 900000", automationId: "a1" });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it("rejects an unknown channel type", () => {
    const r = validateChannelRequest({ type: "carrier-pigeon", externalId: "x", automationId: "a1" });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("type");
  });
  it("requires externalId and automationId", () => {
    const r = validateChannelRequest({ type: "telegram", externalId: "", automationId: "" });
    expect(r.errors).toContain("externalId");
    expect(r.errors).toContain("automationId");
  });
});

describe("nextProvisioningState", () => {
  it("approve moves pending_review → approved", () => {
    expect(nextProvisioningState("pending_review", "approve")).toBe("approved");
  });
  it("reject moves pending_review → rejected", () => {
    expect(nextProvisioningState("pending_review", "reject")).toBe("rejected");
  });
  it("is a no-op for already-decided channels", () => {
    const states: ProvisioningStatus[] = ["approved", "rejected"];
    for (const s of states) {
      expect(nextProvisioningState(s, "approve")).toBe(s);
      expect(nextProvisioningState(s, "reject")).toBe(s);
    }
  });
});
