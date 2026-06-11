import { describe, it, expect, vi } from "vitest";
import { handleStripeEvent, type BillingDeps } from "@/lib/billing/handle-event";
import type Stripe from "stripe";

function deps(over: Partial<BillingDeps> = {}): BillingDeps {
  return {
    upsertSubscription: vi.fn(async () => {}),
    updateNewModelSubscription: vi.fn(async () => {}),
    resetVoiceCallPool: vi.fn(async () => false),
    markSetupFeePaid: vi.fn(async () => ({ tenantName: "Speedy Cabs", currency: "GBP" as const })),
    sendPaymentFailedEmail: vi.fn(async () => {}),
    grantTopupCredits: vi.fn(async () => {}),
    setDefaultPaymentMethod: vi.fn(async () => {}),
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

  it("grants top-up credits on checkout.session.completed for a top-up purchase", async () => {
    const ev = {
      id: "evt_topup",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_intent: "pi_1",
          metadata: { reason: "topup_purchase", tenant_id: "t1", credits: "50" },
        },
      },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.grantTopupCredits).toHaveBeenCalledWith({
      sessionId: "cs_1",
      paymentIntentId: "pi_1",
      tenantId: "t1",
      credits: 50,
      couponCode: undefined,
    });
    expect(res.action).toBe("topup_credits.granted");
  });

  it("reads the payment_intent id when it is an expanded object", async () => {
    const ev = {
      id: "evt_topup_exp",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_2",
          payment_intent: { id: "pi_2" },
          metadata: { reason: "topup_purchase", tenant_id: "t2", credits: "10", coupon_code: "SAVE20" },
        },
      },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.grantTopupCredits).toHaveBeenCalledWith({
      sessionId: "cs_2",
      paymentIntentId: "pi_2",
      tenantId: "t2",
      credits: 10,
      couponCode: "SAVE20",
    });
    expect(res.action).toBe("topup_credits.granted");
  });

  it("sets the default payment method on an autopay-setup checkout completion", async () => {
    const ev = {
      id: "evt_autopay",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_setup",
          customer: "cus_1",
          setup_intent: "seti_1",
          metadata: { reason: "autopay_setup", tenant_id: "t1" },
        },
      },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.setDefaultPaymentMethod).toHaveBeenCalledWith({ customerId: "cus_1", setupIntentId: "seti_1" });
    expect(d.grantTopupCredits).not.toHaveBeenCalled();
    expect(res.action).toBe("autopay.enabled");
  });

  it("reads expanded setup_intent / customer objects on autopay setup", async () => {
    const ev = {
      id: "evt_autopay_exp",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_setup2",
          customer: { id: "cus_2" },
          setup_intent: { id: "seti_2" },
          metadata: { reason: "autopay_setup", tenant_id: "t2" },
        },
      },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.setDefaultPaymentMethod).toHaveBeenCalledWith({ customerId: "cus_2", setupIntentId: "seti_2" });
    expect(res.action).toBe("autopay.enabled");
  });

  it("ignores a checkout.session.completed that is not a top-up purchase", async () => {
    const ev = {
      id: "evt_other_checkout",
      type: "checkout.session.completed",
      data: { object: { id: "cs_3", payment_intent: "pi_3", metadata: {} } },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.grantTopupCredits).not.toHaveBeenCalled();
    expect(res.action).toBe("ignored");
  });

  it("acks a top-up checkout with no payment_intent without granting", async () => {
    const ev = {
      id: "evt_topup_nopi",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_4",
          payment_intent: null,
          metadata: { reason: "topup_purchase", tenant_id: "t4", credits: "5" },
        },
      },
    } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.grantTopupCredits).not.toHaveBeenCalled();
    expect(res.action).toBe("skipped");
  });

  it("ignores unhandled event types", async () => {
    const ev = { id: "evt_5", type: "customer.created", data: { object: {} } } as unknown as Stripe.Event;
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(res.action).toBe("ignored");
  });

  it("routes a new-model voice subscription to voice_subscriptions, not the legacy mirror", async () => {
    const ev = subEvent("customer.subscription.updated");
    (ev.data.object as { metadata: Record<string, string> }).metadata = {
      tenant_id: "tnt-1",
      product: "voice",
    };
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.updateNewModelSubscription).toHaveBeenCalledOnce();
    expect(d.updateNewModelSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "voice_subscriptions",
        stripe_subscription_id: "sub_123",
        update: expect.objectContaining({
          status: "active",
          current_period_start: "2023-11-14",
          current_period_end: "2023-12-14",
        }),
      }),
    );
    // The legacy mirror must NOT run for a new-model sub.
    expect(d.upsertSubscription).not.toHaveBeenCalled();
    expect(res.action).toBe("new_model.subscription.synced");
  });

  it("still runs the legacy mirror for a subscription with no metadata.product", async () => {
    // subEvent has tenant_id + plan_band but NO product → legacy path.
    const d = deps();
    const res = await handleStripeEvent(subEvent("customer.subscription.updated"), d);
    expect(d.updateNewModelSubscription).not.toHaveBeenCalled();
    expect(d.upsertSubscription).toHaveBeenCalledOnce();
    expect(res.action).toBe("subscription.upserted");
  });

  it("resets the voice call pool on invoice.paid for a voice subscription", async () => {
    const ev = {
      id: "evt_voice_inv",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_voice",
          parent: {
            type: "subscription_details",
            quote_details: null,
            subscription_details: { subscription: "sub_voice" },
          },
          lines: {
            data: [{ period: { start: 1_700_000_000, end: 1_702_592_000 } }],
          },
        },
      },
    } as unknown as Stripe.Event;
    const resetVoiceCallPool = vi.fn(async () => true);
    const d = deps({ resetVoiceCallPool });
    const res = await handleStripeEvent(ev, d);
    expect(resetVoiceCallPool).toHaveBeenCalledWith({
      stripeSubscriptionId: "sub_voice",
    });
    expect(d.markSetupFeePaid).not.toHaveBeenCalled();
    expect(res.action).toBe("voice_pool.reset");
  });

  it("falls through to logged on invoice.paid when the sub is not a voice subscription", async () => {
    const ev = {
      id: "evt_legacy_inv",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_legacy",
          parent: {
            type: "subscription_details",
            quote_details: null,
            subscription_details: { subscription: "sub_legacy" },
          },
          lines: { data: [{ period: { start: 1_700_000_000, end: 1_702_592_000 } }] },
        },
      },
    } as unknown as Stripe.Event;
    // resetVoiceCallPool default returns false → not a tracked voice sub.
    const d = deps();
    const res = await handleStripeEvent(ev, d);
    expect(d.resetVoiceCallPool).toHaveBeenCalledOnce();
    expect(res.action).toBe("logged");
  });
});

describe("usage_counters voice reset (dep contract)", () => {
  it("inserts used:0 + limit_amount for the current calendar month, ON CONFLICT DO NOTHING", async () => {
    // Exercise the REAL resetVoiceCallPool against a mocked service-role client,
    // asserting the exact usage_counters upsert shape the schema requires.
    const upsert = vi.fn(() => ({ error: null }));
    const maybeSingle = vi.fn(async () => ({
      data: { tenant_id: "tnt-9", monthly_call_allowance: 1200 },
      error: null,
    }));
    const db = {
      from: vi.fn((table: string) => {
        if (table === "voice_subscriptions") {
          return {
            select: () => ({ eq: () => ({ maybeSingle }) }),
          };
        }
        return { upsert };
      }),
    };
    const { buildResetVoiceCallPool } = await import("@/lib/billing/webhook-deps");
    const { periodBounds } = await import("@/lib/entitlements/meter");
    const reset = buildResetVoiceCallPool(db as never);
    const ok = await reset({ stripeSubscriptionId: "sub_voice" });
    expect(ok).toBe(true);

    // Period must equal the metering layer's calendar-month bounds for "now",
    // derived the same way (not hard-coded) so the assertion can't drift.
    const { start, end } = periodBounds("month", new Date());
    expect(start).toMatch(/^\d{4}-\d{2}-01$/); // 1st of the current month
    expect(upsert).toHaveBeenCalledWith(
      {
        tenant_id: "tnt-9",
        feature_key: "voice_calls",
        period_start: start,
        period_end: end,
        used: 0,
        limit_amount: 1200,
      },
      { onConflict: "tenant_id,feature_key,period_start", ignoreDuplicates: true },
    );
  });
});

describe("grantTopupCredits (dep contract)", () => {
  it("is a no-op when a credit_ledger row already exists for the payment intent", async () => {
    // Idempotency: a re-delivered checkout.session.completed must NOT double-insert.
    const insert = vi.fn(() => ({ error: null }));
    const ledgerMaybeSingle = vi.fn(async () => ({ data: { id: "cl_existing" }, error: null }));
    const db = {
      from: vi.fn((table: string) => {
        if (table === "credit_ledger") {
          return {
            select: () => ({ eq: () => ({ maybeSingle: ledgerMaybeSingle }) }),
            insert,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    const { buildGrantTopupCredits } = await import("@/lib/billing/webhook-deps");
    const grant = buildGrantTopupCredits(db as never);
    await grant({ sessionId: "cs_1", paymentIntentId: "pi_1", tenantId: "t1", credits: 50, couponCode: undefined });
    expect(ledgerMaybeSingle).toHaveBeenCalledOnce();
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts a credit_ledger row with the correct shape on the happy path", async () => {
    const insert = vi.fn(() => ({ error: null }));
    const ledgerMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const db = {
      from: vi.fn((table: string) => {
        if (table === "credit_ledger") {
          return {
            select: () => ({ eq: () => ({ maybeSingle: ledgerMaybeSingle }) }),
            insert,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    const { buildGrantTopupCredits } = await import("@/lib/billing/webhook-deps");
    const grant = buildGrantTopupCredits(db as never);
    await grant({ sessionId: "cs_1", paymentIntentId: "pi_1", tenantId: "t1", credits: 50, couponCode: undefined });
    expect(insert).toHaveBeenCalledWith({
      tenant_id: "t1",
      delta: 50,
      reason: "topup_purchase",
      unit_price_micros: 900000,
      currency: "GBP",
      stripe_payment_intent_id: "pi_1",
    });
  });

  it("records a coupon redemption + increments times_redeemed when a coupon code is present", async () => {
    const insert = vi.fn(() => ({ error: null }));
    const ledgerMaybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const couponMaybeSingle = vi.fn(async () => ({ data: { id: "coup_1", times_redeemed: 3 }, error: null }));
    const redemptionInsert = vi.fn(() => ({ error: null }));
    const couponUpdateEq = vi.fn(() => ({ error: null }));
    const couponUpdate = vi.fn(() => ({ eq: couponUpdateEq }));
    const db = {
      from: vi.fn((table: string) => {
        if (table === "credit_ledger") {
          return { select: () => ({ eq: () => ({ maybeSingle: ledgerMaybeSingle }) }), insert };
        }
        if (table === "coupons") {
          return {
            select: () => ({ eq: () => ({ maybeSingle: couponMaybeSingle }) }),
            update: couponUpdate,
          };
        }
        if (table === "coupon_redemptions") {
          return { insert: redemptionInsert };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    const { buildGrantTopupCredits } = await import("@/lib/billing/webhook-deps");
    const grant = buildGrantTopupCredits(db as never);
    await grant({ sessionId: "cs_1", paymentIntentId: "pi_1", tenantId: "t1", credits: 50, couponCode: "save20" });
    expect(redemptionInsert).toHaveBeenCalledWith({
      coupon_id: "coup_1",
      tenant_id: "t1",
      applied_to: "credit_topup",
      currency: "GBP",
      stripe_ref: "cs_1",
    });
    expect(couponUpdate).toHaveBeenCalledWith({ times_redeemed: 4 });
  });
});
