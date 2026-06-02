import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

const requireOrgAccess = vi.fn();
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: (...a: unknown[]) => requireOrgAccess(...(a as [])) }));
vi.mock("@/lib/auth/session", () => ({ getCurrentClaims: vi.fn(async () => ({ sub: "owner1", tenant_id: "o1", role: "Owner" })) }));
const writeAudit = vi.fn(async () => true);
// writeAudit is re-exported from @/lib/audit which delegates to @/lib/admin/audit
vi.mock("@/lib/audit", () => ({ writeAudit: (...a: unknown[]) => writeAudit(...(a as [])) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const inviteUserByEmail = vi.fn(async () => ({ data: { user: { id: "newuser1" } }, error: null }));
const tuInsert = vi.fn(async () => ({ error: null }));

// Chainable builder stub: every method returns itself so you can chain .eq().single() etc.
// Terminal operations (insert, upsert, update, delete, single, select with data) resolve.
function makeQueryBuilder(overrides: Record<string, unknown> = {}): unknown {
  const builder: Record<string, unknown> = {
    insert: (...a: unknown[]) => { tuInsert(...(a as [])); return Promise.resolve({ error: null }); },
    upsert: async () => ({ error: null }),
    // update returns a chainable so callers can .eq().eq() ... then await
    update: () => makeQueryBuilder(),
    // delete returns a chainable
    delete: () => makeQueryBuilder(),
    // select for count check in revokeMember last-owner guard
    select: () => makeQueryBuilder({ data: [], error: null }),
    eq: () => makeQueryBuilder(overrides),
    neq: () => makeQueryBuilder(overrides),
    single: async () => ({ data: null, error: null }),
    ...overrides,
  };
  // Make it thenable so `await from(...)....delete()` resolves
  Object.defineProperty(builder, "then", {
    value: (resolve: (v: unknown) => void) => resolve({ error: null }),
  });
  return builder;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { admin: { inviteUserByEmail: (...a: unknown[]) => inviteUserByEmail(...(a as [])) } },
    from: () => makeQueryBuilder(),
  }),
}));

import { inviteMember, changeRole, revokeMember } from "@/app/dashboard/team/actions";

beforeEach(() => {
  requireOrgAccess.mockReset();
  inviteUserByEmail.mockClear();
  tuInsert.mockClear();
  writeAudit.mockClear();
});

describe("inviteMember", () => {
  it("rejects a non-Owner", async () => {
    const { NextResponse } = await import("next/server");
    requireOrgAccess.mockResolvedValue(new NextResponse("Forbidden", { status: 403 }));
    const res = await inviteMember("o1", { email: "a@b.com", role: "Admin", automationRestrictions: [] });
    expect(res.ok).toBe(false);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });
  it("invites + inserts tenant_users for an Owner", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { sub: "owner1", tenant_id: "o1" } });
    const res = await inviteMember("o1", { email: "a@b.com", role: "Admin", automationRestrictions: [] });
    expect(res.ok).toBe(true);
    expect(inviteUserByEmail).toHaveBeenCalledWith("a@b.com");
    expect(tuInsert).toHaveBeenCalled();
  });
  it("rejects an invalid email", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { sub: "owner1", tenant_id: "o1" } });
    const res = await inviteMember("o1", { email: "not-an-email", role: "Admin", automationRestrictions: [] });
    expect(res.ok).toBe(false);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });
});

describe("changeRole", () => {
  it("rejects a non-Owner", async () => {
    const { NextResponse } = await import("next/server");
    requireOrgAccess.mockResolvedValue(new NextResponse("Forbidden", { status: 403 }));
    const res = await changeRole("o1", "user2", "Admin");
    expect(res.ok).toBe(false);
  });
  it("updates role for an Owner", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { sub: "owner1", tenant_id: "o1" } });
    const res = await changeRole("o1", "user2", "Admin");
    expect(res.ok).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team.role_change" }),
    );
  });
  it("rejects an invalid role", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { sub: "owner1", tenant_id: "o1" } });
    const res = await changeRole("o1", "user2", "SuperAdmin");
    expect(res.ok).toBe(false);
  });
});

describe("revokeMember", () => {
  it("rejects a non-Owner", async () => {
    const { NextResponse } = await import("next/server");
    requireOrgAccess.mockResolvedValue(new NextResponse("Forbidden", { status: 403 }));
    const res = await revokeMember("o1", "user2");
    expect(res.ok).toBe(false);
  });
  it("deletes the tenant_users row for an Owner", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { sub: "owner1", tenant_id: "o1" } });
    const res = await revokeMember("o1", "user2");
    expect(res.ok).toBe(true);
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "team.revoke" }),
    );
  });
});
