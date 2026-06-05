// tests/invoicing-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/invoicing/service", () => ({ generateInvoice: vi.fn(async () => ({ id: "inv1", total: 100 })) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { generateInvoice } from "@/lib/invoicing/service";
import { POST } from "@/app/api/orgs/[orgId]/invoicing/generate/route";

const ctx = { params: Promise.resolve({ orgId: "t1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }
const body = { accountId: "a1", periodStart: "2026-05-01", periodEnd: "2026-05-31" };

describe("POST generate invoice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates when entitled + not demo", async () => {
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(200);
    expect(generateInvoice).toHaveBeenCalledWith("t1", "a1", "2026-05-01", "2026-05-31");
  });
  it("400 when fields missing", async () => {
    const res = await POST(req({ accountId: "a1" }), ctx);
    expect(res.status).toBe(400);
    expect(generateInvoice).not.toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(403);
    expect(generateInvoice).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(403);
    expect(generateInvoice).not.toHaveBeenCalled();
  });
  it("422 when no bookings in the period", async () => {
    vi.mocked(generateInvoice).mockResolvedValueOnce({ id: null, total: 0 });
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(422);
  });
});
