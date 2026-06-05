// tests/copilot-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireQuota: vi.fn(async () => null) }));
vi.mock("@/lib/copilot/service", () => ({ askCopilot: vi.fn(async () => ({ answer: "You took £100.", intent: "revenue" })), listHistory: vi.fn(async () => []) }));

import { requireQuota } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { askCopilot } from "@/lib/copilot/service";
import { POST } from "@/app/api/orgs/[orgId]/copilot/route";

const ctx = { params: Promise.resolve({ orgId: "t1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }

describe("POST copilot ask", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers when entitled (under quota) + not demo", async () => {
    const res = await POST(req({ question: "revenue this month?" }), ctx);
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.answer).toMatch(/£100/);
    expect(askCopilot).toHaveBeenCalledWith("t1", "u1", "revenue this month?");
  });
  it("400 when question is empty", async () => {
    const res = await POST(req({ question: "" }), ctx);
    expect(res.status).toBe(400);
    expect(askCopilot).not.toHaveBeenCalled();
  });
  it("403/429 from requireQuota short-circuits (feature off or over budget)", async () => {
    vi.mocked(requireQuota).mockResolvedValueOnce(new Response("no", { status: 429 }) as unknown as null);
    const res = await POST(req({ question: "revenue?" }), ctx);
    expect(res.status).toBe(429);
    expect(askCopilot).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req({ question: "revenue?" }), ctx);
    expect(res.status).toBe(403);
    expect(askCopilot).not.toHaveBeenCalled();
  });
});
