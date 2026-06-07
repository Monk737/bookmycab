import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listAccounts, listInvoices } from "@/lib/invoicing/service";
import { InvoicingClient } from "./invoicing-client";

export const metadata = { title: "Invoicing, BookMyCab" };

export default async function InvoicingPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "account_invoicing"))) redirect("/dashboard");
  const [accounts, invoices] = await Promise.all([listAccounts(claims.tenant_id), listInvoices(claims.tenant_id)]);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-bold text-ink">Account invoicing</h1>
      <p className="mb-4 text-sm text-gray-500">Bill your corporate accounts for their account-paid journeys.</p>
      <InvoicingClient orgId={claims.tenant_id} accounts={accounts} invoices={invoices} isDemo={claims.is_demo} />
    </div>
  );
}
