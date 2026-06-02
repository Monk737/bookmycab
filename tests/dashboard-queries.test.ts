import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { getBookingsPage, getConversationsPage, getKpiStrip } from "@/lib/dashboard/queries";

function fakeClient(result: { data: unknown; count?: number; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  for (const m of ["select", "eq", "gte", "lte", "ilike", "in", "order", "range", "limit"]) {
    builder[m] = chain(m);
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve({ data: result.data, count: result.count, error: result.error });
  const client = { from: (table: string) => { calls.push({ method: "from", args: [table] }); return builder; } };
  return { client, calls };
}

describe("getBookingsPage", () => {
  it("queries bookings for the automation with paging + ordering", async () => {
    const { client, calls } = fakeClient({ data: [], count: 0, error: null });
    await getBookingsPage({ automationId: "a1", filter: { page: 1, limit: 50 } }, client as never);
    expect(calls.find((c) => c.method === "from")?.args[0]).toBe("bookings");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "automation_id" && c.args[1] === "a1")).toBe(true);
    expect(calls.some((c) => c.method === "order")).toBe(true);
    expect(calls.some((c) => c.method === "range")).toBe(true);
  });

  it("applies status + search + date filters when present", async () => {
    const { client, calls } = fakeClient({ data: [], count: 0, error: null });
    await getBookingsPage(
      { automationId: "a1", filter: { page: 1, limit: 50, status: "confirmed", search: "SL1", from: "2026-06-01", to: "2026-06-07" } },
      client as never,
    );
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "status")).toBe(true);
    expect(calls.some((c) => c.method === "gte" && c.args[0] === "pickup_at_utc")).toBe(true);
    expect(calls.some((c) => c.method === "lte" && c.args[0] === "pickup_at_utc")).toBe(true);
    expect(calls.some((c) => c.method === "ilike")).toBe(true);
  });
});

describe("getConversationsPage", () => {
  it("queries conversations for the automation", async () => {
    const { client, calls } = fakeClient({ data: [], count: 0, error: null });
    await getConversationsPage({ automationId: "a1", filter: { page: 1, limit: 50 } }, client as never);
    expect(calls.find((c) => c.method === "from")?.args[0]).toBe("conversations");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "automation_id")).toBe(true);
  });
});

describe("getKpiStrip", () => {
  it("reads today's counts for a tenant", async () => {
    const { client, calls } = fakeClient({ data: [], count: 3, error: null });
    const out = await getKpiStrip("t1", client as never);
    expect(calls.some((c) => c.method === "from" && c.args[0] === "bookings")).toBe(true);
    expect(out).toHaveProperty("bookingsToday");
    expect(out).toHaveProperty("conversationsToday");
    expect(out).toHaveProperty("liveAutomations");
  });
});
