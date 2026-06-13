import "server-only";
import Link from "next/link";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatCard, StatCardGrid } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { commercialModelLabel, type CommercialModel } from "@/lib/billing/pricing";
import { formatPrice, type Currency } from "@/lib/marketing/pricing";

// Always read fresh, provisioning a tenant should appear immediately.
export const dynamic = "force-dynamic";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  commercial_model: CommercialModel | string | null;
  currency: Currency;
  dispatch_adapter: string;
  monthly_price: number | string | null;
  contract_renewal: string | null;
  created_at: string | null;
  last_login_at?: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "·";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "·";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Tenants list (FlowMo staff). Reads ALL tenants via the service-role client ,
 * admin spans every tenant, and RLS would otherwise scope reads to the staff
 * user's own (null) tenant. Service-role read is confined to this server
 * component; the client never sees the key.
 */
export default async function TenantsListPage() {
  // Defense-in-depth: the admin layout already gates, but this server component
  // reads every tenant via the service-role key, so it re-checks staff itself.
  await requireStaff();

  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data, error } = await serviceClient
    .from("tenants")
    .select(
      "id, name, slug, status, commercial_model, currency, dispatch_adapter, monthly_price, contract_renewal, created_at",
    )
    .order("created_at", { ascending: false });

  const tenants = (data ?? []) as TenantRow[];

  // Last login per tenant = most recent members' users.last_login_at. One extra
  // query (not N+1): pull all memberships with their user's last_login_at, then
  // reduce to a max per tenant in memory.
  const { data: memberships } = await serviceClient
    .from("tenant_users")
    // tenant_users has two FKs to users (user_id, invited_by); the embed must
    // name the member FK or PostgREST rejects it as ambiguous (HTTP 300).
    .select("tenant_id, users!tenant_users_user_id_fkey(last_login_at)");

  const lastLoginByTenant = new Map<string, string>();
  for (const m of (memberships ?? []) as Array<{
    tenant_id: string;
    users: { last_login_at: string | null } | { last_login_at: string | null }[] | null;
  }>) {
    // The embedded relation may come back as an object or a single-element array.
    const userRel = Array.isArray(m.users) ? m.users[0] : m.users;
    const ts = userRel?.last_login_at;
    if (!ts) continue;
    const current = lastLoginByTenant.get(m.tenant_id);
    if (!current || ts > current) lastLoginByTenant.set(m.tenant_id, ts);
  }
  for (const t of tenants) {
    t.last_login_at = lastLoginByTenant.get(t.id) ?? null;
  }

  const counts = tenants.reduce(
    (acc, t) => {
      acc.total += 1;
      if (t.status === "active") acc.active += 1;
      if (t.status === "onboarding") acc.onboarding += 1;
      return acc;
    },
    { total: 0, active: 0, onboarding: 0 },
  );

  const columns: Column<TenantRow>[] = [
    { key: "name", header: "Name", render: (t) => t.name },
    {
      key: "status",
      header: "Status",
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: "commercial_model",
      header: "Product",
      render: (t) => commercialModelLabel(t.commercial_model),
    },
    {
      key: "dispatch_adapter",
      header: "Dispatch",
      render: (t) => <span className="capitalize">{t.dispatch_adapter}</span>,
    },
    {
      key: "monthly_price",
      header: "Monthly",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (t) =>
        t.monthly_price == null
          ? "·"
          : formatPrice(t.currency, Number(t.monthly_price)),
    },
    {
      key: "contract_renewal",
      header: "Renewal",
      render: (t) => formatDate(t.contract_renewal),
    },
    {
      key: "created_at",
      header: "Created",
      render: (t) => formatDate(t.created_at),
    },
    {
      key: "last_login_at",
      header: "Last login",
      render: (t) => formatDate(t.last_login_at ?? null),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            Tenants
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Every provisioned cab company. Cross-tenant view, staff only.
          </p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="shrink-0 cursor-pointer bg-brut-lime px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-brut-lime focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
        >
          New tenant
        </Link>
      </div>

      <StatCardGrid className="mt-6 grid-cols-2 sm:grid-cols-3">
        <StatCard label="Total tenants" value={counts.total} />
        <StatCard label="Active" value={counts.active} />
        <StatCard label="Onboarding" value={counts.onboarding} />
      </StatCardGrid>

      {error && (
        <p
          role="alert"
          className="mt-6 border border-ink bg-brut-red/15 px-4 py-3 text-sm text-brut-red-deep"
        >
          Failed to load tenants. Please refresh.
        </p>
      )}

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={tenants}
          getRowKey={(t) => t.id}
          getRowHref={(t) => `/admin/tenants/${t.id}`}
          emptyMessage="No tenants yet. Provision the first one."
        />
      </div>
    </div>
  );
}
