// tests/demo-rls.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getCurrentClaims: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/api/guard", () => ({
  requireOrgAccess: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { admin: { inviteUserByEmail: vi.fn() } },
    from: vi.fn(),
  })),
}));

import { getCurrentClaims } from "@/lib/auth/session";
import { requireOrgAccess } from "@/lib/api/guard";
import { inviteMember } from "@/app/dashboard/team/actions";

const demoOwnerClaims = {
  sub: "demo-user",
  tenant_id: "demo-tenant",
  role: "Owner" as const,
  is_flowmo_staff: false,
  is_demo: true,
  aal: "aal2" as const,
  automation_restrictions: [],
};

describe("demo write block — team actions", () => {
  beforeEach(() => {
    vi.mocked(getCurrentClaims).mockResolvedValue(demoOwnerClaims);
    vi.mocked(requireOrgAccess).mockResolvedValue({ claims: demoOwnerClaims });
  });

  it("inviteMember returns error for demo session", async () => {
    const result = await inviteMember("demo-tenant", {
      email: "test@example.com",
      role: "Viewer",
      automationRestrictions: [],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Read-only in demo mode.");
  });
});
