import { describe, it, expect } from "vitest";
import { planActivationCharges } from "@/lib/billing/activation-charges";

describe("planActivationCharges", () => {
  it("recurring base voice: subscription + setup invoice item, first invoice = setup + month", () => {
    const p = planActivationCharges({
      billingMode: "recurring",
      setupGbp: 999,
      chat: null,
      voice: { monthly_price_gbp: 1999, stripe_subscription_id: null },
    });
    expect(p.mode).toBe("recurring");
    expect(p.setupGbp).toBe(999);
    expect(p.subscriptions).toEqual([{ product: "voice", monthlyGbp: 1999 }]);
    expect(p.oneTimeLines).toEqual([]);
  });

  it("recurring with chat + voice: two subscriptions", () => {
    const p = planActivationCharges({
      billingMode: "recurring", setupGbp: 1500,
      chat: { monthly_price_gbp: 499, stripe_subscription_id: null },
      voice: { monthly_price_gbp: 4500, stripe_subscription_id: null },
    });
    expect(p.subscriptions).toEqual([
      { product: "chat", monthlyGbp: 499 },
      { product: "voice", monthlyGbp: 4500 },
    ]);
  });

  it("one_time pack: no subscriptions; one-time line = pack price; setup separate item", () => {
    const p = planActivationCharges({
      billingMode: "one_time", setupGbp: 1500,
      chat: null,
      voice: { monthly_price_gbp: 6000, stripe_subscription_id: null },
    });
    expect(p.mode).toBe("one_time");
    expect(p.subscriptions).toEqual([]);
    expect(p.oneTimeLines).toEqual([
      { label: "BookMyCab — AI Voice pack", amountGbp: 6000 },
    ]);
    expect(p.setupGbp).toBe(1500);
  });

  it("skips a product that already has a stripe subscription (idempotent re-run)", () => {
    const p = planActivationCharges({
      billingMode: "recurring", setupGbp: 0,
      chat: null,
      voice: { monthly_price_gbp: 1999, stripe_subscription_id: "sub_live" },
    });
    expect(p.subscriptions).toEqual([]);
  });
});
