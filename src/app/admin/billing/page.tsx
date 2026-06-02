import "server-only";
import Link from "next/link";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { planBandLabel, type PlanBand } from "@/lib/admin/plan-bands";
import {
  formatPrice,
  CURRENCIES,
  type Currency,
} from "@/lib/marketing/pricing";
import {
  computeMRR,
  computeARR,
  mrrByPlanBand,
  renewalBuckets,
  daysUntil,
  setupFeePipeline,
  type BillingTenant,
  type BillingSetupFee,
} from "@/lib/admin/billing-math";

// Billing figures must reflect provisioning the instant it happens.
export const dynamic = "force-dynamic";

type TenantRow = BillingTenant & {
  id: string;
  name: string;
  stripe_customer_id: string | null;
};

type RenewalRow = {
  id: string;
  name: string;
  plan_band: PlanBand;
  currency: Currency;
  monthly_price: number | string | null;
  contract_renewal: string;
  days: number;
  stripe_customer_id: string | null;
};

type FeeRow = {
  id: string;
  tenant_id: string;
  name: string;
  amount: number;
  currency: Currency;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Render a per-currency money map as compact "£x · €y · $z", skipping zeros. */
function MoneyByCurrency({
  amounts,
}: {
  amounts: Record<Currency, number>;
}) {
  const parts = CURRENCIES.filter((c) => amounts[c] > 0);
  if (parts.length === 0) return <>—</>;
  return (
    <>
      {parts.map((c, i) => (
        <span key={c}>
          {i > 0 && <span className="px-1 text-zinc-300">·</span>}
          {formatPrice(c, amounts[c])}
        </span>
      ))}
    </>
  );
}

/**
 * Stripe billing panel (FlowMo staff). READ-ONLY: every figure is computed from
 * local tables (`tenants`, `subscriptions`, `setup_fees`) via the service-role
 * client. No mutation happens here, so no audit entry is written — reading
 * billing data for staff display is not an audited action.
 *
 * MRR source of truth is `tenants.monthly_price` (always present from
 * provisioning); `subscriptions` is the Stripe mirror. We read subscriptions
 * only to show whether the mirror has populated yet.
 */
export default async function BillingPage() {
  // Defense-in-depth on top of the admin layout guard: this component reads
  // every tenant's billing data via the service-role key.
  await requireStaff();

  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const [tenantsRes, feesRes, subsRes] = await Promise.all([
    serviceClient
      .from("tenants")
      .select(
        "id, name, status, currency, monthly_price, contract_renewal, plan_band, stripe_customer_id",
      )
      .order("contract_renewal", { ascending: true, nullsFirst: false }),
    serviceClient
      .from("setup_fees")
      .select("id, tenant_id, amount, currency, paid_at"),
    serviceClient.from("subscriptions").select("id", { count: "exact", head: true }),
  ]);

  const loadError = tenantsRes.error ?? feesRes.error;
  const tenants = (tenantsRes.data ?? []) as TenantRow[];
  const fees = (feesRes.data ?? []) as BillingSetupFee[];
  const subscriptionCount = subsRes.count ?? 0;

  const today = new Date();

  // --- Derived billing math (pure) ---
  const mrr = computeMRR(tenants);
  const arr = computeARR(mrr);
  const buckets = renewalBuckets(tenants, today);
  const byBand = mrrByPlanBand(tenants);
  const pipeline = setupFeePipeline(fees);

  const activeCount = tenants.filter((t) => t.status === "active").length;

  // --- Renewal alert table: active tenants with a future renewal, soonest first ---
  const renewalRows: RenewalRow[] = tenants
    .filter((t) => t.status === "active" && t.contract_renewal)
    .map((t) => ({
      id: t.id,
      name: t.name,
      plan_band: t.plan_band,
      currency: t.currency,
      monthly_price: t.monthly_price,
      contract_renewal: t.contract_renewal as string,
      days: daysUntil(t.contract_renewal as string, today),
      stripe_customer_id: t.stripe_customer_id,
    }))
    .filter((r) => !Number.isNaN(r.days) && r.days >= 0)
    .sort((a, b) => a.days - b.days);

  // --- Outstanding setup fees joined to tenant names ---
  const nameById = new Map(tenants.map((t) => [t.id, t.name]));
  const feeRows: FeeRow[] = pipeline.outstanding.map((f) => ({
    id: f.id,
    tenant_id: f.tenant_id,
    name: nameById.get(f.tenant_id) ?? f.tenant_id,
    amount: f.amount,
    currency: f.currency,
  }));

  const renewalColumns: Column<RenewalRow>[] = [
    { key: "name", header: "Tenant", render: (r) => r.name },
    {
      key: "renewal",
      header: "Renewal",
      render: (r) => formatDate(r.contract_renewal),
    },
    { key: "plan", header: "Plan", render: (r) => planBandLabel(r.plan_band) },
    {
      key: "mrr",
      header: "MRR",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (r) =>
        r.monthly_price == null
          ? "—"
          : formatPrice(r.currency, Number(r.monthly_price)),
    },
    {
      key: "days",
      header: "Days until",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (r) => {
        const tone =
          r.days <= 7
            ? "text-red-700 font-semibold"
            : r.days <= 14
              ? "text-amber-700 font-medium"
              : "text-zinc-700";
        return <span className={tone}>{r.days}d</span>;
      },
    },
    {
      key: "stripe",
      header: "Stripe",
      render: (r) => {
        if (!r.stripe_customer_id) {
          return <span className="text-zinc-400">—</span>;
        }
        return (
          <a
            href={`https://dashboard.stripe.com/customers/${r.stripe_customer_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] font-medium uppercase tracking-wider text-emerald-700 underline-offset-2 outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Open in Stripe
          </a>
        );
      },
    },
  ];

  const feeColumns: Column<FeeRow>[] = [
    { key: "name", header: "Tenant", render: (f) => f.name },
    {
      key: "amount",
      header: "Amount",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (f) => formatPrice(f.currency, f.amount),
    },
    {
      key: "currency",
      header: "Currency",
      render: (f) => <StatusBadge status={f.currency} />,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
            Billing
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Recurring revenue, contract renewals and the setup-fee pipeline.
            Computed from local data &mdash; staff only.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {/* Live Stripe sync is per-tenant (tenant detail → Sync from Stripe). */}
          <Link
            href="/admin/tenants"
            className="shrink-0 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Sync a tenant
          </Link>
          <p className="text-xs text-zinc-500">Open a tenant to sync from Stripe</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="MRR"
          value={<MoneyByCurrency amounts={mrr} />}
          sub="Active tenants, per currency"
        />
        <StatCard
          label="ARR"
          value={<MoneyByCurrency amounts={arr} />}
          sub="MRR &times; 12"
        />
        <StatCard label="Active contracts" value={activeCount} />
        <StatCard
          label="Renewing in 30d"
          value={buckets[30]}
          sub={`${buckets[7]} within 7d · ${buckets[14]} within 14d`}
        />
      </div>

      {loadError && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Failed to load billing data. Please refresh.
        </p>
      )}

      {/* Renewal alerts */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Renewal alerts
          </h2>
          <p className="text-xs text-zinc-500">
            Soonest first. Days until colour-coded: red &le; 7 days, amber &le; 14 days.
          </p>
        </div>
        <div className="mt-3">
          <DataTable
            columns={renewalColumns}
            rows={renewalRows}
            getRowKey={(r) => r.id}
            getRowHref={(r) => `/admin/tenants/${r.id}`}
            emptyMessage="No upcoming renewals."
          />
        </div>
      </section>

      {/* MRR by plan band */}
      <section className="mt-8">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          MRR by plan band
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(
            ["A-Single", "A-Bundle", "B-Single", "B-Bundle", "Custom"] as const
          ).map((band) => (
            <StatCard
              key={band}
              label={planBandLabel(band)}
              value={<MoneyByCurrency amounts={byBand[band]} />}
            />
          ))}
        </div>
      </section>

      {/* Setup-fee pipeline */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Outstanding setup fees
          </h2>
          <p className="text-xs text-zinc-500">
            Unpaid total: <MoneyByCurrency amounts={pipeline.totalByCurrency} />
          </p>
        </div>
        <div className="mt-3">
          <DataTable
            columns={feeColumns}
            rows={feeRows}
            getRowKey={(f) => f.id}
            emptyMessage="No outstanding setup fees."
          />
        </div>
      </section>

      <p className="mt-8 text-xs text-zinc-400">
        Figures derive from <code>tenants.monthly_price</code>. The{" "}
        <code>subscriptions</code> mirror{" "}
        {subscriptionCount > 0
          ? `holds ${subscriptionCount} row(s)`
          : "is empty"}{" "}
        and is reconciled from Stripe via webhooks and per-tenant Manual sync.
      </p>
    </div>
  );
}
