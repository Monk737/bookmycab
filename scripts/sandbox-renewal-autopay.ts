/**
 * Sandbox proof for the £2 base credit + autopay auto-charge. Test mode only.
 * Run: npx tsx scripts/sandbox-renewal-autopay.ts
 *
 * Proves: (a) base credit prices at £2/credit; (b) a custom rate prices
 * differently; (c) a charge_automatically subscription with a saved test card
 * auto-pays its first invoice (i.e. autopay renewals auto-charge).
 */
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { creditsForGbpAt, CREDIT_UNIT_GBP } from "../src/lib/billing/credit";

function env(key: string): string | undefined {
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
  const secret = env("STRIPE_SECRET_KEY");
  if (!secret?.startsWith("sk_test_")) throw new Error("sandbox-only: need an sk_test_ key in .env.local");
  const stripe = new Stripe(secret);

  // (a) + (b) pure credit maths
  console.log("\n--- credit pricing ---");
  console.log("base £20 top-up  →", creditsForGbpAt(20, CREDIT_UNIT_GBP), "credits (expect 10 @ £2 base)");
  console.log("custom £20 @£0.75 →", creditsForGbpAt(20, 0.75), "credits (expect 26)");

  // (c) autopay auto-charge: customer + saved test card + charge_automatically sub
  const customer = await stripe.customers.create({
    name: "Sandbox Autopay Cabs",
    email: "sandbox-autopay@bookmycab.test",
    address: { country: "GB" },
    metadata: { bookmycab: "sandbox-autopay" },
  });
  const pm = await stripe.paymentMethods.create({ type: "card", card: { token: "tok_visa" } });
  await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });

  const product = await stripe.products.create({
    name: "BookMyCab Automation (sandbox autopay)",
    metadata: { bookmycab: "automation-sandbox" },
  });
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    collection_method: "charge_automatically",
    items: [{ price_data: { currency: "gbp", product: product.id, unit_amount: 49900, recurring: { interval: "month" } } }],
    metadata: { tenant_id: "sandbox", product: "chat" },
  });
  const latestId =
    typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id ?? null;
  const inv = latestId ? await stripe.invoices.retrieve(latestId) : null;

  console.log("\n--- autopay subscription ---");
  console.log("collection_method  :", sub.collection_method, "(expect charge_automatically)");
  console.log("first invoice status:", inv?.status, "(expect 'paid' — auto-charged the saved test card)");
  console.log("invoice total      : £" + ((inv?.total ?? 0) / 100).toFixed(2));
  console.log("customer           :", customer.id);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
