import { describe, it, expect } from "vitest";
import {
  buildNewSetupInvoiceItemParams,
  buildProductSubscriptionParams,
} from "@/lib/billing/plan-price";

describe("buildNewSetupInvoiceItemParams", () => {
  it("GBP minor units, correct customer + description", () => {
    const p = buildNewSetupInvoiceItemParams({ customerId: "cus_1", setupGbp: 1500, tenantId: "t1" });
    expect(p.customer).toBe("cus_1");
    expect(p.amount).toBe(150000); // 1500 * 100
    expect(p.currency).toBe("gbp");
    expect(p.metadata).toMatchObject({ tenant_id: "t1" });
  });
});

describe("buildProductSubscriptionParams", () => {
  it("rolling-monthly GBP sub tagged with product metadata", () => {
    const p = buildProductSubscriptionParams({
      customerId: "cus_1", productId: "prod_x", product: "voice", monthlyGbp: 1599, tenantId: "t1",
    });
    expect(p.customer).toBe("cus_1");
    const item = (p.items as Array<{ price_data?: { currency?: string; unit_amount?: number; recurring?: { interval?: string }; product?: string } }>)[0];
    expect(item.price_data?.currency).toBe("gbp");
    expect(item.price_data?.unit_amount).toBe(159900); // 1599 * 100
    expect(item.price_data?.recurring?.interval).toBe("month");
    expect(item.price_data?.product).toBe("prod_x");
    expect(p.metadata).toMatchObject({ tenant_id: "t1", product: "voice" });
  });
});
