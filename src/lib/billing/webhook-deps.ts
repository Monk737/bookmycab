import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import type { BillingDeps } from "@/lib/billing/handle-event";
import { periodBounds } from "@/lib/entitlements/meter";
import { getStripe } from "@/lib/billing/stripe";
import { sendEmail } from "@/lib/email/resend";
import { paymentFailedEmail, paymentReceivedEmail } from "@/lib/email/templates";
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

/** Unit price of a single voice top-up credit, in micros (base £2 → 2,000,000).
 *  Custom-plan top-ups pass their own price via session metadata. */
const TOPUP_UNIT_PRICE_MICROS = 2_000_000;

/**
 * Build the credit top-up grant operation against a Supabase-like client. On a
 * completed `topup_purchase` Checkout session, INSERTs a `credit_ledger` row
 * (the ledger is append-only — a trigger blocks UPDATE/DELETE), guarded by a
 * pre-insert SELECT on `stripe_payment_intent_id` so a re-delivered webhook is a
 * no-op. When a coupon code is present, best-effort records a `coupon_redemptions`
 * row and bumps the coupon's `times_redeemed`. Exported for unit testing.
 */
export function buildGrantTopupCredits(
  db: SupabaseLike,
): BillingDeps["grantTopupCredits"] {
  return async ({ sessionId, paymentIntentId, tenantId, credits, couponCode, unitPriceMicros }) => {
    // Idempotency: the ledger is append-only, so we cannot upsert-on-conflict.
    // A SELECT on the payment-intent id catches a re-delivered webhook.
    const { data: existing, error: lookupErr } = await db
      .from("credit_ledger")
      .select("id")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
    if (lookupErr) throw new Error(`grantTopupCredits lookup failed: ${lookupErr.message}`);
    if (existing) return; // already granted

    const { error: insertErr } = await db.from("credit_ledger").insert({
      tenant_id: tenantId,
      delta: credits,
      reason: "topup_purchase",
      unit_price_micros: unitPriceMicros ?? TOPUP_UNIT_PRICE_MICROS,
      currency: "GBP",
      stripe_payment_intent_id: paymentIntentId,
    });
    if (insertErr) {
      // 23505 = unique-violation on the partial index credit_ledger_topup_pi_uniq
      // (migration 0042): a concurrent delivery already granted this payment.
      // Treat as already-granted (idempotent) rather than failing the webhook.
      if ((insertErr as { code?: string }).code === "23505") return;
      throw new Error(`grantTopupCredits insert failed: ${insertErr.message}`);
    }

    // Best-effort coupon redemption: a failure here must not fail the webhook
    // (the credits are already granted), so log and move on.
    if (couponCode) {
      try {
        const code = couponCode.trim().toUpperCase();
        const { data: coupon, error: couponErr } = await db
          .from("coupons")
          .select("id, times_redeemed")
          .eq("code", code)
          .maybeSingle();
        if (couponErr) throw new Error(couponErr.message);
        if (coupon) {
          const c = coupon as { id: string; times_redeemed: number };
          const { error: redemptionErr } = await db.from("coupon_redemptions").insert({
            coupon_id: c.id,
            tenant_id: tenantId,
            applied_to: "credit_topup",
            currency: "GBP",
            stripe_ref: sessionId,
          });
          if (redemptionErr) throw new Error(redemptionErr.message);
          const { error: bumpErr } = await db
            .from("coupons")
            .update({ times_redeemed: c.times_redeemed + 1 })
            .eq("id", c.id);
          if (bumpErr) throw new Error(bumpErr.message);
        }
      } catch (err) {
        console.error("grantTopupCredits coupon redemption failed (credits still granted)", err);
      }
    }
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

    grantTopupCredits: buildGrantTopupCredits(db),

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

    async setDefaultPaymentMethod({ customerId, setupIntentId }) {
      const stripe = getStripe();
      const si = await stripe.setupIntents.retrieve(setupIntentId);
      const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id ?? null;
      if (!pm) return; // nothing captured; nothing to set
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: pm },
      });
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

    async grantCustomPackPool(stripeInvoiceId) {
      // Find the tenant whose activation invoice this is.
      const { data: fee } = await db
        .from("setup_fees").select("tenant_id").eq("stripe_invoice_id", stripeInvoiceId).maybeSingle();
      const tenantId = (fee as { tenant_id?: string } | null)?.tenant_id;
      if (!tenantId) return;
      const { data: plan } = await db
        .from("custom_plans")
        .select("billing_mode, monthly_call_allowance, starts_at, expires_at")
        .eq("tenant_id", tenantId).maybeSingle();
      const p = plan as { billing_mode: string; monthly_call_allowance: number; starts_at: string | null; expires_at: string | null } | null;
      if (!p || p.billing_mode !== "one_time") return; // recurring handled by resetVoiceCallPool
      const start = p.starts_at ?? new Date().toISOString().slice(0, 10);
      const end = p.expires_at ?? start;
      // INSERT-ONLY: a re-delivered invoice.paid is a no-op.
      const { error } = await db.from("usage_counters").upsert(
        { tenant_id: tenantId, feature_key: "voice_calls", period_start: start, period_end: end, used: 0, limit_amount: p.monthly_call_allowance },
        { onConflict: "tenant_id,feature_key,period_start", ignoreDuplicates: true },
      );
      if (error) throw new Error(`grantCustomPackPool failed: ${error.message}`);
    },

    async enableAutopayRenewals({ customerId }) {
      const stripe = getStripe();
      const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 100 });
      for (const sub of subs.data) {
        // Only our product subscriptions; skip non-BookMyCab subs + any already
        // auto-charging.
        const product = sub.metadata?.product;
        if (product !== "chat" && product !== "voice") continue;
        if (sub.collection_method === "charge_automatically") continue;
        await stripe.subscriptions.update(sub.id, { collection_method: "charge_automatically" });
      }
    },

    async sendPaymentReceivedEmail(info) {
      // Receipts go to the customer only (no ops copy); skip when Stripe gave us
      // no email rather than mailing the from-address a receipt for nobody.
      if (!info.customerEmail) return;
      const body = paymentReceivedEmail({
        tenantName: "your organisation",
        amountMajor: info.amountMajor,
        currency: info.currency,
        periodLabel: info.periodLabel,
        invoiceUrl: info.invoiceUrl,
      });
      await sendEmail({ to: info.customerEmail, subject: body.subject, html: body.html, text: body.text });
    },
  };
}
