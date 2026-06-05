// tests/reporting-routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const claims = { sub: "u1", tenant_id: "t1", role: "Admin", is_flowmo_staff: false, is_demo: false, aal: "aal2", automation_restrictions: [] };
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: vi.fn(async () => ({ claims })) }));
vi.mock("@/lib/demo/session", () => ({ blockIfDemo: vi.fn(() => null) }));
vi.mock("@/lib/entitlements/guard", () => ({ requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/reporting/service", () => ({ runReport: vi.fn(async () => ({ ok: true, report: { title: "r", generatedAt: "x", sections: [] } })), deleteDefinition: vi.fn(async () => {}) }));

import { requireFeature } from "@/lib/entitlements/guard";
import { blockIfDemo } from "@/lib/demo/session";
import { runReport } from "@/lib/reporting/service";
import { POST } from "@/app/api/orgs/[orgId]/reports/[reportId]/route";

const ctx = { params: Promise.resolve({ orgId: "t1", reportId: "r1" }) };
function req() { return new Request("http://x", { method: "POST" }); }

describe("POST run report", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs when entitled + not demo", async () => {
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(runReport).toHaveBeenCalledWith("t1", "r1");
  });
  it("403 when not entitled", async () => {
    vi.mocked(requireFeature).mockResolvedValueOnce(new Response("no", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(runReport).not.toHaveBeenCalled();
  });
  it("403 for demo", async () => {
    vi.mocked(blockIfDemo).mockReturnValueOnce(new Response("demo", { status: 403 }) as unknown as null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(runReport).not.toHaveBeenCalled();
  });
  it("404 when the report is missing", async () => {
    vi.mocked(runReport).mockResolvedValueOnce({ ok: false });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
  });
});
