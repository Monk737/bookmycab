import { describe, it, expect } from "vitest";
import { evaluateAccess, type Claims } from "@/middleware/access";

const tenantClaims: Claims = { sub: "u1", tenant_id: "org-1", role: "Owner", is_flowmo_staff: false, aal: "aal2" };
const staffClaims: Claims = { sub: "s1", tenant_id: null, role: null, is_flowmo_staff: true, aal: "aal2" };

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

  // MFA gate tests
  it("redirects Owner at aal1 to /mfa when visiting /dashboard", () => {
    const claims: Claims = { sub: "u1", tenant_id: "org-1", role: "Owner", is_flowmo_staff: false, aal: "aal1" };
    expect(evaluateAccess("/dashboard", claims)).toEqual({ kind: "redirect", to: "/mfa" });
  });

  it("redirects Admin at aal1 to /mfa when visiting /dashboard", () => {
    const claims: Claims = { sub: "u2", tenant_id: "org-1", role: "Admin", is_flowmo_staff: false, aal: "aal1" };
    expect(evaluateAccess("/dashboard", claims)).toEqual({ kind: "redirect", to: "/mfa" });
  });

  it("allows Viewer at aal1 to /dashboard (MFA optional for Viewer)", () => {
    const claims: Claims = { sub: "u3", tenant_id: "org-1", role: "Viewer", is_flowmo_staff: false, aal: "aal1" };
    expect(evaluateAccess("/dashboard", claims)).toEqual({ kind: "allow" });
  });

  it("allows Owner at aal2 to /dashboard", () => {
    const claims: Claims = { sub: "u1", tenant_id: "org-1", role: "Owner", is_flowmo_staff: false, aal: "aal2" };
    expect(evaluateAccess("/dashboard", claims)).toEqual({ kind: "allow" });
  });

  it("allows Owner at aal1 to reach the /mfa page itself", () => {
    const claims: Claims = { sub: "u1", tenant_id: "org-1", role: "Owner", is_flowmo_staff: false, aal: "aal1" };
    expect(evaluateAccess("/mfa", claims)).toEqual({ kind: "allow" });
  });

  it("allows Owner at aal1 to reach auth-flow pages (no redirect loop)", () => {
    const claims: Claims = { sub: "u1", tenant_id: "org-1", role: "Owner", is_flowmo_staff: false, aal: "aal1" };
    expect(evaluateAccess("/login", claims)).toEqual({ kind: "allow" });
    expect(evaluateAccess("/accept-invite", claims)).toEqual({ kind: "allow" });
    expect(evaluateAccess("/forgot-password", claims)).toEqual({ kind: "allow" });
    expect(evaluateAccess("/reset-password", claims)).toEqual({ kind: "allow" });
  });

  it("redirects is_flowmo_staff Owner at aal1 to /mfa when visiting /admin (MFA gate before staff allow)", () => {
    const claims: Claims = { sub: "s1", tenant_id: null, role: "Owner", is_flowmo_staff: true, aal: "aal1" };
    expect(evaluateAccess("/admin", claims)).toEqual({ kind: "redirect", to: "/mfa" });
  });
});
