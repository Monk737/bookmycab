import type Stripe from "stripe";
import type { Currency } from "@/lib/marketing/pricing";
import {
  subscriptionToMirror,
  classifyInvoice,
  mapNewModelSubscription,
  invoiceSubscriptionId,
  type SubscriptionMirrorRow,
} from "@/lib/billing/event-map";
import { fromMinor } from "@/lib/billing/plan-price";

/**
 * Injected side-effect operations. The webhook route supplies real (service-role
 * DB + Resend) implementations; tests supply fakes. This keeps the decision
 * logic pure and fully branch-testable.
 */
export interface BillingDeps {
  /** Upsert a subscriptions mirror row (onConflict stripe_sub_id). */
  upsertSubscription(row: SubscriptionMirrorRow): Promise<void>;
  /** Update a new-model chat/voice subscription row, matched by
   *  `stripe_subscription_id`, with the mapped status + period. */
  updateNewModelSubscription(out: NonNullable<ReturnType<typeof mapNewModelSubscription>>): Promise<void>;
  /** Open a fresh `usage_counters` voice-calls period for the tenant whose
   *  `voice_subscriptions` row matches `stripeSubscriptionId`. The period is the
   *  current calendar month (owned by the implementation, matching the metering
   *  layer's `periodBounds("month", …)` buckets) and the write is INSERT-ONLY,
   *  so a re-delivered `invoice.paid` within the same month is a no-op and never
   *  zeroes accrued usage. No-op (returns false) when no voice subscription
   *  matches that id. */
  resetVoiceCallPool(args: { stripeSubscriptionId: string }): Promise<boolean>;
  /** Mark the setup_fees row for this Stripe invoice id as paid; return tenant
   *  display info for any follow-up (or null when no matching row). */
  markSetupFeePaid(stripeInvoiceId: string): Promise<{ tenantName: string; currency: Currency } | null>;
  /** Email ops + the customer that a subscription payment failed. */
  sendPaymentFailedEmail(info: {
    customerEmail: string | null;
    amountMajor: number;
    currency: Currency;
    invoiceUrl: string | null;
  }): Promise<void>;
  /** Email the customer a receipt for a successful subscription payment.
   *  Optional: best-effort, callers may omit it (e.g. test mocks). */
  sendPaymentReceivedEmail?(info: {
    customerEmail: string | null;
    amountMajor: number;
    currency: Currency;
    periodLabel: string | null;
    invoiceUrl: string | null;
  }): Promise<void>;
  /** Grant voice top-up credits to `credit_ledger` for a completed credit
   *  top-up Checkout session. INSERT-ONLY + idempotent on
   *  `stripe_payment_intent_id` (the ledger is append-only). Best-effort coupon
   *  redemption when `couponCode` is present. When `unitPriceMicros` is
   *  provided (from session metadata), the ledger row records that unit price
   *  instead of the global default. */
  grantTopupCredits(args: {
    sessionId: string;
    paymentIntentId: string;
    tenantId: string;
    credits: number;
    couponCode: string | undefined;
    unitPriceMicros?: number;
  }): Promise<void>;
  /** Set the payment method captured by an autopay-setup Checkout session as the
   *  customer's default for invoices, so subscription renewals auto-charge. */
  setDefaultPaymentMethod(args: { customerId: string; setupIntentId: string }): Promise<void>;
  /** After autopay setup, switch the customer's BookMyCab subscriptions to
   *  `charge_automatically` so renewals auto-charge the saved default card. */
  enableAutopayRenewals(args: { customerId: string }): Promise<void>;
  /** For a paid one-time custom pack invoice, open the prepaid call pool for the
   *  pack's validity window (idempotent). No-op when the tenant has no one-time
   *  custom plan. */
  grantCustomPackPool(stripeInvoiceId: string): Promise<void>;
}

export interface StripeEventResult {
  action:
    | "subscription.upserted"
    | "new_model.subscription.synced"
    | "voice_pool.reset"
    | "setup_fee.paid"
    | "payment_failed.notified"
    | "topup_credits.granted"
    | "autopay.enabled"
    | "logged"
    | "skipped"
    | "ignored";
}

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: BillingDeps,
): Promise<StripeEventResult> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      // New-model subs carry `metadata.product` (chat|voice); route them to the
      // chat_subscriptions/voice_subscriptions row and STOP — do NOT also run the
      // legacy `subscriptions` mirror for them. Legacy subs return null here.
      const newModel = mapNewModelSubscription(sub);
      if (newModel) {
        await deps.updateNewModelSubscription(newModel);
        return { action: "new_model.subscription.synced" };
      }
      const row = subscriptionToMirror(sub);
      if (!row.tenant_id) return { action: "skipped" };
      await deps.upsertSubscription(row);
      return { action: "subscription.upserted" };
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      // Settle a tracked activation invoice (setup fee + first period). This is a
      // no-op (markSetupFeePaid returns null) when the invoice isn't a tracked
      // setup/activation invoice, so it's safe to attempt for EVERY paid invoice.
      // It MUST run before the subscription branch: the recurring activation
      // invoice carries a subscription pointer (classifyInvoice → "subscription")
      // because the setup fee is folded into the first subscription invoice, so
      // gating on classifyInvoice === "setup" alone would never mark it paid.
      const settled = invoice.id ? await deps.markSetupFeePaid(invoice.id) : null;
      if (settled && invoice.id) await deps.grantCustomPackPool(invoice.id);

      // A pure setup / one-time-pack invoice (no subscription pointer) is fully
      // handled once the fee is settled.
      if (classifyInvoice(invoice) === "setup") {
        return { action: "setup_fee.paid" };
      }
      // Subscription cycle payment, send the customer a receipt (best-effort;
      // dep is optional so legacy test mocks need not provide it).
      const periodLabel =
        invoice.period_start && invoice.period_end
          ? `${new Date(invoice.period_start * 1000).toLocaleDateString("en-GB")} – ${new Date(invoice.period_end * 1000).toLocaleDateString("en-GB")}`
          : null;
      await deps.sendPaymentReceivedEmail?.({
        customerEmail: invoice.customer_email ?? null,
        amountMajor: fromMinor(invoice.amount_paid ?? 0),
        currency: (invoice.currency ?? "gbp").toUpperCase() as Currency,
        periodLabel,
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      });
      // For a NEW-MODEL voice subscription, open a
      // fresh voice-calls usage period (resets the shared monthly call pool).
      // resetVoiceCallPool returns false when this invoice's subscription isn't a
      // tracked voice subscription (legacy tenants / chat subs), in which case we
      // fall through to the legacy acknowledge.
      const subId = invoiceSubscriptionId(invoice);
      if (subId) {
        const reset = await deps.resetVoiceCallPool({ stripeSubscriptionId: subId });
        if (reset) return { action: "voice_pool.reset" };
      }
      // Legacy subscription cycle payment, Stripe is the ledger; nothing to
      // mirror beyond the subscription row we already keep. Just acknowledge.
      return { action: "logged" };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const amountMinor = invoice.amount_due ?? 0;
      await deps.sendPaymentFailedEmail({
        customerEmail: invoice.customer_email ?? null,
        amountMajor: fromMinor(amountMinor),
        currency: (invoice.currency ?? "gbp").toUpperCase() as Currency,
        invoiceUrl: invoice.hosted_invoice_url ?? null,
      });
      // DECISION (Q-payment-failed): NO auto-suspend. The automation keeps
      // running; we only notify. Recovery is dunning (Stripe) + manual follow-up.
      return { action: "payment_failed.notified" };
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Autopay setup (mode: "setup"): persist the captured card as the customer's
      // default payment method so subscription renewals auto-charge.
      if (session.metadata?.reason === "autopay_setup") {
        const si = session.setup_intent;
        const setupIntentId = typeof si === "string" ? si : si?.id ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        if (!setupIntentId || !customerId) return { action: "skipped" };
        await deps.setDefaultPaymentMethod({ customerId, setupIntentId });
        await deps.enableAutopayRenewals({ customerId });
        return { action: "autopay.enabled" };
      }

      // Only credit top-up checkouts are handled beyond this point; other sessions
      // are acknowledged and ignored.
      if (session.metadata?.reason !== "topup_purchase") {
        return { action: "ignored" };
      }
      // payment_intent may be a string id or an expanded object; read the id.
      const pi = session.payment_intent;
      const paymentIntentId = typeof pi === "string" ? pi : pi?.id ?? null;
      if (!paymentIntentId) return { action: "skipped" };
      // Defensive: credits is authored by our own checkout route (a validated
      // positive integer), but never grant a non-finite/non-positive amount.
      const credits = Number(session.metadata.credits);
      if (!Number.isInteger(credits) || credits <= 0) return { action: "skipped" };
      const rawUnitMicros = Number(session.metadata.credit_unit_micros);
      const unitPriceMicros = Number.isFinite(rawUnitMicros) && rawUnitMicros > 0 ? rawUnitMicros : undefined;
      await deps.grantTopupCredits({
        sessionId: session.id,
        paymentIntentId,
        tenantId: session.metadata.tenant_id,
        credits,
        couponCode: session.metadata.coupon_code || undefined,
        unitPriceMicros,
      });
      return { action: "topup_credits.granted" };
    }

    default:
      return { action: "ignored" };
  }
}
