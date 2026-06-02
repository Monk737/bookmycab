import { describe, it, expect, vi } from "vitest";

// Mock Supabase server client and env so the module load doesn't throw in unit tests.
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { redirectTargetFor } from "@/lib/auth/session";
import type { Claims } from "@/middleware/access";

const staffClaims: Claims = {
  sub: "s1",
  tenant_id: null,
  role: "Owner",
  is_flowmo_staff: true,
  is_demo: false,
  aal: "aal2",
  automation_restrictions: [],
};

const ownerClaims: Claims = {
  sub: "u1",
  tenant_id: "org-1",
  role: "Owner",
  is_flowmo_staff: false,
  is_demo: false,
  aal: "aal2",
  automation_restrictions: [],
};

const viewerClaims: Claims = {
  sub: "u2",
  tenant_id: "org-1",
  role: "Viewer",
  is_flowmo_staff: false,
  is_demo: false,
  aal: "aal1",
  automation_restrictions: [],
};

describe("redirectTargetFor", () => {
  it("returns /admin for FlowMo staff", () => {
    expect(redirectTargetFor(staffClaims)).toBe("/admin");
  });

  it("returns /dashboard for a regular Owner", () => {
    expect(redirectTargetFor(ownerClaims)).toBe("/dashboard");
  });

  it("returns /dashboard for a Viewer", () => {
    expect(redirectTargetFor(viewerClaims)).toBe("/dashboard");
  });

  it("returns /admin only when is_flowmo_staff is true, regardless of role", () => {
    const staffViewer: Claims = { ...viewerClaims, is_flowmo_staff: true };
    expect(redirectTargetFor(staffViewer)).toBe("/admin");
  });
});
