// tests/config-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/config/versions", () => ({ publishVersion: vi.fn(async () => ({ ok: true })) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { publishVersion } from "@/lib/config/versions";
import { POST } from "@/app/api/orgs/[orgId]/automations/[automationId]/config/versions/[versionId]/route";

const ctx = { params: Promise.resolve({ orgId: "t1", automationId: "a1", versionId: "v1" }) };
function req() { return new Request("http://x", { method: "POST" }); }

describe("POST publish version", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes when entitled + not demo", async () => {
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(publishVersion).toHaveBeenCalled();
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(publishVersion).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(publishVersion).not.toHaveBeenCalled();
  });
  it("returns 422 with violations when publish is blocked by guardrails", async () => {
    vi.mocked(publishVersion).mockResolvedValueOnce({ ok: false, violations: [{ field: "service_area", reason: "locked" }] });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(422);
  });
});
