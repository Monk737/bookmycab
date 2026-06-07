import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import type { BillingDeps } from "@/lib/billing/handle-event";
import { sendEmail } from "@/lib/email/resend";
import { paymentFailedEmail } from "@/lib/email/templates";
import type { Currency } from "@/lib/marketing/pricing";

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
