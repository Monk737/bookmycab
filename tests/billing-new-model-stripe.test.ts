import { describe, it, expect } from "vitest";
import {
  buildNewSetupInvoiceItemParams,
  buildProductSubscriptionParams,
} from "@/lib/billing/plan-price";
import { mapNewModelSubscription } from "@/lib/billing/event-map";

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

describe("mapNewModelSubscription", () => {
  const sub = {
    id: "sub_123",
    status: "active",
    metadata: { tenant_id: "t1", product: "voice" },
    current_period_start: 1750000000,
    current_period_end: 1752592000,
  };
  it("routes to voice_subscriptions with mapped status + ISO periods", () => {
    const out = mapNewModelSubscription(sub as never);
    expect(out).not.toBeNull();
    expect(out!.table).toBe("voice_subscriptions");
    expect(out!.stripe_subscription_id).toBe("sub_123");
    expect(out!.update.status).toBe("active");
    expect(out!.update.current_period_start).toBe("2025-06-15");
  });
  it("maps canceled → cancelled and chat product → chat_subscriptions", () => {
    const out = mapNewModelSubscription({ ...sub, status: "canceled", metadata: { tenant_id: "t1", product: "chat" } } as never);
    expect(out!.table).toBe("chat_subscriptions");
    expect(out!.update.status).toBe("cancelled");
  });
  it("returns null for a subscription without our product metadata (legacy)", () => {
    expect(mapNewModelSubscription({ id: "x", status: "active", metadata: {} } as never)).toBeNull();
  });
  it("reads periods from the subscription ITEM (Stripe Basil payload shape)", () => {
    const out = mapNewModelSubscription({
      id: "sub_basil",
      status: "active",
      metadata: { tenant_id: "t1", product: "chat" },
      items: { data: [{ current_period_start: 1750000000, current_period_end: 1752592000 }] },
    } as never);
    expect(out!.update.current_period_start).toBe("2025-06-15");
    expect(out!.update.current_period_end).not.toBeNull();
  });
});
