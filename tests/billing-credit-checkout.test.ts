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
});
