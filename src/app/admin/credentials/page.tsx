import "server-only";
import { requireStaff } from "@/lib/admin/guard";
import {
  listTenantsForSelect,
  listTenantCredentials,
} from "@/lib/credentials/integration-service";
import { CredentialsConsole } from "./credentials-console";

// Always read fresh, a newly stored credential should appear immediately.
export const dynamic = "force-dynamic";

export const metadata = { title: "Credentials · Admin" };

/**
 * Integration credential vault (FlowMo staff). Holds the API keys, IDs and URLs
 * BookMyCab keeps for each tenant's WhatsApp chatbot and AI Voice agent. Stored
 * in `integration_credentials` (RLS-locked to the service role); read here via
 * the service-role client, the key never leaves this server component.
 */
export default async function CredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  await requireStaff();
  const { tenant } = await searchParams;

  const tenants = await listTenantsForSelect();
  const selected = tenant && tenants.some((t) => t.id === tenant) ? tenant : null;
  const instances = selected ? await listTenantCredentials(selected) : [];
  const selectedName = selected ? tenants.find((t) => t.id === selected)?.name ?? null : null;

  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink">Credentials</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          The API secrets, IDs and URLs BookMyCab holds for each tenant&rsquo;s WhatsApp chatbot and
          AI Voice agent. Pick a tenant, then add a credential set or view and edit what&rsquo;s stored.
          Staff only, never exposed to tenants.
        </p>
      </header>

      <CredentialsConsole
        tenants={tenants}
        selectedTenantId={selected}
        selectedTenantName={selectedName}
        instances={instances}
      />
    </div>
  );
}
