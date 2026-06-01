import { describe, it, expect } from "vitest";
import {
  mintImpersonation,
  isImpersonationValid,
  IMPERSONATION_TTL_MS,
  type ImpersonationRecord,
} from "@/lib/admin/impersonation";

// Fixed reference instant so expiry math is deterministic.
const NOW = new Date("2026-06-01T12:00:00.000Z").getTime();

function mint(overrides?: { reason?: string }): ImpersonationRecord {
  return mintImpersonation({
    staffUserId: "staff-1",
    tenantId: "tenant-1",
    targetUserId: "user-1",
    reason: overrides?.reason ?? "Investigating a booking dispute",
    now: NOW,
  });
}

describe("mintImpersonation", () => {
  it("sets expiry to exactly now + 15 minutes", () => {
    const r = mint();
    expect(r.startedAt).toBe(NOW);
    expect(r.expiresAt).toBe(NOW + IMPERSONATION_TTL_MS);
    expect(IMPERSONATION_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("carries the supplied identity + reason", () => {
    const r = mint();
    expect(r.staffUserId).toBe("staff-1");
    expect(r.tenantId).toBe("tenant-1");
    expect(r.targetUserId).toBe("user-1");
    expect(r.reason).toBe("Investigating a booking dispute");
  });

  it("is always read_only mode", () => {
    expect(mint().mode).toBe("read_only");
  });

  it("trims the reason", () => {
    const r = mint({ reason: "  needs trimming  " });
    expect(r.reason).toBe("needs trimming");
  });

  it("throws on an empty reason", () => {
    expect(() => mint({ reason: "" })).toThrow();
  });

  it("throws on a whitespace-only reason", () => {
    expect(() => mint({ reason: "   \t\n " })).toThrow();
  });
});

describe("isImpersonationValid", () => {
  it("is valid strictly before expiry", () => {
    const r = mint();
    expect(isImpersonationValid(r, NOW)).toBe(true);
    expect(isImpersonationValid(r, r.expiresAt - 1)).toBe(true);
  });

  it("is invalid at the exact expiry boundary", () => {
    const r = mint();
    expect(isImpersonationValid(r, r.expiresAt)).toBe(false);
  });

  it("is invalid after expiry", () => {
    const r = mint();
    expect(isImpersonationValid(r, r.expiresAt + 1)).toBe(false);
  });
});
