import { describe, it, expect } from "vitest";
import {
  customPlanSchema,
  resolveCustomPlan,
  packExpiry,
  type CustomPlanInput,
} from "@/lib/billing/custom-plan";

const base: CustomPlanInput = {
  planName: "Airport Pack",
  billingMode: "recurring",
  includesChat: false,
  includesVoice: true,
  callAllowance: 5000,
  includedAgents: 3,
  planPriceGbp: 4500,
  setupFeeGbp: 1500,
  validityDays: 30,
  extraCreditPriceGbp: 0.75,
  pricePerCallGbp: 0.9,
  chatMonthlyGbp: null,
};

describe("customPlanSchema", () => {
  it("accepts a valid recurring voice plan", () => {
    expect(customPlanSchema.safeParse(base).success).toBe(true);
  });
  it("rejects a plan that includes neither product", () => {
    const r = customPlanSchema.safeParse({ ...base, includesVoice: false, includesChat: false });
    expect(r.success).toBe(false);
  });
  it("requires chatMonthlyGbp when includesChat", () => {
    const r = customPlanSchema.safeParse({ ...base, includesChat: true, chatMonthlyGbp: null });
    expect(r.success).toBe(false);
  });
  it("rejects negative numbers and zero validity", () => {
    expect(customPlanSchema.safeParse({ ...base, planPriceGbp: -1 }).success).toBe(false);
    expect(customPlanSchema.safeParse({ ...base, validityDays: 0 }).success).toBe(false);
  });
});

describe("resolveCustomPlan", () => {
  it("voice-only recurring: voice = plan price, chat null", () => {
    expect(resolveCustomPlan(base)).toEqual({
      commercialModel: "custom",
      chatGbp: null,
      voiceGbp: 4500,
      voiceAllowance: 5000,
      voiceAgents: 3,
      setupGbp: 1500,
      firstPeriodGbp: 4500,
      extraCreditPriceGbp: 0.75,
    });
  });
  it("with chat: chatGbp set, firstPeriod = chat + voice", () => {
    const r = resolveCustomPlan({ ...base, includesChat: true, chatMonthlyGbp: 400 });
    expect(r.chatGbp).toBe(400);
    expect(r.firstPeriodGbp).toBe(4900);
  });
  it("one_time pack: firstPeriodGbp = pack price (no recurring)", () => {
    const r = resolveCustomPlan({ ...base, billingMode: "one_time" });
    expect(r.firstPeriodGbp).toBe(4500);
  });
});

describe("packExpiry", () => {
  it("adds validity days to the start date (UTC date-only)", () => {
    expect(packExpiry("2026-06-17", 30)).toBe("2026-07-17");
  });
});
