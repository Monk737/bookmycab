// tests/alerting-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/alerting/queries", () => ({ createRule: vi.fn(async () => {}), listRules: vi.fn(async () => []) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { createRule } from "@/lib/alerting/queries";
import { POST } from "@/app/api/orgs/[orgId]/alerts/rules/route";

function req(body: unknown) {
  return new Request("http://x", { method: "POST", body: JSON.stringify(body) });
}
const ctx = { params: Promise.resolve({ orgId: "t1" }) };

describe("POST /alerts/rules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a rule when entitled and not demo", async () => {
    const res = await POST(req({ name: "x", metric: "abandonment_rate", operator: "gt", threshold: 15 }), ctx);
    expect(res.status).toBe(200);
    expect(createRule).toHaveBeenCalled();
  });

  it("returns the entitlement 403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "no" }), { status: 403 }) as unknown as null,
    );
    const res = await POST(req({ name: "x", metric: "abandonment_rate", operator: "gt", threshold: 15 }), ctx);
    expect(res.status).toBe(403);
    expect(createRule).not.toHaveBeenCalled();
  });

  it("returns the demo 403 for demo sessions", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req({ name: "x", metric: "abandonment_rate", operator: "gt", threshold: 15 }), ctx);
    expect(res.status).toBe(403);
    expect(createRule).not.toHaveBeenCalled();
  });
});
