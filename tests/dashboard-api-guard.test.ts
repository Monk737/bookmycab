import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

const requireOrgAccess = vi.fn();
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: (...a: unknown[]) => requireOrgAccess(...a) }));
const getAutomationCards = vi.fn();
vi.mock("@/lib/dashboard/queries", () => ({
  getAutomationCards: (...a: unknown[]) => getAutomationCards(...a),
  getBookingsPage: vi.fn(),
  getBookingDetail: vi.fn(),
  updateBookingStatus: vi.fn(),
  getConversationsPage: vi.fn(),
  getConversationDetail: vi.fn(),
  getMessages: vi.fn(),
}));

import { GET as listAutomations } from "@/app/api/orgs/[orgId]/automations/route";

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

beforeEach(() => {
  requireOrgAccess.mockReset();
  getAutomationCards.mockReset();
});

describe("GET automations", () => {
  it("short-circuits with the guard's response when access is denied", async () => {
    const { NextResponse } = await import("next/server");
    requireOrgAccess.mockResolvedValue(new NextResponse("Forbidden", { status: 403 }));
    const res = await listAutomations(new Request("http://x/api/orgs/o1/automations"), ctx({ orgId: "o1" }));
    expect(res.status).toBe(403);
    expect(getAutomationCards).not.toHaveBeenCalled();
  });

  it("returns automation cards on allow", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    getAutomationCards.mockResolvedValue([{ id: "a1", name: "Booking Bot" }]);
    const res = await listAutomations(new Request("http://x/api/orgs/o1/automations"), ctx({ orgId: "o1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ automations: [{ id: "a1", name: "Booking Bot" }] });
  });
});
