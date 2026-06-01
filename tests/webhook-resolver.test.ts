import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getOrSet = vi.fn();
vi.mock("@/lib/redis/cache", () => ({ getOrSet: (...a: unknown[]) => getOrSet(...a) }));

const loadAutomationFromDb = vi.fn();
vi.mock("@/lib/webhooks/resolver-loader", () => ({
  loadAutomationFromDb: (...a: unknown[]) => loadAutomationFromDb(...a),
}));

import { resolveAutomation } from "@/lib/webhooks/resolver";

beforeEach(() => {
  getOrSet.mockReset();
  loadAutomationFromDb.mockReset();
});

describe("resolveAutomation", () => {
  it("returns the cached/loaded record and keys the cache by automation id", async () => {
    const rec = {
      automationId: "a1",
      tenantId: "t1",
      status: "live",
      engineWebhookUrl: "http://engine/webhook/a1",
    };
    getOrSet.mockImplementation(async (_key: string, _ttl: number, loader: () => Promise<unknown>) => loader());
    loadAutomationFromDb.mockResolvedValue(rec);

    const out = await resolveAutomation("a1");
    expect(out).toEqual(rec);
    expect(getOrSet).toHaveBeenCalledWith("automation:a1", 300, expect.any(Function));
  });

  it("returns null for an unknown automation (negative result is cacheable)", async () => {
    getOrSet.mockImplementation(async (_k, _t, loader) => loader());
    loadAutomationFromDb.mockResolvedValue(null);
    expect(await resolveAutomation("ghost")).toBeNull();
  });
});
