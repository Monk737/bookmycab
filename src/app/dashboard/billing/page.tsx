import { requireUser } from "@/lib/auth/session";
import { getBillingOverview } from "@/lib/dashboard/billing-queries";
import { commercialModelLabel } from "@/lib/billing/pricing";
import { DataTable } from "@/components/dashboard/data-table";
import { formatCurrency, formatDateTime } from "@/lib/dashboard/format";
import { createClient } from "@/lib/supabase/server";
import { periodBounds } from "@/lib/entitlements/meter";
import { CreditTopup } from "@/components/dashboard/credit-topup";
import { PortalButton } from "./portal-button";
import { AutopayButton } from "./autopay-button";
import { getOpenInvoices, getAutopayEnabled } from "@/lib/dashboard/open-invoices";
import Link from "next/link";

const TZ = "Europe/London";

/**
 * Loads the voice-credit panel data for a tenant — only present when the tenant
 * has a voice subscription. Returns null for chat-only tenants (no panel shown).
 */
async function getVoiceCreditPanel(
  tenantId: string,
): Promise<{ balance: number; remainingCalls: number; allowance: number } | null> {
  const supabase = await createClient();

  const { data: vsub } = await supabase
    .from("voice_subscriptions")
    .select("monthly_call_allowance")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!vsub) return null;

  const allowance = (vsub.monthly_call_allowance as number | null) ?? 0;

  const { start } = periodBounds("month", new Date());
  const [{ data: balanceData }, { data: usageRow }] = await Promise.all([
    supabase.rpc("credit_balance", { p_tenant: tenantId }),
    supabase
      .from("usage_counters")
      .select("used")
      .eq("tenant_id", tenantId)
      .eq("feature_key", "voice_calls")
      .eq("period_start", start)
      .maybeSingle(),
  ]);

  const balance = typeof balanceData === "number" ? balanceData : Number(balanceData ?? 0);
  const used = (usageRow?.used as number | null) ?? 0;
  const remainingCalls = Math.max(0, allowance - used);

  return { balance, remainingCalls, allowance };
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ credit?: string; autopay?: string }>;
}) {
  const claims = await requireUser();

  if (!claims.tenant_id) {
    return (
      <main className="p-8">
        <p className="text-sm text-gray-500">No organisation found for your account.</p>
      </main>
    );
  }

  const { credit, autopay } = await searchParams;
  const b = await getBillingOverview(claims.tenant_id);
  const voiceCredit = await getVoiceCreditPanel(claims.tenant_id);
  const openInvoices = b.stripeCustomerId ? await getOpenInvoices(b.stripeCustomerId) : [];
  const autopayOn = b.stripeCustomerId ? await getAutopayEnabled(b.stripeCustomerId) : false;

  type InvoiceRow = {
    id: string;
    description: string;
    amount: string;
    status: string;
    date: string;
  };

  const invoiceRows: InvoiceRow[] = [];
  if (b.setupFee) {
    invoiceRows.push({
      id: "setup",
      description: "Setup fee",
      amount: b.setupFee.amount != null && b.setupFee.currency
        ? formatCurrency(b.setupFee.amount, b.setupFee.currency)
        : "·",
      status: b.setupFee.paidAt ? "Paid" : "Pending",
      date: b.setupFee.paidAt ? formatDateTime(b.setupFee.paidAt, TZ) : "·",
    });
  }

  const currency = b.currency ?? "GBP";

  const TIER_LABEL: Record<string, string> = {
    ignition: "Ignition",
    in_motion: "In Motion",
    full_throttle: "Full Throttle",
  };
  const tierLabel = (t: string | null) => (t ? TIER_LABEL[t] ?? t : "·");
  const MODEL_LABEL: Record<string, string> = {
    chat: "Chat",
    voice: "AI Voice",
    double_decker: "Double Decker",
    custom: "Custom plan",
  };

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6 lg:p-8">
      <h1 className="font-mono text-xl font-bold text-ink">Billing</h1>

      {credit === "success" && (
        <p className="border-[3px] border-ink bg-brut-yellow p-4 text-sm font-bold text-ink shadow-brut-sm">
          Top-up complete. Your voice credit will appear here shortly.
        </p>
      )}
      {credit === "cancelled" && (
        <p className="border-[3px] border-ink bg-paper p-4 text-sm font-medium text-ink shadow-brut-sm">
          Top-up cancelled. No payment was taken.
        </p>
      )}
      {autopay === "success" && (
        <p className="border-[3px] border-ink bg-brut-lime p-4 text-sm font-bold text-ink shadow-brut-sm">
          Autopay is set up. Your monthly subscription will auto-charge this card each cycle.
        </p>
      )}
      {autopay === "cancelled" && (
        <p className="border-[3px] border-ink bg-paper p-4 text-sm font-medium text-ink shadow-brut-sm">
          Payment setup cancelled. No card was saved.
        </p>
      )}

      {b.activationInvoiceUrl && !b.setupFee?.paidAt && (
        <a
          href={b.activationInvoiceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block border-[3px] border-ink bg-brut-yellow p-4 text-sm font-bold text-ink shadow-brut-sm hover:bg-ink hover:text-paper"
        >
          Your activation invoice is ready — click to pay and go live →
        </a>
      )}

      {voiceCredit && (
        <CreditTopup
          orgId={claims.tenant_id}
          balance={voiceCredit.balance}
          remainingCalls={voiceCredit.remainingCalls}
          allowance={voiceCredit.allowance}
        />
      )}

      {/* Plan card */}
      <section
        aria-labelledby="plan-heading"
        className="border-[3px] border-ink bg-paper p-6 shadow-brut-sm"
      >
        <h2
          id="plan-heading"
          className="mb-4 flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500"
        >
          Current plan
          {b.commercialModel && (
            <span className="border-2 border-ink bg-brut-yellow px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em] text-ink">
              {MODEL_LABEL[b.commercialModel] ?? b.commercialModel}
            </span>
          )}
        </h2>

        {b.products ? (
          <>
            {/* New two-product model: one row per product + a combined total. */}
            <div className="overflow-hidden border-[3px] border-ink">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-gray-700">Product</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-700">Tier</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-700">Includes</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-700">Monthly</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-100">
                  {b.products.chat && (
                    <tr>
                      <td className="px-3 py-2 font-bold text-ink">Chat</td>
                      <td className="px-3 py-2 text-gray-700">{tierLabel(b.products.chat.tier)}</td>
                      <td className="px-3 py-2 text-gray-600">Multi-channel booking bot</td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-ink">{formatCurrency(b.products.chat.monthlyGbp, "GBP")}</td>
                    </tr>
                  )}
                  {b.products.voice && (
                    <tr>
                      <td className="px-3 py-2 font-bold text-ink">AI Voice</td>
                      <td className="px-3 py-2 text-gray-700">{tierLabel(b.products.voice.tier)}</td>
                      <td className="px-3 py-2 text-gray-600">{b.products.voice.allowance.toLocaleString("en-GB")} calls / month</td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-ink">{formatCurrency(b.products.voice.monthlyGbp, "GBP")}</td>
                    </tr>
                  )}
                  {b.custom && (
                    <tr>
                      <td className="px-3 py-2 font-bold text-ink">Custom</td>
                      <td className="px-3 py-2 text-gray-700">{b.custom.planName}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {b.custom.callAllowance.toLocaleString("en-GB")} calls
                        {b.custom.billingMode === "one_time" ? ` · valid ${b.custom.validityDays} days` : " / period"} ·
                        overage £{b.custom.extraCreditPriceGbp.toFixed(2)}/call
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-ink">{formatCurrency(b.custom.planPriceGbp, "GBP")}</td>
                    </tr>
                  )}
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 font-bold uppercase tracking-[0.04em] text-ink" colSpan={3}>Total / month</td>
                    <td className="px-3 py-2 text-right font-mono text-base font-extrabold tabular-nums text-ink">{formatCurrency(b.products.combinedMonthlyGbp, "GBP")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium text-gray-500">Billing</dt>
                <dd className="mt-0.5 text-sm font-bold text-ink">Rolling monthly · GBP</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500">Started</dt>
                <dd className="mt-0.5 text-sm text-gray-700">{b.contractStart ? formatDateTime(b.contractStart, TZ) : "·"}</dd>
              </div>
              {b.subscription?.status && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">Subscription status</dt>
                  <dd className="mt-0.5 text-sm capitalize text-gray-700">{b.subscription.status}</dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          /* No chat/voice product configured yet. */
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Product</dt>
              <dd className="mt-0.5 text-sm font-bold text-ink">{commercialModelLabel(b.commercialModel)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Monthly price</dt>
              <dd className="mt-0.5 text-sm font-bold text-ink">
                {b.monthlyPrice != null ? formatCurrency(b.monthlyPrice, currency) : "·"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Currency</dt>
              <dd className="mt-0.5 text-sm font-bold text-ink">{b.currency ?? "·"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Contract start</dt>
              <dd className="mt-0.5 text-sm text-gray-700">{b.contractStart ? formatDateTime(b.contractStart, TZ) : "·"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Contract renewal</dt>
              <dd className="mt-0.5 text-sm text-gray-700">{b.contractRenewal ? formatDateTime(b.contractRenewal, TZ) : "·"}</dd>
            </div>
            {b.subscription?.status && (
              <div>
                <dt className="text-xs font-medium text-gray-500">Subscription status</dt>
                <dd className="mt-0.5 text-sm capitalize text-gray-700">{b.subscription.status}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {/* Setup fee */}
      <section
        aria-labelledby="setup-heading"
        className="border-[3px] border-ink bg-paper p-6 shadow-brut-sm"
      >
        <h2
          id="setup-heading"
          className="mb-4 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500"
        >
          Setup fee
        </h2>
        {b.setupFee?.paidAt ? (
          <p className="text-sm text-gray-700">
            Paid ,{" "}
            <span className="font-bold text-ink">
              {b.setupFee.amount != null && b.setupFee.currency
                ? formatCurrency(b.setupFee.amount, b.setupFee.currency)
                : "·"}
            </span>{" "}
            on {formatDateTime(b.setupFee.paidAt, TZ)}
          </p>
        ) : (
          <p className="text-sm text-ink font-medium">Pending</p>
        )}
      </section>

      {/* Invoices */}
      <section
        aria-labelledby="invoices-heading"
        className="space-y-3"
      >
        <h2
          id="invoices-heading"
          className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500"
        >
          Invoices
        </h2>
        <DataTable<InvoiceRow>
          columns={[
            { key: "description", header: "Description", render: (r) => r.description },
            { key: "amount", header: "Amount", render: (r) => r.amount },
            { key: "status", header: "Status", render: (r) => r.status },
            { key: "date", header: "Date", render: (r) => r.date },
          ]}
          rows={invoiceRows}
          getRowKey={(r) => r.id}
          emptyMessage="No invoices yet."
        />
        <p className="text-xs text-gray-400">
          Monthly invoices appear once billing goes live.
        </p>
      </section>

      {openInvoices.length > 0 && (
        <section aria-labelledby="open-inv-heading" className="space-y-3">
          <h2 id="open-inv-heading" className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Invoices to pay
          </h2>
          <div className="divide-y-2 divide-gray-100 border-[3px] border-ink bg-paper">
            {openInvoices.map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono font-bold tabular-nums text-ink">{formatCurrency(inv.amountGbp, "GBP")}</p>
                  <p className="text-xs text-gray-500">{inv.dueDate ? `Due ${inv.dueDate}` : "Due now"}</p>
                </div>
                {inv.hostedUrl && (
                  <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer"
                    className="border-2 border-ink bg-brut-yellow px-4 py-2 text-sm font-bold uppercase text-ink hover:bg-ink hover:text-paper">
                    Pay now
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <section
        aria-labelledby="actions-heading"
        className="border-[3px] border-ink bg-paper p-6 shadow-brut-sm space-y-4"
      >
        <h2
          id="actions-heading"
          className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500"
        >
          Actions
        </h2>
        <div className="flex flex-wrap items-start gap-3">
          <AutopayButton orgId={claims.tenant_id} />
          <PortalButton orgId={claims.tenant_id} />
        </div>
        <p className="text-sm text-gray-600">
          {autopayOn ? (
            <><span className="font-medium text-ink">Autopay is on.</span> Your monthly subscription auto-charges your saved card each cycle.</>
          ) : (
            <><span className="font-medium text-ink">Set up autopay</span> to auto-charge your monthly subscription, or pay each invoice above. Use the portal to manage your card.</>
          )}
        </p>
        <p className="text-sm text-gray-600">
          Need to change your plan or add an automation?{" "}
          <Link
            href="/dashboard/support"
            className="font-medium font-bold text-ink underline underline-offset-2 transition-colors duration-150 hover:text-ink focus-visible: focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            Request a change via Support
          </Link>
        </p>
      </section>
    </main>
  );
}
