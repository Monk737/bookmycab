import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { fromMinor } from "@/lib/billing/plan-price";

export interface OpenInvoiceRow {
  id: string;
  amountGbp: number;
  hostedUrl: string | null;
  dueDate: string | null; // YYYY-MM-DD
}

/** Pure Stripe.Invoice → dashboard row. */
export function mapStripeInvoiceRow(inv: Stripe.Invoice): OpenInvoiceRow {
  return {
    id: inv.id ?? "",
    amountGbp: fromMinor(inv.amount_due ?? 0),
    hostedUrl: inv.hosted_invoice_url ?? null,
    dueDate: typeof inv.due_date === "number" ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : null,
  };
}

/** A tenant's currently payable (open) invoices — renewals awaiting payment. */
export async function getOpenInvoices(customerId: string): Promise<OpenInvoiceRow[]> {
  try {
    const list = await getStripe().invoices.list({ customer: customerId, status: "open", limit: 12 });
    return list.data.map(mapStripeInvoiceRow);
  } catch (err) {
    console.error("getOpenInvoices failed", err);
    return [];
  }
}

/** Whether the customer has a default payment method (autopay active). */
export async function getAutopayEnabled(customerId: string): Promise<boolean> {
  try {
    const customer = await getStripe().customers.retrieve(customerId);
    if (customer.deleted) return false;
    return Boolean(customer.invoice_settings?.default_payment_method);
  } catch (err) {
    console.error("getAutopayEnabled failed", err);
    return false;
  }
}
