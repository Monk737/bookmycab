"use server";

import "server-only";
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
} from "@/lib/billing/plan-price";
import { subscriptionToMirror } from "@/lib/billing/event-map";
import { planNewModelCharges } from "@/lib/billing/new-model-charges";
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
 * Start billing for a NEW-MODEL tenant (commercial_model set): one GBP setup
 * invoice + one rolling-monthly GBP subscription per product (chat + voice).
 *
 * Idempotent: a product with an existing `stripe_subscription_id` is skipped by
 * `planNewModelCharges`, and the setup invoice is only created when none is
 * recorded yet. Re-running creates only the missing pieces. Legacy tenants
 * (`commercial_model` null) are handled by the legacy actions above; this
 * no-ops for them and for tenants already past onboarding.
 */
export async function startNewModelBilling(tenantId: string): Promise<void> {
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

  const t = tenant as TenantBillingRow & {
    commercial_model: string | null;
    status: string;
  };

  // Only applies to new-model tenants still in onboarding. A bypassed tenant is
  // comped locally (no Stripe), and a legacy tenant uses the legacy actions.
  if (!t.commercial_model || t.status !== "onboarding" || t.billing_bypass) return;

  const [{ data: chatRow }, { data: voiceRow }, { data: setupFee }] = await Promise.all([
    db()
      .from("chat_subscriptions")
      .select("monthly_price_gbp, stripe_subscription_id")
      .eq("tenant_id", id)
      .maybeSingle(),
    db()
      .from("voice_subscriptions")
      .select("monthly_price_gbp, stripe_subscription_id")
      .eq("tenant_id", id)
      .maybeSingle(),
    db()
      .from("setup_fees")
      .select("id, amount, stripe_invoice_id")
      .eq("tenant_id", id)
      .maybeSingle(),
  ]);

  const chat = (chatRow as NewModelSubRow | null) ?? null;
  const voice = (voiceRow as NewModelSubRow | null) ?? null;
  const fee = setupFee as { id: string; amount: number; stripe_invoice_id: string | null } | null;

  const customerId = await getOrCreateStripeCustomer(t);
  const stripe = getStripe();

  const plan = planNewModelCharges({
    tenant: { id: t.id, commercial_model: t.commercial_model, stripe_customer_id: customerId },
    chat,
    voice,
    setupGbp: fee?.amount ?? 0,
  });

  // One-time setup invoice — only when there is a fee to charge and none has
  // been invoiced yet (idempotent re-run guard).
  if (plan.setup.setupGbp > 0 && fee && !fee.stripe_invoice_id) {
    await stripe.invoiceItems.create(
      buildNewSetupInvoiceItemParams({
        customerId,
        setupGbp: plan.setup.setupGbp,
        tenantId: id,
      }),
    );
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: 7,
      automatic_tax: { enabled: true },
      metadata: { tenant_id: id, kind: "setup_fee" },
    });
    if (!invoice.id) throw new Error("Stripe did not return an invoice id.");
    await stripe.invoices.finalizeInvoice(invoice.id);
    await db().from("setup_fees").update({ stripe_invoice_id: invoice.id }).eq("id", fee.id);
  }

  // One rolling-monthly subscription per planned product.
  const productId = plan.subscriptions.length > 0 ? await getOrCreateProduct() : null;
  for (const planned of plan.subscriptions) {
    const sub = await stripe.subscriptions.create(
      buildProductSubscriptionParams({
        customerId,
        productId: productId as string,
        product: planned.product,
        monthlyGbp: planned.monthlyGbp,
        tenantId: id,
      }),
    );
    // Stripe Basil moved current_period_* onto the subscription item; read from
    // the first item exactly as `subscriptionToMirror` does. The webhook will
    // also reconcile these via `mapNewModelSubscription`.
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
  }

  await db().from("tenants").update({ status: "active" }).eq("id", id);

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: id,
    action: "tenant.billing_start",
    targetType: "tenant",
    targetId: id,
    metadata: {
      setup_invoiced: plan.setup.setupGbp > 0 && !!fee && !fee.stripe_invoice_id,
      subscriptions_created: plan.subscriptions.map((s) => s.product),
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
