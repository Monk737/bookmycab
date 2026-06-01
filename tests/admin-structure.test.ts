import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { evaluateAccess, PUBLIC_PAGES, type Claims } from "../src/middleware/access";

// Resolve project root from this test file (tests/ -> ..).
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ADMIN_DIR = join(ROOT, "src/app/admin");

const staffClaims: Claims = {
  sub: "s1",
  tenant_id: null,
  role: "Owner",
  is_flowmo_staff: true,
  aal: "aal2",
};

const nonStaffClaims: Claims = {
  sub: "u1",
  tenant_id: "org-1",
  role: "Owner",
  is_flowmo_staff: false,
  aal: "aal2",
};

describe("admin site structure", () => {
  it("exposes no /admin path as a public page", () => {
    const offenders = [...PUBLIC_PAGES].filter((p) => p === "/admin" || p.startsWith("/admin/"));
    expect(offenders).toEqual([]);
  });

  it("allows aal2 FlowMo staff onto /admin", () => {
    expect(evaluateAccess("/admin", staffClaims)).toEqual({ kind: "allow" });
  });

  it("redirects a non-staff aal2 Owner from /admin to /dashboard", () => {
    expect(evaluateAccess("/admin", nonStaffClaims)).toEqual({
      kind: "redirect",
      to: "/dashboard",
    });
  });

  it("ships an admin layout and overview page", () => {
    expect(existsSync(join(ADMIN_DIR, "layout.tsx"))).toBe(true);
    expect(existsSync(join(ADMIN_DIR, "page.tsx"))).toBe(true);
  });
});
