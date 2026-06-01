import "server-only";
import Link from "next/link";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { planBandLabel, type PlanBand } from "@/lib/admin/plan-bands";
import { formatPrice, type Currency } from "@/lib/marketing/pricing";

// Always read fresh — provisioning a tenant should appear immediately.
export const dynamic = "force-dynamic";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_band: PlanBand;
  currency: Currency;
  dispatch_adapter: string;
  monthly_price: number | string | null;
  contract_renewal: string | null;
  created_at: string | null;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Tenants list (FlowMo staff). Reads ALL tenants via the service-role client —
 * admin spans every tenant, and RLS would otherwise scope reads to the staff
 * user's own (null) tenant. Service-role read is confined to this server
 * component; the client never sees the key.
 */
export default async function TenantsListPage() {
  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data, error } = await serviceClient
    .from("tenants")
    .select(
      "id, name, slug, status, plan_band, currency, dispatch_adapter, monthly_price, contract_renewal, created_at",
    )
    .order("created_at", { ascending: false });

  const tenants = (data ?? []) as TenantRow[];

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
      key: "plan_band",
      header: "Plan",
      render: (t) => planBandLabel(t.plan_band),
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
          ? "—"
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
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Tenants
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Every provisioned cab company. Cross-tenant view, staff only.
          </p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="shrink-0 cursor-pointer rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          New tenant
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total tenants" value={counts.total} />
        <StatCard label="Active" value={counts.active} />
        <StatCard label="Onboarding" value={counts.onboarding} />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
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
