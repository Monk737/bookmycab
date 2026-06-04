// tests/convintel-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/convintel/service", () => ({ flagForReview: vi.fn(async () => {}) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { flagForReview } from "@/lib/convintel/service";
import { POST } from "@/app/api/orgs/[orgId]/intel/[conversationId]/flag/route";

const ctx = { params: Promise.resolve({ orgId: "t1", conversationId: "c1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }

describe("POST flag conversation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("flags when entitled + not demo", async () => {
    const res = await POST(req({ flagged: true }), ctx);
    expect(res.status).toBe(200);
    expect(flagForReview).toHaveBeenCalledWith("t1", "c1", true);
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req({ flagged: true }), ctx);
    expect(res.status).toBe(403);
    expect(flagForReview).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req({ flagged: true }), ctx);
    expect(res.status).toBe(403);
    expect(flagForReview).not.toHaveBeenCalled();
  });
});
