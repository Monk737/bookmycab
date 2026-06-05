import { requireUser } from "@/lib/auth/session";
import { getBillingOverview } from "@/lib/dashboard/billing-queries";
import { DataTable } from "@/components/dashboard/data-table";
import { formatCurrency, formatDateTime } from "@/lib/dashboard/format";
import { PortalButton } from "./portal-button";
import Link from "next/link";

const TZ = "Europe/London";

export default async function BillingPage() {
  const claims = await requireUser();

  if (!claims.tenant_id) {
    return (
      <main className="p-8">
        <p className="text-sm text-gray-500">No organisation found for your account.</p>
      </main>
    );
  }

  const b = await getBillingOverview(claims.tenant_id);

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
        : "—",
      status: b.setupFee.paidAt ? "Paid" : "Pending",
      date: b.setupFee.paidAt ? formatDateTime(b.setupFee.paidAt, TZ) : "—",
    });
  }

  const currency = b.currency ?? "GBP";

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6 lg:p-8">
      <h1 className="font-mono text-xl font-semibold text-blue-900">Billing</h1>

      {/* Plan card */}
      <section
        aria-labelledby="plan-heading"
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2
          id="plan-heading"
          className="mb-4 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500"
        >
          Current plan
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-gray-500">Plan</dt>
            <dd className="mt-0.5 text-sm font-semibold text-blue-900">
              {b.planBand ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Monthly price</dt>
            <dd className="mt-0.5 text-sm font-semibold text-blue-900">
              {b.monthlyPrice != null
                ? formatCurrency(b.monthlyPrice, currency)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Currency</dt>
            <dd className="mt-0.5 text-sm font-semibold text-blue-900">
              {b.currency ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Contract start</dt>
            <dd className="mt-0.5 text-sm text-gray-700">
              {b.contractStart ? formatDateTime(b.contractStart, TZ) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Contract renewal</dt>
            <dd className="mt-0.5 text-sm text-gray-700">
              {b.contractRenewal ? formatDateTime(b.contractRenewal, TZ) : "—"}
            </dd>
          </div>
          {b.subscription?.status && (
            <div>
              <dt className="text-xs font-medium text-gray-500">Subscription status</dt>
              <dd className="mt-0.5 text-sm text-gray-700 capitalize">
                {b.subscription.status}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Setup fee */}
      <section
        aria-labelledby="setup-heading"
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2
          id="setup-heading"
          className="mb-4 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500"
        >
          Setup fee
        </h2>
        {b.setupFee?.paidAt ? (
          <p className="text-sm text-gray-700">
            Paid —{" "}
            <span className="font-semibold text-blue-900">
              {b.setupFee.amount != null && b.setupFee.currency
                ? formatCurrency(b.setupFee.amount, b.setupFee.currency)
                : "—"}
            </span>{" "}
            on {formatDateTime(b.setupFee.paidAt, TZ)}
          </p>
        ) : (
          <p className="text-sm text-amber-700 font-medium">Pending</p>
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

      {/* Actions */}
      <section
        aria-labelledby="actions-heading"
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
      >
        <h2
          id="actions-heading"
          className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500"
        >
          Actions
        </h2>
        <PortalButton orgId={claims.tenant_id} />
        <p className="text-sm text-gray-600">
          Need to change your plan or add an automation?{" "}
          <Link
            href="/dashboard/support"
            className="font-medium text-blue-800 underline underline-offset-2 transition-colors duration-150 hover:text-blue-600 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800"
          >
            Request a change via Support
          </Link>
        </p>
      </section>
    </main>
  );
}
