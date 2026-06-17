"use server";

import "server-only";
import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { getStripe } from "@/lib/billing/stripe";
import {
  buildNewSetupInvoiceItemParams,
  buildProductSubscriptionParams,
  minorUnits,
} from "@/lib/billing/plan-price";
import { subscriptionToMirror } from "@/lib/billing/event-map";
import { planActivationCharges } from "@/lib/billing/activation-charges";
import { commercialModelLabel } from "@/lib/billing/pricing";
import { sendEmail } from "@/lib/email/resend";
import { activationInvoiceEmail } from "@/lib/email/templates";
import { toStripeCountry } from "@/lib/billing/country";
import { unixToIso } from "@/lib/billing/dates";
import type { Currency } from "@/lib/marketing/pricing";

const idSchema = z.string().uuid();

function db() {
  return createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

type TenantBillingRow = {
  id: string;
  name: string;
  currency: Currency;
  country: string;
  contact_email: string | null;
  stripe_customer_id: string | null;
  billing_bypass: boolean;
};

async function loadTenant(tenantId: string): Promise<TenantBillingRow> {
  const { data, error } = await db()
    .from("tenants")
    .select(
      "id, name, currency, country, contact_email, stripe_customer_id, billing_bypass",
    )
    .eq("id", tenantId)
    .single();
  if (error || !data) throw new Error("Tenant not found.");
  return data as TenantBillingRow;
}

export async function getOrCreateStripeCustomer(tenant: TenantBillingRow): Promise<string> {
  if (tenant.stripe_customer_id) return tenant.stripe_customer_id;
  const customer = await getStripe().customers.create({
    name: tenant.name,
    email: tenant.contact_email ?? undefined,
    address: { country: toStripeCountry(tenant.country) },
    metadata: { tenant_id: tenant.id },
  });
  await db().from("tenants").update({ stripe_customer_id: customer.id }).eq("id", tenant.id);
  return customer.id;
}

async function getOrCreateProduct(): Promise<string> {
  const products = await getStripe().products.search({
    query: 'metadata["bookmycab"]:"automation"',
    limit: 1,
  });
  if (products.data[0]) return products.data[0].id;
  const product = await getStripe().products.create({
    name: "BookMyCab Automation",
    metadata: { bookmycab: "automation" },
  });
  return product.id;
}

type NewModelSubRow = {
  monthly_price_gbp: number;
  stripe_subscription_id: string | null;
};

/**
 * Issue the activation invoice (setup fee + first period) for a NEW-model
 * tenant and email the tenant the Stripe hosted-invoice pay link.
 *
 * Recurring: create one subscription per product with the setup fee folded into
 * the FIRST invoice (a pending invoice item is pulled onto the first
 * subscription invoice), collection_method=send_invoice so the first invoice is
 * payable by link. One-time pack: a single invoice with the pack + setup as line
 * items. Idempotent: products with a stripe_subscription_id are skipped; a
 * setup_fees row that already carries a stripe_invoice_id is not re-invoiced.
 * Bypassed / non-onboarding tenants no-op (comped locally / handled elsewhere).
 */
export async function issueActivationInvoice(tenantId: string): Promise<void> {
  const claims = await requireStaff();
  const id = idSchema.parse(tenantId);

  const { data: tenant, error: tenantErr } = await db()
    .from("tenants")
    .select(
      "id, name, currency, country, contact_email, stripe_customer_id, billing_bypass, commercial_model, status",
    )
    .eq("id", id)
    .single();
  if (tenantErr || !tenant) throw new Error("Tenant not found.");
  const t = tenant as TenantBillingRow & { commercial_model: string | null; status: string };
  if (!t.commercial_model || t.status !== "onboarding" || t.billing_bypass) return;

  const [{ data: chatRow }, { data: voiceRow }, { data: setupFee }, { data: customRow }] =
    await Promise.all([
      db().from("chat_subscriptions").select("monthly_price_gbp, stripe_subscription_id").eq("tenant_id", id).maybeSingle(),
      db().from("voice_subscriptions").select("monthly_price_gbp, stripe_subscription_id").eq("tenant_id", id).maybeSingle(),
      db().from("setup_fees").select("id, amount, stripe_invoice_id, hosted_invoice_url").eq("tenant_id", id).maybeSingle(),
      db().from("custom_plans").select("billing_mode").eq("tenant_id", id).maybeSingle(),
    ]);

  const chat = (chatRow as NewModelSubRow | null) ?? null;
  const voice = (voiceRow as NewModelSubRow | null) ?? null;
  const fee = setupFee as { id: string; amount: number; stripe_invoice_id: string | null; hosted_invoice_url: string | null } | null;
  const billingMode = ((customRow as { billing_mode?: string } | null)?.billing_mode ?? "recurring") as "recurring" | "one_time";

  const customerId = await getOrCreateStripeCustomer(t);
  const stripe = getStripe();

  const plan = planActivationCharges({ billingMode, setupGbp: fee?.amount ?? 0, chat, voice });

  let hostedInvoiceUrl = fee?.hosted_invoice_url ?? null;

  if (plan.mode === "recurring") {
    // Fold the setup fee into the first subscription invoice as a pending item.
    if (plan.setupGbp > 0 && fee && !fee.stripe_invoice_id) {
      await stripe.invoiceItems.create(
        buildNewSetupInvoiceItemParams({ customerId, setupGbp: plan.setupGbp, tenantId: id }),
      );
    }
    const productId = plan.subscriptions.length > 0 ? await getOrCreateProduct() : null;
    for (const planned of plan.subscriptions) {
      const baseParams = buildProductSubscriptionParams({
        customerId,
        productId: productId as string,
        product: planned.product,
        monthlyGbp: planned.monthlyGbp,
        tenantId: id,
      });
      const sub = await stripe.subscriptions.create({
        ...baseParams,
        collection_method: "send_invoice",
        days_until_due: 7,
      });
      const item = sub.items?.data?.[0];
      const table = planned.product === "chat" ? "chat_subscriptions" : "voice_subscriptions";
      await db()
        .from(table)
        .update({
          stripe_subscription_id: sub.id,
          current_period_start: unixToIso(item?.current_period_start ?? null),
          current_period_end: unixToIso(item?.current_period_end ?? null),
        })
        .eq("tenant_id", id);

      // Capture the first invoice's hosted URL (the one the setup fee folds in).
      const latest =
        typeof sub.latest_invoice === "string"
          ? await stripe.invoices.retrieve(sub.latest_invoice)
          : (sub.latest_invoice as Stripe.Invoice | null);
      if (latest?.id) {
        if (latest.status === "draft") await stripe.invoices.finalizeInvoice(latest.id);
        const finalised = await stripe.invoices.retrieve(latest.id);
        hostedInvoiceUrl = finalised.hosted_invoice_url ?? hostedInvoiceUrl;
        if (fee && !fee.stripe_invoice_id) {
          await db().from("setup_fees").update({ stripe_invoice_id: latest.id }).eq("id", fee.id);
        }
      }
    }
  } else {
    // One-time pack: a single invoice with pack + setup line items.
    if (fee && !fee.stripe_invoice_id) {
      for (const line of plan.oneTimeLines) {
        await stripe.invoiceItems.create({
          customer: customerId,
          amount: minorUnits(line.amountGbp),
          currency: "gbp",
          description: line.label,
          metadata: { tenant_id: id },
        });
      }
      if (plan.setupGbp > 0) {
        await stripe.invoiceItems.create(
          buildNewSetupInvoiceItemParams({ customerId, setupGbp: plan.setupGbp, tenantId: id }),
        );
      }
      const invoice = await stripe.invoices.create({
        customer: customerId,
        collection_method: "send_invoice",
        days_until_due: 7,
        automatic_tax: { enabled: true },
        metadata: { tenant_id: id, kind: "activation_pack" },
      });
      if (!invoice.id) throw new Error("Stripe did not return an invoice id.");
      await stripe.invoices.finalizeInvoice(invoice.id);
      const finalised = await stripe.invoices.retrieve(invoice.id);
      hostedInvoiceUrl = finalised.hosted_invoice_url ?? hostedInvoiceUrl;
      await db().from("setup_fees").update({ stripe_invoice_id: invoice.id }).eq("id", fee.id);
    }
  }

  // Persist the hosted invoice URL + email the tenant the pay link.
  if (hostedInvoiceUrl && fee) {
    await db().from("setup_fees").update({ hosted_invoice_url: hostedInvoiceUrl }).eq("id", fee.id);
    const amountMajor =
      Number(chat?.monthly_price_gbp ?? 0) + Number(voice?.monthly_price_gbp ?? 0) + (plan.setupGbp ?? 0);
    if (t.contact_email) {
      const body = activationInvoiceEmail({
        tenantName: t.name,
        planLabel: commercialModelLabel(t.commercial_model),
        amountMajor,
        currency: (t.currency ?? "GBP") as Currency,
        invoiceUrl: hostedInvoiceUrl,
      });
      await sendEmail({ to: t.contact_email, subject: body.subject, html: body.html, text: body.text });
    }
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: id,
    action: "tenant.activation_invoice",
    targetType: "tenant",
    targetId: id,
    metadata: {
      mode: plan.mode,
      subscriptions: plan.subscriptions.map((s) => s.product),
      invoiced: !!hostedInvoiceUrl,
    },
  });

  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin/billing");
}

export async function syncSubscription(tenantId: string): Promise<void> {
  const claims = await requireStaff();
  const id = idSchema.parse(tenantId);
  const tenant = await loadTenant(id);
  if (!tenant.stripe_customer_id) return;

  const subs = await getStripe().subscriptions.list({
    customer: tenant.stripe_customer_id,
    status: "all",
    limit: 10,
  });
  for (const sub of subs.data) {
    const row = subscriptionToMirror(sub);
    row.tenant_id = row.tenant_id ?? id;
    await db().from("subscriptions").upsert(row, { onConflict: "stripe_sub_id" });
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: id,
    action: "billing.sync",
    targetType: "tenant",
    targetId: id,
    metadata: { count: subs.data.length },
  });

  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin/billing");
}
