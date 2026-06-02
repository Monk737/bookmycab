import { describe, it, expect, vi } from "vitest";
import { handleStripeEvent, type BillingDeps } from "@/lib/billing/handle-event";
import type Stripe from "stripe";

function deps(over: Partial<BillingDeps> = {}): BillingDeps {
  return {
    upsertSubscription: vi.fn(async () => {}),
    markSetupFeePaid: vi.fn(async () => ({ tenantName: "Speedy Cabs", currency: "GBP" as const })),
    sendPaymentFailedEmail: vi.fn(async () => {}),
    ...over,
  };
}

function subEvent(type: string): Stripe.Event {
  return {
    id: "evt_1",
    type,
    data: {
      object: {
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
            },
          ],
        },
      },
    },
  } as unknown as Stripe.Event;
}

describe("handleStripeEvent", () => {
  it("upserts the mirror on customer.subscription.updated", async () => {
    const d = deps();
    const res = await handleStripeEvent(subEvent("customer.subscription.updated"), d);
    expect(d.upsertSubscription).toHaveBeenCalledOnce();
    expect(res.action).toBe("subscription.upserted");
  });

  it("skips a subscription with no tenant_id metadata", async () => {
    const ev = subEvent("customer.subscription.created");
    (ev.data.object as { metadata: Record<string, string> }).metadata = {};
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.upsertSubscription).not.toHaveBeenCalled();
    expect(res.action).toBe("skipped");
  });

  it("marks the setup fee paid on invoice.paid for a setup invoice", async () => {
    const ev = {
      id: "evt_2",
      type: "invoice.paid",
      data: { object: { id: "in_1", parent: null, amount_paid: 100000, currency: "gbp" } },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.markSetupFeePaid).toHaveBeenCalledWith("in_1");
    expect(res.action).toBe("setup_fee.paid");
  });

  it("does not mark a setup fee for a subscription invoice.paid", async () => {
    const ev = {
      id: "evt_3",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_2",
          parent: {
            type: "subscription_details",
            quote_details: null,
            subscription_details: { subscription: "sub_123" },
          },
        },
      },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.markSetupFeePaid).not.toHaveBeenCalled();
    expect(res.action).toBe("logged");
  });

  it("emails on invoice.payment_failed but never suspends", async () => {
    const ev = {
      id: "evt_4",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_3",
          parent: { type: "subscription_details", quote_details: null, subscription_details: { subscription: "sub_123" } },
          amount_due: 50000,
          currency: "gbp",
          hosted_invoice_url: "https://invoice.stripe.com/i/abc",
          customer_email: "owner@speedycabs.test",
        },
      },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.sendPaymentFailedEmail).toHaveBeenCalledOnce();
    expect(res.action).toBe("payment_failed.notified");
  });

  it("ignores unhandled event types", async () => {
    const ev = { id: "evt_5", type: "customer.created", data: { object: {} } } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(res.action).toBe("ignored");
  });
});
