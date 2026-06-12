import { describe, it, expect } from "vitest";
import {
  minorUnits,
  fromMinor,
  buildNewSetupInvoiceItemParams,
  buildProductSubscriptionParams,
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

describe("buildNewSetupInvoiceItemParams", () => {
  it("builds a one-time GBP invoice item with tenant metadata", () => {
    const params = buildNewSetupInvoiceItemParams({
      customerId: "cus_123",
      setupGbp: 1500,
      tenantId: "11111111-1111-1111-1111-111111111111",
    });
    expect(params).toMatchObject({
      customer: "cus_123",
      amount: 150000,
      currency: "gbp",
    });
    expect(params.description).toMatch(/setup/i);
    expect(params.metadata).toMatchObject({
      tenant_id: "11111111-1111-1111-1111-111111111111",
    });
  });
});

describe("buildProductSubscriptionParams", () => {
  it("builds a rolling-monthly GBP subscription with inline price_data + tax + metadata", () => {
    const params = buildProductSubscriptionParams({
      customerId: "cus_123",
      productId: "prod_abc",
      product: "voice",
      monthlyGbp: 1799,
      tenantId: "11111111-1111-1111-1111-111111111111",
    });
    const item = (params.items ?? [])[0];
    expect(item?.price_data).toMatchObject({
      currency: "gbp",
      product: "prod_abc",
      unit_amount: 179900,
      recurring: { interval: "month" },
    });
    expect(params.automatic_tax).toEqual({ enabled: true });
    expect(params.metadata).toMatchObject({
      tenant_id: "11111111-1111-1111-1111-111111111111",
      product: "voice",
    });
  });
});
