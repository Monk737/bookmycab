import { describe, it, expect } from "vitest";
import { buildCreditCheckoutParams } from "@/lib/billing/credit-checkout";

describe("buildCreditCheckoutParams", () => {
  const base = { customerId: "cus_1", tenantId: "t1", orgId: "t1", origin: "https://app.example" };

  it("pack: GBP line item with credits in metadata", () => {
    const p = buildCreditCheckoutParams({ ...base, gbp: 45, credits: 50, finalGbp: 45 });
    expect(p.mode).toBe("payment");
    expect(p.customer).toBe("cus_1");
    const li = p.line_items![0] as { price_data?: { currency?: string; unit_amount?: number }; quantity?: number };
    expect(li.price_data?.currency).toBe("gbp");
    expect(li.price_data?.unit_amount).toBe(4500); // £45
    expect(p.metadata).toMatchObject({ tenant_id: "t1", credits: "50", reason: "topup_purchase" });
  });

  it("applies a coupon discount to the charged amount but NOT the credits", () => {
    const p = buildCreditCheckoutParams({ ...base, gbp: 45, credits: 50, finalGbp: 36, couponCode: "SAVE20" });
    const li = p.line_items![0] as { price_data?: { unit_amount?: number } };
    expect(li.price_data?.unit_amount).toBe(3600); // £36 charged
    expect(p.metadata).toMatchObject({ credits: "50", coupon_code: "SAVE20" }); // still 50 credits
  });

  it("base tenant (no custom plan) prices ad-hoc top-ups at £2/credit", async () => {
    // custom_plans lookup → { data: null } (base rate).
    // POST { customGbp: 20 } → 10 credits (20 / £2) and credit_unit_micros "2000000".
    const p = buildCreditCheckoutParams({ ...base, gbp: 20, credits: 10, finalGbp: 20 });
    expect(p.metadata).toMatchObject({ credits: "10", credit_unit_micros: "2000000" });
    const li = p.line_items![0] as { price_data?: { unit_amount?: number } };
    expect(li.price_data?.unit_amount).toBe(2000); // £20 charged
  });

  it("custom-rate tenant: credits computed at 0.75/call and credit_unit_micros = 750000", () => {
    // 15 GBP at £0.75/call = 20 credits; unitGbp flows into metadata as micros
    const p = buildCreditCheckoutParams({ ...base, gbp: 15, credits: 20, finalGbp: 15, unitGbp: 0.75 });
    expect(p.metadata).toMatchObject({ credits: "20", credit_unit_micros: "750000" });
    const li = p.line_items![0] as { price_data?: { unit_amount?: number } };
    expect(li.price_data?.unit_amount).toBe(1500); // £15 charged
  });
});
