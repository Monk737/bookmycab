import { describe, it, expect } from "vitest";
import { subscriptionToMirror, classifyInvoice } from "@/lib/billing/event-map";
import type Stripe from "stripe";

function fakeSubscription(over: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: "sub_123",
    status: "active",
    cancel_at: null,
    metadata: { tenant_id: "tnt-1", plan_band: "A-Single" },
    items: {
      data: [
        {
          price: { unit_amount: 50000, currency: "gbp" },
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
        } as unknown as Stripe.SubscriptionItem,
      ],
    },
    ...over,
  } as unknown as Stripe.Subscription;
}

describe("subscriptionToMirror", () => {
  it("maps a Stripe subscription to a subscriptions-row", () => {
    const row = subscriptionToMirror(fakeSubscription());
    expect(row).toMatchObject({
      tenant_id: "tnt-1",
      stripe_sub_id: "sub_123",
      plan_band: "A-Single",
      monthly_price: 500,
      currency: "GBP",
      status: "active",
      current_period_start: "2023-11-14T22:13:20.000Z",
      current_period_end: "2023-12-14T22:13:20.000Z",
      cancel_at: null,
    });
  });

  it("returns null tenant_id when metadata is missing (caller skips)", () => {
    const row = subscriptionToMirror(fakeSubscription({ metadata: {} as Stripe.Metadata }));
    expect(row.tenant_id).toBeNull();
  });

  it("maps cancel_at when set", () => {
    const row = subscriptionToMirror(fakeSubscription({ cancel_at: 1_702_592_000 }));
    expect(row.cancel_at).toBe("2023-12-14T22:13:20.000Z");
  });
});

describe("classifyInvoice", () => {
  it("flags a one-time setup invoice (no subscription parent)", () => {
    const inv = { id: "in_1", parent: null } as unknown as Stripe.Invoice;
    expect(classifyInvoice(inv)).toBe("setup");
  });
  it("flags a subscription invoice", () => {
    const inv = {
      id: "in_2",
      parent: {
        type: "subscription_details",
        quote_details: null,
        subscription_details: { subscription: "sub_123" },
      },
    } as unknown as Stripe.Invoice;
    expect(classifyInvoice(inv)).toBe("subscription");
  });
});
