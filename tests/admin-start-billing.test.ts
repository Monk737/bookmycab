import { describe, it, expect } from "vitest";
import { planNewModelCharges } from "@/lib/billing/new-model-charges";

const tenant = { id: "t1", commercial_model: "double_decker", stripe_customer_id: "cus_1" };

describe("planNewModelCharges", () => {
  it("plans a setup invoice + chat sub + voice sub for double_decker", () => {
    const ops = planNewModelCharges({
      tenant,
      chat: { monthly_price_gbp: 1600, stripe_subscription_id: null },
      voice: { monthly_price_gbp: 1599, stripe_subscription_id: null },
      setupGbp: 2000,
    });
    expect(ops.setup).toEqual({ setupGbp: 2000 });
    expect(ops.subscriptions).toEqual([
      { product: "chat", monthlyGbp: 1600 },
      { product: "voice", monthlyGbp: 1599 },
    ]);
  });
  it("skips a product that already has a stripe_subscription_id (idempotent)", () => {
    const ops = planNewModelCharges({
      tenant,
      chat: { monthly_price_gbp: 1600, stripe_subscription_id: "sub_existing" },
      voice: { monthly_price_gbp: 1599, stripe_subscription_id: null },
      setupGbp: 2000,
    });
    expect(ops.subscriptions).toEqual([{ product: "voice", monthlyGbp: 1599 }]);
  });
  it("voice-only tenant: no chat sub", () => {
    const ops = planNewModelCharges({
      tenant: { ...tenant, commercial_model: "voice" },
      chat: null,
      voice: { monthly_price_gbp: 1199, stripe_subscription_id: null },
      setupGbp: 1000,
    });
    expect(ops.subscriptions).toEqual([{ product: "voice", monthlyGbp: 1199 }]);
  });
});
