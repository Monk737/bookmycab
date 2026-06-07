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
  buildSetupInvoiceItemParams,
  buildSubscriptionCreateParams,
} from "@/lib/billing/plan-price";
import { subscriptionToMirror } from "@/lib/billing/event-map";
import { toStripeCountry } from "@/lib/billing/country";
import { addMonthsUTC } from "@/lib/billing/dates";
import { CONTRACT_MONTHS, SETUP_FEE, type Currency } from "@/lib/marketing/pricing";
import type { PlanBand } from "@/lib/admin/plan-bands";

const idSchema = z.string().uuid();

function db() {
  return createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

type TenantBillingRow = {
  id: string;
  name: string;
  currency: Currency;
  plan_band: PlanBand;
  country: string;
  contact_email: string | null;
  stripe_customer_id: string | null;
  billing_bypass: boolean;
};

async function loadTenant(tenantId: string): Promise<TenantBillingRow> {
  const { data, error } = await db()
    .from("tenants")
    .select(
      "id, name, currency, plan_band, country, contact_email, stripe_customer_id, billing_bypass",
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

export async function createSetupFeeInvoice(tenantId: string): Promise<void> {
  const claims = await requireStaff();
  const id = idSchema.parse(tenantId);
  const tenant = await loadTenant(id);
  if (tenant.billing_bypass) {
    throw new Error("Billing is bypassed for this tenant (100%-off coupon); no setup fee is charged.");
  }

  const customerId = await getOrCreateStripeCustomer(tenant);
  const stripe = getStripe();

  await stripe.invoiceItems.create(
    buildSetupInvoiceItemParams({ customerId, currency: tenant.currency }),
  );
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 14,
    automatic_tax: { enabled: true },
    metadata: { tenant_id: id, kind: "setup_fee" },
  });
  if (!invoice.id) throw new Error("Stripe did not return an invoice id.");
  await stripe.invoices.finalizeInvoice(invoice.id);

  const { data: existing } = await db()
    .from("setup_fees")
    .select("id")
    .eq("tenant_id", id)
    .is("paid_at", null)
    .maybeSingle();
  // The setup-fee amount is the canonical §6.1 figure for the tenant's currency;
  // persist it so the admin pipeline / invoice tables report a real number (not
  // null → 0). Stripe is the payment ledger; this column is our local mirror.
  const setupAmount = SETUP_FEE[tenant.currency];
  if (existing) {
    await db()
      .from("setup_fees")
      .update({ stripe_invoice_id: invoice.id, amount: setupAmount })
      .eq("id", (existing as { id: string }).id);
  } else {
    await db().from("setup_fees").insert({
      tenant_id: id,
      stripe_invoice_id: invoice.id,
      amount: setupAmount,
      currency: tenant.currency,
      paid_at: null,
    });
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: id,
    action: "billing.setup_fee_invoiced",
    targetType: "tenant",
    targetId: id,
    metadata: { stripe_invoice_id: invoice.id },
  });

  revalidatePath(`/admin/tenants/${id}`);
}

export async function startSubscription(tenantId: string): Promise<void> {
  const claims = await requireStaff();
  const id = idSchema.parse(tenantId);
  const tenant = await loadTenant(id);
  if (tenant.billing_bypass) {
    throw new Error("Billing is bypassed for this tenant (100%-off coupon); the subscription is comped.");
  }

  const customerId = await getOrCreateStripeCustomer(tenant);
  const productId = await getOrCreateProduct();

  const sub = await getStripe().subscriptions.create(
    buildSubscriptionCreateParams({
      customerId,
      productId,
      band: tenant.plan_band,
      currency: tenant.currency,
      tenantId: id,
    }),
  );

  const today = new Date().toISOString().slice(0, 10);
  const renewal = addMonthsUTC(today, CONTRACT_MONTHS);
  const mirror = subscriptionToMirror(sub);
  await db().from("subscriptions").upsert(mirror, { onConflict: "stripe_sub_id" });
  await db()
    .from("tenants")
    .update({
      status: "active",
      contract_start: today,
      contract_renewal: renewal,
      monthly_price: mirror.monthly_price,
    })
    .eq("id", id);

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: id,
    action: "billing.subscription_started",
    targetType: "tenant",
    targetId: id,
    metadata: { stripe_sub_id: sub.id, contract_renewal: renewal },
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
