import Link from "next/link";
import { TenantForm } from "./tenant-form";

/**
 * New tenant provisioning page. Server wrapper around the client form. Access
 * is already gated by the admin layout (requireStaff); the createTenant action
 * re-checks for defense-in-depth.
 */
export default function NewTenantPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-2">
        <Link
          href="/admin/tenants"
          className="text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
        >
          &larr; Tenants
        </Link>
      </nav>
      <h1 className="text-xl font-bold tracking-tight text-ink">
        New tenant
      </h1>
      <p className="mt-1 mb-6 text-sm text-gray-600">
        Provision a bespoke automation account. The tenant starts in
        &lsquo;onboarding&rsquo; status.
      </p>
      <TenantForm />
    </div>
  );
}
