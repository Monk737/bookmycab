/**
 * Sandbox proof: create a REAL Stripe (test-mode) activation invoice using the
 * exact code path issueActivationInvoice uses — planActivationCharges + the
 * plan-price param builders — for a sample Custom recurring AI Voice plan.
 * Prints the hosted-invoice pay link so it can be paid with a test card.
 *
 * Run: npx tsx scripts/sandbox-activation-invoice.ts
 * No DB writes; Stripe test mode only (reads sk_test_ from .env.local).
 */
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { planActivationCharges } from "../src/lib/billing/activation-charges";
import {
  buildNewSetupInvoiceItemParams,
  buildProductSubscriptionParams,
} from "../src/lib/billing/plan-price";

function envFromDotLocal(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      if (t.slice(0, i).trim() === key) return t.slice(i + 1).trim();
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

async function main() {
  const secret = envFromDotLocal("STRIPE_SECRET_KEY");
  if (!secret) throw new Error("STRIPE_SECRET_KEY not found in env or .env.local");
  if (!secret.startsWith("sk_test_")) {
    throw new Error(`Refusing to run against a non-test key (prefix ${secret.slice(0, 8)}…). This script is sandbox-only.`);
  }
  const stripe = new Stripe(secret);

  // Sample Custom (Full Throttle) recurring AI Voice plan — the kind admin would
  // configure after a discovery call.
  const tenantLabel = "Sandbox Test Cabs (Full Throttle)";
  const setupGbp = 1000;
  const voiceMonthlyGbp = 2500; // custom pack monthly price

  const customer = await stripe.customers.create({
    name: tenantLabel,
    email: "sandbox-activation@bookmycab.test",
    address: { country: "GB" },
    metadata: { bookmycab: "sandbox-activation-test" },
  });

  const product = await stripe.products.create({
    name: "BookMyCab Automation (sandbox test)",
    metadata: { bookmycab: "automation-sandbox" },
  });

  const plan = planActivationCharges({
    billingMode: "recurring",
    setupGbp,
    chat: null,
    voice: { monthly_price_gbp: voiceMonthlyGbp, stripe_subscription_id: null },
  });

  // Fold the one-time setup fee into the first subscription invoice.
  if (plan.setupGbp > 0) {
    await stripe.invoiceItems.create(
      buildNewSetupInvoiceItemParams({ customerId: customer.id, setupGbp: plan.setupGbp, tenantId: "sandbox" }),
    );
  }

  let hostedUrl: string | null = null;
  let invoiceTotalMinor = 0;
  for (const planned of plan.subscriptions) {
    const params = buildProductSubscriptionParams({
      customerId: customer.id,
      productId: product.id,
      product: planned.product,
      monthlyGbp: planned.monthlyGbp,
      tenantId: "sandbox",
    });
    const sub = await stripe.subscriptions.create({
      ...params,
      // automatic_tax disabled here so a fresh sandbox without a tax origin
      // doesn't reject the invoice; the in-app action enables it with config.
      automatic_tax: { enabled: false },
      collection_method: "send_invoice",
      days_until_due: 7,
    });
    const latestId =
      typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id ?? null;
    if (latestId) {
      const draft = await stripe.invoices.retrieve(latestId);
      if (draft.status === "draft") await stripe.invoices.finalizeInvoice(latestId);
      const fin = await stripe.invoices.retrieve(latestId);
      hostedUrl = fin.hosted_invoice_url ?? hostedUrl;
      invoiceTotalMinor = fin.total ?? 0;
    }
  }

  console.log("\n================ SANDBOX ACTIVATION INVOICE ================");
  console.log("Tenant       :", tenantLabel);
  console.log("Plan         : Custom recurring AI Voice — £" + voiceMonthlyGbp + "/mo");
  console.log("Setup fee    : £" + setupGbp + " (folded into first invoice)");
  console.log("Invoice total: £" + (invoiceTotalMinor / 100).toFixed(2));
  console.log("Customer     :", customer.id);
  console.log("Pay with test card 4242 4242 4242 4242, any future expiry/CVC.");
  console.log("PAY LINK     :", hostedUrl);
  console.log("===========================================================\n");
}

main().catch((err) => {
  console.error("sandbox-activation-invoice failed:", err);
  process.exit(1);
});
