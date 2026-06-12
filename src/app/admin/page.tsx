import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatCard } from "@/components/admin/stat-card";
import { commercialModelLabel, type CommercialModel } from "@/lib/billing/pricing";
import {
  formatPrice,
  CURRENCIES,
  type Currency,
} from "@/lib/marketing/pricing";
import {
  computeMRR,
  computeARR,
  renewalBuckets,
  daysUntil,
  setupFeePipeline,
  type BillingTenant,
  type BillingSetupFee,
} from "@/lib/admin/billing-math";

// Platform figures must reflect provisioning the instant it happens.
export const dynamic = "force-dynamic";

type TenantRow = BillingTenant & {
  id: string;
  name: string;
  contract_start: string | null;
};

type ChurnRiskRow = {
  id: string;
  name: string;
  commercial_model: CommercialModel | string | null;
  currency: Currency;
  monthly_price: number | string | null;
  contract_renewal: string;
  days: number;
};

type TopTenantRow = {
  id: string;
  name: string;
  commercial_model: CommercialModel | string | null;
  currency: Currency;
  monthly_price: number;
};

/** Render a per-currency money map as compact "£x · €y · $z", skipping zeros. */
function MoneyByCurrency({ amounts }: { amounts: Record<Currency, number> }) {
  const parts = CURRENCIES.filter((c) => amounts[c] > 0);
  if (parts.length === 0) return <>·</>;
  return (
    <>
      {parts.map((c, i) => (
        <span key={c}>
          {i > 0 && <span className="px-1 text-gray-300">·</span>}
          {formatPrice(c, amounts[c])}
        </span>
      ))}
    </>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "·";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "·";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Admin Overview, platform analytics.
 *
 * READ-ONLY: every figure is computed from LOCAL Supabase tables (`tenants`,
 * `setup_fees`, `automations`, `bookings`) via the service-role client and the
 * pure billing-math helpers. No mutation, so no audit entry (reading platform
 * data for staff display is not an audited action).
 *
 * Engine/Stripe live data (real-time run health, reconciled MRR, gross revenue)
 * arrives in Epics 5 and 8, gross bookings here is a raw row COUNT, which may
 * be 0 until the engine writes confirmed bookings. // TODO(epic-5/8)
 */
export default async function AdminOverviewPage() {
  await requireStaff();

  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const today = new Date();
  const monthStartIso = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);

  const [tenantsRes, feesRes, automationsRes, bookingsRes, chatSubsRes, voiceSubsRes, voiceUsageRes] =
    await Promise.all([
      serviceClient
        .from("tenants")
        .select(
          "id, name, status, currency, monthly_price, contract_start, contract_renewal, commercial_model",
        ),
      serviceClient.from("setup_fees").select("id, tenant_id, amount, currency, paid_at"),
      serviceClient.from("automations").select("type, status"),
      // Gross bookings volume, raw count. Engine writes these in Epic 5; may be
      // 0 today. Live revenue is Epic 8. // TODO(epic-5/8)
      serviceClient.from("bookings").select("id", { count: "exact", head: true }),
      serviceClient.from("chat_subscriptions").select("monthly_price_gbp, status"),
      serviceClient.from("voice_subscriptions").select("monthly_price_gbp, status"),
      serviceClient
        .from("usage_counters")
        .select("used")
        .eq("feature_key", "voice_calls")
        .eq("period_start", monthStartIso),
    ]);

  const loadError = tenantsRes.error ?? feesRes.error ?? automationsRes.error;
  const tenants = (tenantsRes.data ?? []) as TenantRow[];
  const fees = (feesRes.data ?? []) as BillingSetupFee[];
  const automations = (automationsRes.data ?? []) as {
    type: string;
    status: string;
  }[];
  const bookingsCount = bookingsRes.count ?? 0;

  // --- Two-product (new model) platform figures ---
  type ModelRow = { commercial_model: string | null };
  const tenantModels = (tenants as unknown as ModelRow[]);
  const byModel = { chat: 0, voice: 0, double_decker: 0, legacy: 0 };
  for (const t of tenantModels) {
    if (t.commercial_model === "chat") byModel.chat += 1;
    else if (t.commercial_model === "voice") byModel.voice += 1;
    else if (t.commercial_model === "double_decker") byModel.double_decker += 1;
    else byModel.legacy += 1;
  }

  const chatSubs = (chatSubsRes.data ?? []) as { monthly_price_gbp: number | string | null; status: string }[];
  const voiceSubs = (voiceSubsRes.data ?? []) as { monthly_price_gbp: number | string | null; status: string }[];
  const sumActiveGbp = (rows: { monthly_price_gbp: number | string | null; status: string }[]) =>
    rows.reduce((n, r) => (r.status === "active" ? n + Number(r.monthly_price_gbp ?? 0) : n), 0);
  const newModelMrrGbp = sumActiveGbp(chatSubs) + sumActiveGbp(voiceSubs);

  const voiceAgentsLive = automations.filter((a) => a.type === "Voice" && (a.status === "live" || a.status === "uat")).length;
  const platformCallsThisMonth = ((voiceUsageRes.data ?? []) as { used: number | string | null }[]).reduce(
    (n, r) => n + Number(r.used ?? 0),
    0,
  );

  // --- Recurring revenue (pure) ---
  const mrr = computeMRR(tenants);
  const arr = computeARR(mrr);
  const buckets = renewalBuckets(tenants, today);
  const pipeline = setupFeePipeline(fees);

  const activeCount = tenants.filter((t) => t.status === "active").length;

  // --- New contracts MTD / YTD (by contract_start; UTC month/year to date) ---
  const yearStart = Date.UTC(today.getUTCFullYear(), 0, 1);
  const monthStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const todayMs = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  let newMTD = 0;
  let newYTD = 0;
  for (const t of tenants) {
    if (!t.contract_start) continue;
    const d = new Date(t.contract_start);
    if (Number.isNaN(d.getTime())) continue;
    const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (ms > todayMs) continue; // future-dated starts are not "new" yet
    if (ms >= yearStart) newYTD += 1;
    if (ms >= monthStart) newMTD += 1;
  }

  // --- Live automations (all types: Chat bots + Voice agents) ---
  const liveAutomations = automations.filter((a) => a.status === "live").length;

  // --- Churn-risk: active tenants renewing within 90 days, soonest first ---
  const churnRows: ChurnRiskRow[] = tenants
    .filter((t) => t.status === "active" && t.contract_renewal)
    .map((t) => ({
      id: t.id,
      name: t.name,
      commercial_model: t.commercial_model,
      currency: t.currency,
      monthly_price: t.monthly_price,
      contract_renewal: t.contract_renewal as string,
      days: daysUntil(t.contract_renewal as string, today),
    }))
    .filter((r) => !Number.isNaN(r.days) && r.days >= 0 && r.days <= 90)
    .sort((a, b) => a.days - b.days);

  // --- Top tenants by MRR (active, fixed price), highest first ---
  const topRows: TopTenantRow[] = tenants
    .filter((t) => t.status === "active" && t.monthly_price != null)
    .map((t) => ({
      id: t.id,
      name: t.name,
      commercial_model: t.commercial_model,
      currency: t.currency,
      monthly_price: Number(t.monthly_price),
    }))
    .filter((r) => Number.isFinite(r.monthly_price) && r.monthly_price > 0)
    .sort((a, b) => b.monthly_price - a.monthly_price)
    .slice(0, 10);

  const churnColumns: Column<ChurnRiskRow>[] = [
    { key: "name", header: "Tenant", render: (r) => r.name },
    { key: "renewal", header: "Renewal", render: (r) => formatDate(r.contract_renewal) },
    { key: "plan", header: "Product", render: (r) => commercialModelLabel(r.commercial_model) },
    {
      key: "mrr",
      header: "MRR",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (r) =>
        r.monthly_price == null
          ? "·"
          : formatPrice(r.currency, Number(r.monthly_price)),
    },
    {
      key: "days",
      header: "Days until",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (r) => {
        const tone =
          r.days <= 30
            ? "text-brut-red-deep font-bold"
            : r.days <= 60
              ? "text-ink font-medium"
              : "text-gray-700";
        return <span className={tone}>{r.days}d</span>;
      },
    },
  ];

  const topColumns: Column<TopTenantRow>[] = [
    { key: "name", header: "Tenant", render: (r) => r.name },
    { key: "plan", header: "Product", render: (r) => commercialModelLabel(r.commercial_model) },
    {
      key: "mrr",
      header: "MRR",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (r) => formatPrice(r.currency, r.monthly_price),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">
          Overview
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Platform analytics across both products (Chat + AI Voice), staff only.
          Figures are computed live from Supabase.
        </p>
      </div>

      {loadError && (
        <p
          role="alert"
          className="mt-6 border border-ink bg-brut-red/15 px-4 py-3 text-sm text-brut-red-deep"
        >
          Failed to load platform data. Please refresh.
        </p>
      )}

      {/* Revenue + contract KPIs */}
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
          label="New contracts"
          value={newMTD}
          sub={`MTD · ${newYTD} YTD`}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Renewing in 30d"
          value={buckets[30]}
          sub={`${buckets[60]} within 60d · ${buckets[90]} within 90d`}
        />
        <StatCard
          label="Total tenants"
          value={tenants.length}
          sub={`${activeCount} active`}
        />
        <StatCard
          label="Gross bookings"
          value={bookingsCount}
          sub="All-time row count"
        />
        <StatCard
          label="Setup-fee pipeline"
          value={<MoneyByCurrency amounts={pipeline.totalByCurrency} />}
          sub={`${pipeline.outstanding.length} outstanding`}
        />
      </div>

      {/* Two-product platform — the new commercial model */}
      <section className="mt-8">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
          Two-product platform
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Chat only" value={byModel.chat} sub="commercial_model = chat" />
          <StatCard label="Voice only" value={byModel.voice} sub="commercial_model = voice" />
          <StatCard label="Double decker" value={byModel.double_decker} sub="Chat + AI Voice" />
          <StatCard label="Legacy" value={byModel.legacy} sub="Pre-two-product tenants" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Voice agents live" value={voiceAgentsLive} sub="Live or in UAT" />
          <StatCard
            label="Voice calls (MTD)"
            value={platformCallsThisMonth.toLocaleString("en-GB")}
            sub="Plan pool, all tenants"
          />
          <StatCard
            label="New-model MRR"
            value={formatPrice("GBP", newModelMrrGbp)}
            sub="Active chat + voice subs"
          />
          <StatCard
            label="Live automations"
            value={liveAutomations}
            sub="All chat bots + voice agents"
          />
        </div>
      </section>

      {/* Top tenants by MRR */}
      <section className="mt-8">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
          Top tenants by MRR
        </h2>
        <div className="mt-3">
          <DataTable
            columns={topColumns}
            rows={topRows}
            getRowKey={(r) => r.id}
            getRowHref={(r) => `/admin/tenants/${r.id}`}
            emptyMessage="No active tenants with a fixed price yet."
          />
        </div>
      </section>

      {/* Churn-risk: renewals within 90 days */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Churn risk &mdash; renewals within 90 days
          </h2>
          <p className="text-xs text-gray-500">
            Soonest first. Red &le; 30 days, amber &le; 60 days.
          </p>
        </div>
        <div className="mt-3">
          <DataTable
            columns={churnColumns}
            rows={churnRows}
            getRowKey={(r) => r.id}
            getRowHref={(r) => `/admin/tenants/${r.id}`}
            emptyMessage="No contracts renewing within 90 days."
          />
        </div>
      </section>

      <p className="mt-8 text-xs text-gray-400">
        Revenue derives from <code>tenants.monthly_price</code>; gross bookings is
        a raw <code>bookings</code> row count. Reconciled Stripe revenue and live
        engine run health arrive in later epics.
      </p>
    </div>
  );
}
