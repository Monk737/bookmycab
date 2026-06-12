import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { commercialModelLabel } from "@/lib/billing/pricing";
import { formatPrice, type Currency } from "@/lib/marketing/pricing";
import { countryLabel } from "@/lib/billing/country";
import {
  EditContractForm,
  InviteForm,
  LifecycleControls,
} from "./tenant-detail-forms";
import { EditOrgForm, MembersManager, AddAutomationForm } from "./tenant-manage-forms";
import { BillingPanel } from "./billing-panel";
import { EntitlementsSection } from "./entitlements-section";

// Always read fresh, lifecycle changes / invites must appear immediately.
export const dynamic = "force-dynamic";

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

function formatDateTime(value: string | null): string {
  if (!value) return "·";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "·";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const RENEWAL_MODE_LABELS: Record<string, string> = {
  rolling_monthly: "Rolling monthly",
  auto_12mo: "Auto 12-month",
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  country: string;
  currency: Currency;
  monthly_price: number | string | null;
  contract_start: string | null;
  contract_renewal: string | null;
  renewal_mode: string;
  dispatch_adapter: string;
  dispatch_company_id: string | null;
  contact_email: string | null;
  stripe_customer_id: string | null;
  setup_fee_paid: boolean | null;
  commercial_model: string | null;
};

type AutomationRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  build_stage: string;
  dispatch_adapter: string | null;
};

type MemberRow = {
  user_id: string;
  role: string;
  accepted_at: string | null;
  email: string;
  last_login_at: string | null;
};

type ChannelRow = {
  id: string;
  type: string;
  status: string;
  token_expires_at: string | null;
};

type InvoiceRow = {
  id: string;
  kind: "Subscription" | "Setup fee";
  plan: string;
  amount: string;
  status: string;
  period: string;
};

type AuditRow = {
  id: number;
  ts: string;
  action: string;
  target_type: string | null;
  actor: string;
};

/** Small label/value pair for the tenant header grid. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-ink">{value}</p>
    </div>
  );
}

/** Section wrapper with a mono micro-label heading. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Tenant detail (FlowMo staff). Service-role reads span this one tenant plus its
 * related rows (admin is cross-tenant; RLS would otherwise block). All reads /
 * the service-role key stay confined to this server component.
 */
export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  // Defense-in-depth: layout gates, but this component reads via the
  // service-role key, so it re-checks staff itself.
  await requireStaff();

  const { tenantId } = await params;

  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: tenantData, error: tenantError } = await serviceClient
    .from("tenants")
    .select(
      "id, name, slug, status, country, currency, monthly_price, contract_start, contract_renewal, renewal_mode, dispatch_adapter, dispatch_company_id, contact_email, stripe_customer_id, setup_fee_paid, commercial_model",
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError) {
    // A real read failure (not a missing row), surface rather than 404.
    throw new Error("Failed to load tenant.");
  }
  if (!tenantData) {
    notFound();
  }

  const tenant = tenantData as Tenant;

  // Related reads (parallel). Each is scoped to this tenant.
  const [
    { data: automationsData },
    { data: membersData },
    { data: channelsData },
    { data: subsData },
    { data: feesData },
    { data: auditData },
    { data: voiceSubData },
  ] = await Promise.all([
    serviceClient
      .from("automations")
      .select("id, name, type, status, build_stage, dispatch_adapter")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    serviceClient
      .from("tenant_users")
      .select("user_id, role, accepted_at, users(email, last_login_at)")
      .eq("tenant_id", tenantId),
    serviceClient
      .from("channels")
      .select("id, type, status, token_expires_at")
      .eq("tenant_id", tenantId),
    serviceClient
      .from("subscriptions")
      .select(
        "id, plan_band, monthly_price, currency, status, current_period_start, current_period_end",
      )
      .eq("tenant_id", tenantId),
    serviceClient
      .from("setup_fees")
      .select("id, amount, currency, paid_at")
      .eq("tenant_id", tenantId),
    serviceClient
      .from("audit_log")
      .select("id, ts, action, target_type, actor_user_id, users(email)")
      .eq("tenant_id", tenantId)
      .order("ts", { ascending: false })
      .limit(50),
    serviceClient
      .from("voice_subscriptions")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  const hasVoicePlan = Boolean(voiceSubData);

  const automations = (automationsData ?? []) as AutomationRow[];

  const members: MemberRow[] = (
    (membersData ?? []) as Array<{
      user_id: string;
      role: string;
      accepted_at: string | null;
      users:
        | { email: string; last_login_at: string | null }
        | { email: string; last_login_at: string | null }[]
        | null;
    }>
  ).map((m) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      user_id: m.user_id,
      role: m.role,
      accepted_at: m.accepted_at,
      email: u?.email ?? "·",
      last_login_at: u?.last_login_at ?? null,
    };
  });

  const channels = (channelsData ?? []) as ChannelRow[];

  const invoices: InvoiceRow[] = [
    ...((subsData ?? []) as Array<{
      id: string;
      plan_band: string;
      monthly_price: number | string | null;
      currency: string | null;
      status: string | null;
      current_period_start: string | null;
      current_period_end: string | null;
    }>).map((s) => ({
      id: `sub-${s.id}`,
      kind: "Subscription" as const,
      plan: s.plan_band,
      amount:
        s.monthly_price == null
          ? "·"
          : formatPrice((s.currency ?? "GBP") as Currency, Number(s.monthly_price)),
      status: s.status ?? "·",
      period: `${formatDate(s.current_period_start)} → ${formatDate(s.current_period_end)}`,
    })),
    ...((feesData ?? []) as Array<{
      id: string;
      amount: number | string | null;
      currency: string | null;
      paid_at: string | null;
    }>).map((f) => ({
      id: `fee-${f.id}`,
      kind: "Setup fee" as const,
      plan: "Setup fee",
      amount:
        f.amount == null
          ? "·"
          : formatPrice((f.currency ?? "GBP") as Currency, Number(f.amount)),
      status: f.paid_at ? "paid" : "unpaid",
      period: f.paid_at ? formatDate(f.paid_at) : "·",
    })),
  ];

  const auditRows: AuditRow[] = (
    (auditData ?? []) as Array<{
      id: number;
      ts: string;
      action: string;
      target_type: string | null;
      actor_user_id: string | null;
      users: { email: string } | { email: string }[] | null;
    }>
  ).map((a) => {
    const u = Array.isArray(a.users) ? a.users[0] : a.users;
    return {
      id: a.id,
      ts: a.ts,
      action: a.action,
      target_type: a.target_type,
      actor: u?.email ?? a.actor_user_id ?? "·",
    };
  });

  const automationColumns: Column<AutomationRow>[] = [
    { key: "name", header: "Name", render: (a) => a.name },
    { key: "type", header: "Type", render: (a) => a.type },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusBadge status={a.status} />,
    },
    { key: "build_stage", header: "Build stage", render: (a) => a.build_stage },
    {
      key: "dispatch_adapter",
      header: "Dispatch",
      render: (a) => <span className="capitalize">{a.dispatch_adapter ?? "·"}</span>,
    },
  ];

  const channelColumns: Column<ChannelRow>[] = [
    {
      key: "type",
      header: "Type",
      render: (c) => <span className="capitalize">{c.type}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "token_expires_at",
      header: "Token expires",
      render: (c) => formatDate(c.token_expires_at),
    },
  ];

  const invoiceColumns: Column<InvoiceRow>[] = [
    { key: "kind", header: "Type", render: (i) => i.kind },
    { key: "plan", header: "Plan", render: (i) => i.plan },
    {
      key: "amount",
      header: "Amount",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (i) => i.amount,
    },
    { key: "status", header: "Status", render: (i) => i.status },
    { key: "period", header: "Period", render: (i) => i.period },
  ];

  const auditColumns: Column<AuditRow>[] = [
    { key: "ts", header: "When", render: (a) => formatDateTime(a.ts) },
    {
      key: "action",
      header: "Action",
      render: (a) => <span className="font-mono text-[13px]">{a.action}</span>,
    },
    { key: "target_type", header: "Target", render: (a) => a.target_type ?? "·" },
    { key: "actor", header: "Actor", render: (a) => a.actor },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/admin/tenants"
        className="text-xs text-gray-500 outline-none transition-colors hover:text-ink focus-visible:underline"
      >
        &larr; All tenants
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-ink">
              {tenant.name}
            </h1>
            <StatusBadge status={tenant.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-500">{tenant.slug}</p>
        </div>
        <LifecycleControls tenantId={tenant.id} status={tenant.status} />
      </div>

      <div className="mt-6 border-[3px] border-ink bg-paper p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <Detail label="Country" value={countryLabel(tenant.country)} />
          <Detail label="Product" value={commercialModelLabel(tenant.commercial_model)} />
          <Detail label="Currency" value={tenant.currency} />
          <Detail
            label="Monthly price"
            value={
              tenant.monthly_price == null
                ? "·"
                : formatPrice(tenant.currency, Number(tenant.monthly_price))
            }
          />
          <Detail
            label="Contract start"
            value={formatDate(tenant.contract_start)}
          />
          <Detail
            label="Contract renewal"
            value={formatDate(tenant.contract_renewal)}
          />
          <Detail
            label="Renewal mode"
            value={RENEWAL_MODE_LABELS[tenant.renewal_mode] ?? tenant.renewal_mode}
          />
          <Detail
            label="Dispatch"
            value={
              <span className="capitalize">
                {tenant.dispatch_adapter}
                {tenant.dispatch_company_id
                  ? ` · ${tenant.dispatch_company_id}`
                  : ""}
              </span>
            }
          />
          <Detail label="Contact email" value={tenant.contact_email ?? "·"} />
          <Detail
            label="Stripe customer"
            value={
              <span className="font-mono text-[13px]">
                {tenant.stripe_customer_id ?? "·"}
              </span>
            }
          />
        </div>
      </div>

      <Section title="Edit organisation">
        <div className="border-[3px] border-ink bg-paper p-5">
          <EditOrgForm
            tenantId={tenant.id}
            name={tenant.name}
            contactEmail={tenant.contact_email}
            dispatchAdapter={tenant.dispatch_adapter}
            dispatchCompanyId={tenant.dispatch_company_id}
          />
        </div>
      </Section>

      <Section title="Billing actions">
        <BillingPanel
          tenantId={tenant.id}
          commercialModel={tenant.commercial_model}
          status={tenant.status}
        />
      </Section>

      <Section title="Edit contract">
        <div className="border-[3px] border-ink bg-paper p-5">
          <EditContractForm
            tenantId={tenant.id}
            contractStart={tenant.contract_start}
            contractRenewal={tenant.contract_renewal}
            monthlyPrice={
              tenant.monthly_price == null ? null : String(tenant.monthly_price)
            }
            renewalMode={tenant.renewal_mode}
          />
        </div>
      </Section>

      <Section title="Invite a user">
        <div className="border-[3px] border-ink bg-paper p-5">
          <InviteForm tenantId={tenant.id} defaultEmail={tenant.contact_email} />
        </div>
      </Section>

      <Section title="Automations">
        <div className="mb-4 border-[3px] border-ink bg-paper p-5">
          <h3 className="mb-3 font-display text-sm font-extrabold uppercase tracking-tight text-ink">Add an automation</h3>
          <AddAutomationForm tenantId={tenant.id} hasVoicePlan={hasVoicePlan} />
        </div>
        <DataTable
          columns={automationColumns}
          rows={automations}
          getRowKey={(a) => a.id}
          emptyMessage="No automations provisioned yet."
        />
      </Section>

      <Section title="Users">
        <MembersManager tenantId={tenant.id} members={members} />
      </Section>

      <Section title="Channels">
        <DataTable
          columns={channelColumns}
          rows={channels}
          getRowKey={(c) => c.id}
          emptyMessage="No channels bound yet."
        />
      </Section>

      <Section title="Entitlements">
        <EntitlementsSection tenantId={tenantId} />
      </Section>

      <Section title="Invoices">
        <DataTable
          columns={invoiceColumns}
          rows={invoices}
          getRowKey={(i) => i.id}
          emptyMessage="No subscriptions or setup fees recorded."
        />
      </Section>

      <Section title="Audit log">
        <DataTable
          columns={auditColumns}
          rows={auditRows}
          getRowKey={(a) => String(a.id)}
          emptyMessage="No audit entries for this tenant."
        />
      </Section>
    </div>
  );
}
