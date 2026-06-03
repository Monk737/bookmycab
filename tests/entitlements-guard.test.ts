// tests/entitlements-guard.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/entitlements/resolve", () => ({ hasFeature: vi.fn() }));
vi.mock("@/lib/entitlements/meter", () => ({ checkQuota: vi.fn() }));

import { hasFeature } from "@/lib/entitlements/resolve";
import { checkQuota } from "@/lib/entitlements/meter";
import { requireFeature, requireQuota } from "@/lib/entitlements/guard";

describe("requireFeature", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns null when the tenant has the feature", async () => {
    vi.mocked(hasFeature).mockResolvedValue(true);
    expect(await requireFeature("t1", "alerting")).toBeNull();
  });

  it("returns a 403 when the tenant lacks the feature", async () => {
    vi.mocked(hasFeature).mockResolvedValue(false);
    const res = await requireFeature("t1", "alerting");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toMatch(/not available on your plan/i);
    expect(body.feature).toBe("alerting");
  });
});

describe("requireQuota", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns null when the feature is on and under quota", async () => {
    vi.mocked(hasFeature).mockResolvedValue(true);
    vi.mocked(checkQuota).mockResolvedValue({ allowed: true, used: 1, limit: 100 });
    expect(await requireQuota("t1", "alerting")).toBeNull();
  });

  it("returns 429 when over quota", async () => {
    vi.mocked(hasFeature).mockResolvedValue(true);
    vi.mocked(checkQuota).mockResolvedValue({ allowed: false, used: 100, limit: 100 });
    const res = await requireQuota("t1", "alerting");
    expect(res!.status).toBe(429);
  });

  it("returns 403 when the feature is off (checked before quota)", async () => {
    vi.mocked(hasFeature).mockResolvedValue(false);
    const res = await requireQuota("t1", "alerting");
    expect(res!.status).toBe(403);
  });
});
