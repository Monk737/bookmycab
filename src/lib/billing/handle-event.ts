import type Stripe from "stripe";
import type { Currency } from "@/lib/marketing/pricing";
import { subscriptionToMirror, classifyInvoice, type SubscriptionMirrorRow } from "@/lib/billing/event-map";
import { fromMinor } from "@/lib/billing/plan-price";

/**
 * Injected side-effect operations. The webhook route supplies real (service-role
 * DB + Resend) implementations; tests supply fakes. This keeps the decision
 * logic pure and fully branch-testable.
 */
export interface BillingDeps {
  /** Upsert a subscriptions mirror row (onConflict stripe_sub_id). */
  upsertSubscription(row: SubscriptionMirrorRow): Promise<void>;
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
}

export interface StripeEventResult {
  action:
    | "subscription.upserted"
    | "setup_fee.paid"
    | "payment_failed.notified"
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
      const row = subscriptionToMirror(sub);
      if (!row.tenant_id) return { action: "skipped" };
      await deps.upsertSubscription(row);
      return { action: "subscription.upserted" };
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (classifyInvoice(invoice) === "setup") {
        await deps.markSetupFeePaid(invoice.id);
        return { action: "setup_fee.paid" };
      }
      // Subscription cycle payment — Stripe is the ledger; nothing to mirror
      // beyond the subscription row we already keep. Just acknowledge.
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

    default:
      return { action: "ignored" };
  }
}
