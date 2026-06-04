// tests/liveops-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/liveops/service", () => ({ postStaffMessage: vi.fn(async () => ({ ok: true, relayed: true })), getThread: vi.fn(async () => []) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { postStaffMessage } from "@/lib/liveops/service";
import { POST } from "@/app/api/orgs/[orgId]/liveops/[conversationId]/messages/route";

const ctx = { params: Promise.resolve({ orgId: "t1", conversationId: "c1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }

describe("POST staff message", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts when entitled + not demo", async () => {
    const res = await POST(req({ text: "Hi, this is the dispatcher" }), ctx);
    expect(res.status).toBe(200);
    expect(postStaffMessage).toHaveBeenCalled();
  });
  it("400 when text is empty", async () => {
    const res = await POST(req({ text: "" }), ctx);
    expect(res.status).toBe(400);
    expect(postStaffMessage).not.toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req({ text: "hi" }), ctx);
    expect(res.status).toBe(403);
    expect(postStaffMessage).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req({ text: "hi" }), ctx);
    expect(res.status).toBe(403);
    expect(postStaffMessage).not.toHaveBeenCalled();
  });
  it("409 when the conversation is not in takeover", async () => {
    vi.mocked(postStaffMessage).mockResolvedValueOnce({ ok: false, relayed: false, reason: "not_in_takeover" });
    const res = await POST(req({ text: "hi" }), ctx);
    expect(res.status).toBe(409);
  });
});
