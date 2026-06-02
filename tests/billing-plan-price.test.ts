import { describe, it, expect } from "vitest";
import {
  minorUnits,
  fromMinor,
  setupFeeMinor,
  buildSubscriptionCreateParams,
  buildSetupInvoiceItemParams,
} from "@/lib/billing/plan-price";

describe("minorUnits / fromMinor", () => {
  it("converts major→minor with rounding", () => {
    expect(minorUnits(500)).toBe(50000);
    expect(minorUnits(1000)).toBe(100000);
    expect(minorUnits(12.34)).toBe(1234);
  });
  it("round-trips", () => {
    expect(fromMinor(50000)).toBe(500);
    expect(fromMinor(1234)).toBe(12.34);
  });
});

describe("setupFeeMinor", () => {
  it("uses the PRD setup fee per currency, in minor units", () => {
    expect(setupFeeMinor("GBP")).toBe(100000); // £1,000
    expect(setupFeeMinor("USD")).toBe(120000); // $1,200
  });
});

describe("buildSetupInvoiceItemParams", () => {
  it("builds a one-time invoice item in lowercase currency", () => {
    const params = buildSetupInvoiceItemParams({
      customerId: "cus_123",
      currency: "GBP",
    });
    expect(params).toMatchObject({
      customer: "cus_123",
      amount: 100000,
      currency: "gbp",
    });
    expect(params.description).toMatch(/setup/i);
  });
});

describe("buildSubscriptionCreateParams", () => {
  it("builds a monthly subscription with inline price_data + tax + metadata", () => {
    const params = buildSubscriptionCreateParams({
      customerId: "cus_123",
      productId: "prod_abc",
      band: "A-Single",
      currency: "GBP",
      tenantId: "11111111-1111-1111-1111-111111111111",
    });
    const item = (params.items ?? [])[0];
    expect(item?.price_data).toMatchObject({
      currency: "gbp",
      product: "prod_abc",
      unit_amount: 50000,
      recurring: { interval: "month" },
    });
    expect(params.automatic_tax).toEqual({ enabled: true });
    expect(params.metadata).toMatchObject({
      tenant_id: "11111111-1111-1111-1111-111111111111",
      plan_band: "A-Single",
    });
  });

  it("refuses Custom (no fixed price — quoted manually)", () => {
    expect(() =>
      buildSubscriptionCreateParams({
        customerId: "cus_123",
        productId: "prod_abc",
        band: "Custom",
        currency: "GBP",
        tenantId: "11111111-1111-1111-1111-111111111111",
      }),
    ).toThrow(/custom/i);
  });
});
