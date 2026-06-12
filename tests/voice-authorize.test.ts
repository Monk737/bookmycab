import { describe, it, expect } from "vitest";
import { parseAuthorizeBody, decideCallAuthorization } from "@/lib/voice/authorize";

describe("parseAuthorizeBody", () => {
  it("accepts a valid body", () => {
    expect(
      parseAuthorizeBody({ tenant_id: "11111111-1111-1111-1111-111111111111" }).success,
    ).toBe(true);
    expect(
      parseAuthorizeBody({
        tenant_id: "11111111-1111-1111-1111-111111111111",
        automation_id: "22222222-2222-2222-2222-222222222222",
      }).success,
    ).toBe(true);
  });
  it("rejects a non-uuid tenant_id / missing tenant", () => {
    expect(parseAuthorizeBody({ tenant_id: "nope" }).success).toBe(false);
    expect(parseAuthorizeBody({}).success).toBe(false);
  });
});

describe("decideCallAuthorization", () => {
  const base = { planStatus: "active", allowance: 1500, used: 0, creditBalance: 0 };

  it("allows while the pool has headroom", () => {
    const d = decideCallAuthorization({ ...base, used: 1499 });
    expect(d).toMatchObject({ allowed: true, reason: "ok" });
    expect(d.pool.remaining).toBe(1);
  });

  it("Ignition example: blocks call 1501 when pool is full and no credit", () => {
    const d = decideCallAuthorization({ ...base, used: 1500 });
    expect(d).toMatchObject({ allowed: false, reason: "exhausted" });
    expect(d.pool.remaining).toBe(0);
  });

  it("allows on top-up credit after the pool is exhausted", () => {
    const d = decideCallAuthorization({ ...base, used: 1500, creditBalance: 3 });
    expect(d).toMatchObject({ allowed: true, reason: "ok", credit_balance: 3 });
  });

  it("blocks when there is no active plan (paused/cancelled/none)", () => {
    expect(decideCallAuthorization({ ...base, planStatus: "paused" }).reason).toBe("no_plan");
    expect(decideCallAuthorization({ ...base, planStatus: null }).reason).toBe("no_plan");
    expect(decideCallAuthorization({ ...base, planStatus: "paused" }).allowed).toBe(false);
  });

  it("clamps negative/garbage inputs to zero rather than throwing", () => {
    const d = decideCallAuthorization({ planStatus: "active", allowance: -5, used: -2, creditBalance: -9 });
    expect(d.allowed).toBe(false);
    expect(d.pool).toEqual({ used: 0, allowance: 0, remaining: 0 });
    expect(d.credit_balance).toBe(0);
  });

  it("used can never exceed allowance in the reported remaining (no negatives)", () => {
    const d = decideCallAuthorization({ ...base, used: 2000 });
    expect(d.pool.remaining).toBe(0);
  });
});
