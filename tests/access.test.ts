import { describe, it, expect } from "vitest";
import { evaluateAccess, type Claims } from "@/middleware/access";

const tenantClaims: Claims = { sub: "u1", tenant_id: "org-1", role: "Owner", is_flowmo_staff: false };
const staffClaims: Claims = { sub: "s1", tenant_id: null, role: null, is_flowmo_staff: true };

describe("evaluateAccess", () => {
  it("allows public paths without auth", () => {
    expect(evaluateAccess("/", null).kind).toBe("allow");
    expect(evaluateAccess("/pricing", null).kind).toBe("allow");
    expect(evaluateAccess("/login", null).kind).toBe("allow");
    expect(evaluateAccess("/webhooks/whatsapp/abc", null).kind).toBe("allow");
  });

  it("redirects unauthenticated users away from protected paths", () => {
    const r = evaluateAccess("/dashboard", null);
    expect(r).toEqual({ kind: "redirect", to: "/login" });
  });

  it("lets an authed tenant user into their dashboard", () => {
    expect(evaluateAccess("/dashboard", tenantClaims).kind).toBe("allow");
  });

  it("blocks /admin for non-staff", () => {
    expect(evaluateAccess("/admin", tenantClaims)).toEqual({ kind: "redirect", to: "/dashboard" });
  });

  it("allows /admin for FlowMo staff", () => {
    expect(evaluateAccess("/admin/tenants", staffClaims).kind).toBe("allow");
  });

  it("forbids API access to another tenant's org id", () => {
    expect(evaluateAccess("/api/orgs/org-2/automations", tenantClaims)).toEqual({ kind: "forbidden" });
  });

  it("allows API access to the user's own org id", () => {
    expect(evaluateAccess("/api/orgs/org-1/automations", tenantClaims).kind).toBe("allow");
  });
});
