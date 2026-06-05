// tests/integrations-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/integrations/service", () => ({ issueKey: vi.fn(async () => ({ raw: "cab_secret", prefix: "cab_12345678" })), listKeys: vi.fn(async () => []) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { issueKey } from "@/lib/integrations/service";
import { POST } from "@/app/api/orgs/[orgId]/integrations/keys/route";

const ctx = { params: Promise.resolve({ orgId: "t1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }

describe("POST issue api key", () => {
  beforeEach(() => vi.clearAllMocks());

  it("issues + returns the raw key once when entitled + not demo", async () => {
    const res = await POST(req({ name: "CI key" }), ctx);
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.raw).toBe("cab_secret");
    expect(issueKey).toHaveBeenCalled();
  });
  it("400 when name missing", async () => {
    const res = await POST(req({}), ctx);
    expect(res.status).toBe(400);
    expect(issueKey).not.toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req({ name: "x" }), ctx);
    expect(res.status).toBe(403);
    expect(issueKey).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req({ name: "x" }), ctx);
    expect(res.status).toBe(403);
    expect(issueKey).not.toHaveBeenCalled();
  });
});
