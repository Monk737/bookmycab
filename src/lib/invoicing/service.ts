import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { computeInvoice, type InvoiceBooking } from "./compute";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface AccountRow { id: string; name: string; billing_email: string | null; credit_terms: number; markup_pct: number; active: boolean }
export interface InvoiceRow { id: string; account_customer_id: string; period_start: string; period_end: string; subtotal: number; markup: number; total: number; currency: string; status: string; issued_at: string | null; created_at: string }

export async function listAccounts(tenantId: string): Promise<AccountRow[]> {
  const { data } = await svc().from("account_customers").select("id, name, billing_email, credit_terms, markup_pct, active").eq("tenant_id", tenantId).order("name");
  return (data ?? []) as AccountRow[];
}

export async function createAccount(tenantId: string, input: { name: string; billingEmail?: string; creditTerms?: number; markupPct?: number }): Promise<void> {
  await svc().from("account_customers").insert({
    tenant_id: tenantId, name: input.name, billing_email: input.billingEmail ?? null,
    credit_terms: input.creditTerms ?? 30, markup_pct: input.markupPct ?? 0,
  });
}

export async function updateAccount(tenantId: string, accountId: string, patch: { name?: string; billingEmail?: string | null; creditTerms?: number; markupPct?: number; active?: boolean }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.billingEmail !== undefined) update.billing_email = patch.billingEmail;
  if (patch.creditTerms !== undefined) update.credit_terms = patch.creditTerms;
  if (patch.markupPct !== undefined) update.markup_pct = patch.markupPct;
  if (patch.active !== undefined) update.active = patch.active;
  await svc().from("account_customers").update(update).eq("tenant_id", tenantId).eq("id", accountId);
}

export async function deleteAccount(tenantId: string, accountId: string): Promise<void> {
  await svc().from("account_customers").delete().eq("tenant_id", tenantId).eq("id", accountId);
}

export async function listInvoices(tenantId: string): Promise<InvoiceRow[]> {
  const { data } = await svc().from("tenant_invoices").select("id, account_customer_id, period_start, period_end, subtotal, markup, total, currency, status, issued_at, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as InvoiceRow[];
}

/**
 * Generate a draft invoice for an account over [periodStart, periodEnd]:
 * aggregate that account's bookings in the window, apply its markup, persist.
 * Returns the new invoice id (or null when there are no bookings).
 */
export async function generateInvoice(tenantId: string, accountId: string, periodStart: string, periodEnd: string): Promise<{ id: string | null; total: number }> {
  const sb = svc();
  const { data: account } = await sb.from("account_customers").select("markup_pct").eq("tenant_id", tenantId).eq("id", accountId).maybeSingle();
  if (!account) return { id: null, total: 0 };
  const markupPct = Number(account.markup_pct ?? 0);

  const { data: bookings } = await sb
    .from("bookings")
    .select("id, passenger_name, fare, created_at, currency")
    .eq("tenant_id", tenantId)
    .eq("account_customer_id", accountId)
    .gte("created_at", `${periodStart}T00:00:00Z`)
    .lte("created_at", `${periodEnd}T23:59:59Z`);
  const rows = (bookings ?? []) as (InvoiceBooking & { currency: string | null })[];
  if (rows.length === 0) return { id: null, total: 0 };

  const computed = computeInvoice(rows, markupPct);
  const currency = rows[0].currency ?? "GBP";
  const { data: inserted } = await sb.from("tenant_invoices").insert({
    tenant_id: tenantId, account_customer_id: accountId, period_start: periodStart, period_end: periodEnd,
    line_items: computed.lineItems, subtotal: computed.subtotal, markup: computed.markup, total: computed.total,
    currency, status: "draft",
  }).select("id").single();
  return { id: (inserted?.id as string) ?? null, total: computed.total };
}

export async function setInvoiceStatus(tenantId: string, invoiceId: string, status: "issued" | "paid" | "void"): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "issued") patch.issued_at = new Date().toISOString();
  await svc().from("tenant_invoices").update(patch).eq("tenant_id", tenantId).eq("id", invoiceId);
}
