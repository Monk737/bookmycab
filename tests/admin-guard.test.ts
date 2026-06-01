import { describe, it, expect, vi } from "vitest";

// guard.ts imports getCurrentClaims, which transitively loads the Supabase
// server client + env validation. Mock the session + next/navigation modules
// so this pure-logic suite loads without runtime env. (Mirrors auth-session.test.ts.)
// `server-only` throws outside Next.js' react-server condition (e.g. Vitest),
// so stub it to a no-op to let the module load under the test runner.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getCurrentClaims: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { staffAccessDecision } from "@/lib/admin/guard";
import type { Claims } from "@/middleware/access";

const staffClaims: Claims = {
  sub: "s1",
  tenant_id: null,
  role: "Owner",
  is_flowmo_staff: true,
  aal: "aal2",
};

const nonStaffOwner: Claims = {
  sub: "u1",
  tenant_id: "org-1",
  role: "Owner",
  is_flowmo_staff: false,
  aal: "aal2",
};

describe("staffAccessDecision", () => {
  it("redirects to /login when there are no claims", () => {
    expect(staffAccessDecision(null)).toEqual({ kind: "redirect", to: "/login" });
  });

  it("redirects a non-staff user to /dashboard", () => {
    expect(staffAccessDecision(nonStaffOwner)).toEqual({
      kind: "redirect",
      to: "/dashboard",
    });
  });

  it("allows FlowMo staff", () => {
    expect(staffAccessDecision(staffClaims)).toEqual({ kind: "allow" });
  });

  it("allows staff regardless of role", () => {
    const staffViewer: Claims = { ...staffClaims, role: "Viewer" };
    expect(staffAccessDecision(staffViewer)).toEqual({ kind: "allow" });
  });
});
