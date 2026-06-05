import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listCustomers } from "@/lib/crm/queries";
import { CustomersClient } from "./customers-client";

export const metadata = { title: "Customers — BookMyCab" };

export default async function CustomersPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "crm"))) redirect("/dashboard");
  const customers = await listCustomers(claims.tenant_id);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Customers</h1>
      <p className="mb-4 text-sm text-gray-500">Derived from your bot&apos;s bookings and conversations.</p>
      <CustomersClient orgId={claims.tenant_id} customers={customers} isDemo={claims.is_demo} />
    </div>
  );
}
