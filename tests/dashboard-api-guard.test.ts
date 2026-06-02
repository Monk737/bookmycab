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
import { GET as listBookings } from "@/app/api/orgs/[orgId]/automations/[automationId]/bookings/route";
import { PATCH as patchBooking } from "@/app/api/orgs/[orgId]/automations/[automationId]/bookings/[bookingId]/route";
import { GET as listConversations } from "@/app/api/orgs/[orgId]/automations/[automationId]/conversations/route";
import { getBookingsPage, updateBookingStatus } from "@/lib/dashboard/queries";
import { getConversationsPage } from "@/lib/dashboard/queries";

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

beforeEach(() => {
  requireOrgAccess.mockReset();
  getAutomationCards.mockReset();
  (getBookingsPage as ReturnType<typeof vi.fn>).mockReset();
  (updateBookingStatus as ReturnType<typeof vi.fn>).mockReset();
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

describe("GET bookings", () => {
  it("passes automationId to the guard for restriction enforcement", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    (getBookingsPage as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], total: 0 });
    await listBookings(new Request("http://x/api/orgs/o1/automations/a1/bookings?page=1"), ctx({ orgId: "o1", automationId: "a1" }));
    expect(requireOrgAccess).toHaveBeenCalledWith("o1", expect.objectContaining({ automationId: "a1" }));
  });
});

describe("GET conversations", () => {
  it("passes automationId to the guard and returns rows on allow", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    (getConversationsPage as ReturnType<typeof vi.fn>).mockResolvedValue({ rows: [], total: 0 });
    const res = await listConversations(new Request("http://x/api/orgs/o1/automations/a1/conversations?page=1"), ctx({ orgId: "o1", automationId: "a1" }));
    expect(requireOrgAccess).toHaveBeenCalledWith("o1", expect.objectContaining({ automationId: "a1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [], total: 0 });
  });
});

describe("PATCH booking status", () => {
  it("requires Admin and enforces automation restriction", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    (updateBookingStatus as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const req = new Request("http://x/api/orgs/o1/automations/a1/bookings/b1", { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
    const res = await patchBooking(req, ctx({ orgId: "o1", automationId: "a1", bookingId: "b1" }));
    expect(requireOrgAccess).toHaveBeenCalledWith("o1", expect.objectContaining({ minRole: "Admin", automationId: "a1" }));
    // The write must be scoped to the automation, not just the booking id, so a
    // restriction-scoped Admin can't mutate a sibling automation's booking.
    expect(updateBookingStatus).toHaveBeenCalledWith("b1", "a1", "cancelled");
    expect(res.status).toBe(200);
  });
  it("returns 404 when the booking is not in this automation (update matched no row)", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    (updateBookingStatus as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const req = new Request("http://x/api/orgs/o1/automations/a1/bookings/bX", { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
    const res = await patchBooking(req, ctx({ orgId: "o1", automationId: "a1", bookingId: "bX" }));
    expect(res.status).toBe(404);
  });
  it("rejects an invalid status value with 400", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const req = new Request("http://x/api/orgs/o1/automations/a1/bookings/b1", { method: "PATCH", body: JSON.stringify({ status: "bogus" }) });
    const res = await patchBooking(req, ctx({ orgId: "o1", automationId: "a1", bookingId: "b1" }));
    expect(res.status).toBe(400);
  });
});
