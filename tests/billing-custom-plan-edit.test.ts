import { describe, it, expect } from "vitest";
import { editCustomPlanSchema, buildCustomPlanUpdate } from "@/lib/billing/custom-plan";

const valid = {
  plan_name: "Airport Pack v2",
  monthly_call_allowance: "6000",
  included_agents: "4",
  plan_price_gbp: "5200",
  extra_credit_price_gbp: "0.65",
  validity_days: "30",
};

describe("editCustomPlanSchema", () => {
  it("accepts valid edit input", () => {
    expect(editCustomPlanSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects a blank plan name and zero validity", () => {
    expect(editCustomPlanSchema.safeParse({ ...valid, plan_name: "" }).success).toBe(false);
    expect(editCustomPlanSchema.safeParse({ ...valid, validity_days: "0" }).success).toBe(false);
  });
  it("rejects negative prices", () => {
    expect(editCustomPlanSchema.safeParse({ ...valid, extra_credit_price_gbp: "-1" }).success).toBe(false);
  });
});

describe("buildCustomPlanUpdate", () => {
  it("builds custom + voice updates and a combined monthly price (voice-only)", () => {
    const input = editCustomPlanSchema.parse(valid);
    const out = buildCustomPlanUpdate(input, { startsAt: "2026-06-17", chatMonthlyGbp: null });
    expect(out.custom).toMatchObject({
      plan_name: "Airport Pack v2",
      monthly_call_allowance: 6000,
      included_agents: 4,
      plan_price_gbp: 5200,
      extra_credit_price_gbp: 0.65,
      validity_days: 30,
      expires_at: "2026-07-17",
    });
    expect(out.voice).toEqual({ monthly_call_allowance: 6000, included_agents: 4, monthly_price_gbp: 5200 });
    expect(out.monthlyPrice).toBe(5200);
  });
  it("adds existing chat monthly into the combined monthly price", () => {
    const input = editCustomPlanSchema.parse(valid);
    const out = buildCustomPlanUpdate(input, { startsAt: null, chatMonthlyGbp: 499 });
    expect(out.monthlyPrice).toBe(5699);
  });
});
