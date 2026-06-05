// tests/channels-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/channels/service", () => ({ requestChannel: vi.fn(async () => ({ ok: true, id: "c1" })) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { requestChannel } from "@/lib/channels/service";
import { POST } from "@/app/api/orgs/[orgId]/channels/request/route";

const ctx = { params: Promise.resolve({ orgId: "t1" }) };
function req(body: unknown) { return new Request("http://x", { method: "POST", body: JSON.stringify(body) }); }
const body = { type: "whatsapp", externalId: "+44 7700 900000", automationId: "a1" };

describe("POST request channel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requests when entitled + not demo", async () => {
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(200);
    expect(requestChannel).toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(403);
    expect(requestChannel).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(403);
    expect(requestChannel).not.toHaveBeenCalled();
  });
  it("422 with field errors when invalid", async () => {
    vi.mocked(requestChannel).mockResolvedValueOnce({ ok: false, errors: ["type"] });
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(422);
  });
});
