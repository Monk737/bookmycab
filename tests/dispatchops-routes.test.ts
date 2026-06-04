// tests/dispatchops-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/dispatchops/service", () => ({ retryDispatch: vi.fn(async () => ({ ok: true })) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { retryDispatch } from "@/lib/dispatchops/service";
import { POST } from "@/app/api/orgs/[orgId]/dispatch/failures/[bookingId]/retry/route";

const ctx = { params: Promise.resolve({ orgId: "t1", bookingId: "b1" }) };
function req() { return new Request("http://x", { method: "POST" }); }

describe("POST retry dispatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retries when entitled + not demo", async () => {
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(retryDispatch).toHaveBeenCalledWith("t1", "b1");
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(retryDispatch).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(retryDispatch).not.toHaveBeenCalled();
  });
  it("502 when retry fails", async () => {
    vi.mocked(retryDispatch).mockResolvedValueOnce({ ok: false, error: "adapter down" });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(502);
  });
});
