import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));
const getCurrentClaims = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getCurrentClaims: () => getCurrentClaims() }));

import { evaluateOrgAccess } from "@/lib/api/guard";
import type { Claims } from "@/middleware/access";

beforeEach(() => getCurrentClaims.mockReset());

const claims = (over: Partial<Claims>): Claims => ({
  sub: "u1", tenant_id: "t1", role: "Viewer", is_flowmo_staff: false, aal: "aal2", ...over,
});

describe("evaluateOrgAccess", () => {
  it("401 when unauthenticated", () => {
    expect(evaluateOrgAccess(null, "t1", { minRole: "Viewer" }).kind).toBe("unauthorized");
  });
  it("403 when tenant mismatch and not staff", () => {
    expect(evaluateOrgAccess(claims({ tenant_id: "t2" }), "t1", { minRole: "Viewer" }).kind).toBe("forbidden");
  });
  it("allows staff across tenants", () => {
    expect(evaluateOrgAccess(claims({ is_flowmo_staff: true, tenant_id: null }), "t1", { minRole: "Owner" }).kind).toBe("allow");
  });
  it("403 when role below minRole (Viewer cannot do Owner/Admin action)", () => {
    expect(evaluateOrgAccess(claims({ role: "Viewer" }), "t1", { minRole: "Admin" }).kind).toBe("forbidden");
  });
  it("allows Owner for an Admin-min action", () => {
    expect(evaluateOrgAccess(claims({ role: "Owner" }), "t1", { minRole: "Admin" }).kind).toBe("allow");
  });
});
