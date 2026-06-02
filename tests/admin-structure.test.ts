import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { evaluateAccess, PUBLIC_PAGES, type Claims } from "../src/middleware/access";
import { mintImpersonation } from "../src/lib/admin/impersonation";

// Resolve project root from this test file (tests/ -> ..).
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ADMIN_DIR = join(ROOT, "src/app/admin");

const staffClaims: Claims = {
  sub: "s1",
  tenant_id: null,
  role: "Owner",
  is_flowmo_staff: true,
  is_demo: false,
  aal: "aal2",
  automation_restrictions: [],
};

const nonStaffClaims: Claims = {
  sub: "u1",
  tenant_id: "org-1",
  role: "Owner",
  is_flowmo_staff: false,
  is_demo: false,
  aal: "aal2",
  automation_restrictions: [],
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

  it("ships every admin route page file", () => {
    const pages = [
      "page.tsx", // /admin
      "tenants/page.tsx",
      "tenants/new/page.tsx",
      "tenants/[tenantId]/page.tsx",
      "automations/page.tsx",
      "build-queue/page.tsx",
      "credentials/page.tsx",
      "billing/page.tsx",
      "impersonate/page.tsx",
    ];
    for (const p of pages) {
      expect(existsSync(join(ADMIN_DIR, p)), p).toBe(true);
    }
  });
});

describe("impersonation guard", () => {
  it("the pure mint rejects an empty reason", () => {
    expect(() =>
      mintImpersonation({
        staffUserId: "s1",
        tenantId: "t1",
        targetUserId: "u1",
        reason: "",
        now: Date.now(),
      }),
    ).toThrow();
  });

  it("the start action zod-validates a non-empty reason before minting", () => {
    // The start action lives in src/app/admin/impersonate/actions.ts and cannot
    // be imported here (it is "use server" + server-only, and transitively loads
    // requireStaff/@/env which throw without runtime env). So this is a
    // deliberate SOURCE-TEXT check, not a behavioural import — do not "fix" it by
    // importing the action. Assert the route-level guard EXISTS by checking the
    // source enforces a min(1) reason rule.
    const src = readFileSync(
      join(ADMIN_DIR, "impersonate/actions.ts"),
      "utf8",
    );
    expect(src).toMatch(/reason:\s*z\.string\(\)[^\n]*\.min\(1/);
    expect(src).toContain('action: "impersonate.start"');
  });
});
