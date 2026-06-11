import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import type { BillingDeps } from "@/lib/billing/handle-event";
import { periodBounds } from "@/lib/entitlements/meter";
import { sendEmail } from "@/lib/email/resend";
import { paymentFailedEmail } from "@/lib/email/templates";
import type { Currency } from "@/lib/marketing/pricing";

/** The narrow slice of the Supabase client the reset helper needs. Kept minimal
 *  so the factory is unit-testable with a hand-rolled fake. */
type SupabaseLike = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Build the voice-call-pool reset operation against a Supabase-like client. On
 * `invoice.paid` for a tracked voice subscription, opens a fresh voice-calls
 * usage period (used:0, limit = monthly_call_allowance). Returns false when the
 * invoice's subscription isn't a tracked voice subscription (legacy / chat).
 * Exported so it can be unit-tested with a mocked client.
 */
export function buildResetVoiceCallPool(
  db: SupabaseLike,
): BillingDeps["resetVoiceCallPool"] {
  return async ({ stripeSubscriptionId }) => {
    const { data: vsub, error: lookupErr } = await db
      .from("voice_subscriptions")
      .select("tenant_id, monthly_call_allowance")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();
    if (lookupErr) throw new Error(`resetVoiceCallPool lookup failed: ${lookupErr.message}`);
    if (!vsub) return false;

    const { tenant_id, monthly_call_allowance } = vsub as {
      tenant_id: string;
      monthly_call_allowance: number;
    };
    // Bucket by calendar month — the SAME bounds the metering layer reads/writes
    // (`periodBounds("month", …)`), so the reset opens the row the meter uses.
    const { start, end } = periodBounds("month", new Date());
    // INSERT-ONLY (ON CONFLICT DO NOTHING): a new calendar month inserts a fresh
    // row (used:0, limit set); a re-delivered invoice.paid in the same month is a
    // no-op, preserving accrued `used` + `limit`.
    const { error: upsertErr } = await db.from("usage_counters").upsert(
      {
        tenant_id,
        feature_key: "voice_calls",
        period_start: start,
        period_end: end,
        used: 0,
        limit_amount: monthly_call_allowance,
      },
      { onConflict: "tenant_id,feature_key,period_start", ignoreDuplicates: true },
    );
    if (upsertErr) throw new Error(`resetVoiceCallPool upsert failed: ${upsertErr.message}`);
    return true;
  };
}

/**
 * Real `BillingDeps` for the webhook: service-role DB writes (billing mirrors
 * are cross-tenant + RLS-protected, so the service-role key is required) and
 * Resend email. Built per-request so there's no shared mutable client.
 */
export function buildBillingDeps(): BillingDeps {
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  return {
    async upsertSubscription(row) {
      const { error } = await db
        .from("subscriptions")
        .upsert(row, { onConflict: "stripe_sub_id" });
      // Throw on a real DB error so the webhook route returns 500, releases the
      // idempotency claim, and Stripe retries. The upsert is idempotent, so a
      // retry is safe.
      if (error) throw new Error(`upsertSubscription failed: ${error.message}`);
    },

    async updateNewModelSubscription(out) {
      const { error } = await db
        .from(out.table)
        .update(out.update)
        .eq("stripe_subscription_id", out.stripe_subscription_id);
      if (error) throw new Error(`updateNewModelSubscription failed: ${error.message}`);
    },

    resetVoiceCallPool: buildResetVoiceCallPool(db),

    async markSetupFeePaid(stripeInvoiceId) {
      const { data: fee, error } = await db
        .from("setup_fees")
        .update({ paid_at: new Date().toISOString() })
        .eq("stripe_invoice_id", stripeInvoiceId)
        .select("tenant_id, currency")
        .maybeSingle();
      // Throw on a DB error (retryable); a missing row is NOT an error, it just
      // means this invoice isn't a tracked setup fee, so return null and ack.
      if (error) throw new Error(`markSetupFeePaid failed: ${error.message}`);
      if (!fee) return null;
      const tenantId = (fee as { tenant_id: string }).tenant_id;
      await db.from("tenants").update({ setup_fee_paid: true }).eq("id", tenantId);
      const { data: tenant } = await db
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .maybeSingle();
      return {
        tenantName: (tenant as { name?: string } | null)?.name ?? "your organisation",
        currency: ((fee as { currency?: string }).currency ?? "GBP") as Currency,
      };
    },

    async sendPaymentFailedEmail(info) {
      const body = paymentFailedEmail({
        tenantName: "your organisation",
        amountMajor: info.amountMajor,
        currency: info.currency,
        invoiceUrl: info.invoiceUrl,
      });
      const recipients = [env.RESEND_FROM_EMAIL];
      if (info.customerEmail) recipients.push(info.customerEmail);
      await sendEmail({ to: recipients, subject: body.subject, html: body.html, text: body.text });
    },
  };
}
