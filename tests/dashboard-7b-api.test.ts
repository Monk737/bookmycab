import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("server-only", () => ({}));

const requireOrgAccess = vi.fn();
vi.mock("@/lib/api/guard", () => ({ requireOrgAccess: (...a: unknown[]) => requireOrgAccess(...a) }));
vi.mock("@/lib/dashboard/analytics", () => ({
  getFunnel: vi.fn(async () => ({ inbound: 0 })), getChannelMix: vi.fn(async () => []),
  getModeSplit: vi.fn(async () => []), getVehicleSplit: vi.fn(async () => []),
  getTopZones: vi.fn(async () => []), getHeatmap: vi.fn(async () => []), getAbandonment: vi.fn(async () => []),
  getVoiceStats: vi.fn(async () => ({ totalVoiceNotes: 3, voiceConversations: 2, totalConversations: 10, voiceSharePct: 20, transcribedPct: 100, voiceBookingPct: 50, avgTranscriptChars: 42, languages: [] })),
}));
const getAutomationConfig = vi.fn(async () => ({ automationId: "a1" }));
const upsertAutomationConfig = vi.fn(async () => true);
vi.mock("@/lib/dashboard/config-queries", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAutomationConfig: (...a: unknown[]) => (getAutomationConfig as (...args: any[]) => any)(...a),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upsertAutomationConfig: (...a: unknown[]) => (upsertAutomationConfig as (...args: any[]) => any)(...a),
}));
vi.mock("@/lib/dashboard/channels-queries", () => ({ getChannels: vi.fn(async () => []) }));
vi.mock("@/lib/dashboard/billing-queries", () => ({ getBillingOverview: vi.fn(async () => ({ planBand: "A-Single" })) }));
const createTicket = vi.fn(async () => ({ ok: true, id: "tk1" as string }));
vi.mock("@/lib/dashboard/support-queries", () => ({
  listTickets: vi.fn(async () => []),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createTicket: (...a: unknown[]) => (createTicket as (...args: any[]) => any)(...a),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentClaims: vi.fn(async () => ({ sub: "u1", tenant_id: "o1" })) }));

import { GET as analyticsGet } from "@/app/api/orgs/[orgId]/automations/[automationId]/analytics/[metric]/route";
import { GET as configGet, PATCH as configPatch } from "@/app/api/orgs/[orgId]/automations/[automationId]/config/route";
import { POST as portalPost } from "@/app/api/orgs/[orgId]/billing/portal/route";
import { POST as supportPost } from "@/app/api/orgs/[orgId]/support/route";

const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) });
beforeEach(() => { requireOrgAccess.mockReset(); upsertAutomationConfig.mockClear(); createTicket.mockClear(); });

describe("analytics GET", () => {
  it("denies via guard", async () => {
    const { NextResponse } = await import("next/server");
    requireOrgAccess.mockResolvedValue(new NextResponse("Forbidden", { status: 403 }));
    const res = await analyticsGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1", metric: "funnel" }));
    expect(res.status).toBe(403);
  });
  it("passes automationId to guard and returns metric data", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const res = await analyticsGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1", metric: "funnel" }));
    expect(requireOrgAccess).toHaveBeenCalledWith("o1", expect.objectContaining({ automationId: "a1" }));
    expect(res.status).toBe(200);
  });
  it("returns { available: false } for response-time (still stubbed)", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const res = await analyticsGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1", metric: "response-time" }));
    expect(await res.json()).toMatchObject({ available: false });
  });

  it("returns voice stats data for the voice metric", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const res = await analyticsGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1", metric: "voice" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ metric: "voice", data: { voiceSharePct: 20 } });
  });
  it("404s an unknown metric", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const res = await analyticsGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1", metric: "bogus" }));
    expect(res.status).toBe(404);
  });
});

describe("config", () => {
  it("GET requires Viewer", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    await configGet(new Request("http://x"), ctx({ orgId: "o1", automationId: "a1" }));
    expect(requireOrgAccess).toHaveBeenCalledWith("o1", expect.objectContaining({ minRole: "Viewer", automationId: "a1" }));
  });
  it("PATCH requires Admin and validates body", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const bad = await configPatch(new Request("http://x", { method: "PATCH", body: JSON.stringify({ vehicle_types: "nope" }) }), ctx({ orgId: "o1", automationId: "a1" }));
    expect(requireOrgAccess).toHaveBeenCalledWith("o1", expect.objectContaining({ minRole: "Admin" }));
    expect(bad.status).toBe(400);
    expect(upsertAutomationConfig).not.toHaveBeenCalled();
    const ok = await configPatch(new Request("http://x", { method: "PATCH", body: JSON.stringify({ service_area: "Slough" }) }), ctx({ orgId: "o1", automationId: "a1" }));
    expect(ok.status).toBe(200);
    expect(upsertAutomationConfig).toHaveBeenCalled();
  });
});

describe("billing portal", () => {
  it("returns 503 honest stub", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const res = await portalPost(new Request("http://x", { method: "POST" }), ctx({ orgId: "o1" }));
    expect(res.status).toBe(503);
  });
});

describe("support POST", () => {
  it("validates + creates a ticket", async () => {
    requireOrgAccess.mockResolvedValue({ claims: { tenant_id: "o1" } });
    const bad = await supportPost(new Request("http://x", { method: "POST", body: JSON.stringify({ subject: "" }) }), ctx({ orgId: "o1" }));
    expect(bad.status).toBe(400);
    const ok = await supportPost(new Request("http://x", { method: "POST", body: JSON.stringify({ subject: "Help", category: "technical", description: "x" }) }), ctx({ orgId: "o1" }));
    expect(ok.status).toBe(200);
    expect(createTicket).toHaveBeenCalled();
  });
});
