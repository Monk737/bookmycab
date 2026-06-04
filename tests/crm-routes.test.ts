// tests/crm-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/crm/queries", () => ({ setCustomerFlags: vi.fn(async () => {}), getCustomer: vi.fn(async () => ({ id: "c1" })), getCustomerBookings: vi.fn(async () => []), listNotes: vi.fn(async () => []) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { setCustomerFlags } from "@/lib/crm/queries";
import { PATCH } from "@/app/api/orgs/[orgId]/customers/[customerId]/route";

function req(body: unknown) { return new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }); }
const ctx = { params: Promise.resolve({ orgId: "t1", customerId: "c1" }) };

describe("PATCH /customers/[id] flags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets flags when entitled + not demo", async () => {
    const res = await PATCH(req({ vip: true }), ctx);
    expect(res.status).toBe(200);
    expect(setCustomerFlags).toHaveBeenCalledWith("t1", "c1", { vip: true, blocked: undefined });
  });

  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await PATCH(req({ vip: true }), ctx);
    expect(res.status).toBe(403);
    expect(setCustomerFlags).not.toHaveBeenCalled();
  });

  it("403 for demo sessions", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await PATCH(req({ vip: true }), ctx);
    expect(res.status).toBe(403);
    expect(setCustomerFlags).not.toHaveBeenCalled();
  });
});
