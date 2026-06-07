import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { buildEngineDeeplink } from "@/lib/admin/engine-links";
import { resolveEngineerEmails } from "@/lib/admin/resolve-engineers";

// Always read fresh, build-stage moves and new automations should appear
// immediately, and runtime status (Epic 5) will be live.
export const dynamic = "force-dynamic";

const STATUSES = ["building", "uat", "live", "stopped", "error"] as const;
type AutomationStatus = (typeof STATUSES)[number];

type AutomationRow = {
  id: string;
  tenant_id: string;
  name: string;
  type: string;
  status: string;
  dispatch_adapter: string | null;
  build_stage: string;
  assigned_engineer: string | null;
  engine_project_id: string | null;
  engine_workflow_id: string | null;
  tenants: { name: string } | { name: string }[] | null;
};

function tenantName(row: AutomationRow): string {
  const rel = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
  return rel?.name ?? "·";
}

export default async function AutomationsRegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // Defense-in-depth: the admin layout gates, but this server component reads
  // every automation via the service-role key, so it re-checks staff itself.
  await requireStaff();

  const { status: statusParam } = await searchParams;
  const activeStatus =
    statusParam && (STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as AutomationStatus)
      : null;

  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  let query = serviceClient
    .from("automations")
    .select(
      "id, tenant_id, name, type, status, dispatch_adapter, build_stage, assigned_engineer, engine_project_id, engine_workflow_id, tenants(name)",
    )
    .order("created_at", { ascending: false });

  if (activeStatus) query = query.eq("status", activeStatus);

  const { data, error } = await query;
  const automations = (data ?? []) as AutomationRow[];

  // Resolve assigned_engineer (uuid) → user email (one batched query, not N+1).
  const emailByUser = await resolveEngineerEmails(
    serviceClient,
    automations.map((a) => a.assigned_engineer),
  );

  const columns: Column<AutomationRow>[] = [
    { key: "tenant", header: "Tenant", render: (a) => tenantName(a) },
    {
      key: "name",
      header: "Automation",
      render: (a) => <span className="font-medium text-ink">{a.name}</span>,
    },
    { key: "type", header: "Type", render: (a) => a.type },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: "dispatch_adapter",
      header: "Dispatch",
      render: (a) =>
        a.dispatch_adapter ? (
          <span className="capitalize">{a.dispatch_adapter}</span>
        ) : (
          "·"
        ),
    },
    {
      key: "build_stage",
      header: "Build stage",
      render: (a) => <StatusBadge status={a.build_stage} />,
    },
    {
      key: "assigned_engineer",
      header: "Engineer",
      render: (a) =>
        a.assigned_engineer ? emailByUser.get(a.assigned_engineer) ?? "·" : "·",
    },
    {
      // TODO(epic-5): live last-run timestamp + run status come from the engine
      // integration (n8n executions). No runtime data exists yet.
      key: "last_run",
      header: "Last run",
      render: () => "·",
    },
    {
      key: "engine",
      header: "Engine",
      render: (a) => {
        // STAFF-ONLY deeplink, never rendered on any tenant surface. Null when
        // there is no base URL or workflow id, in which case we show nothing.
        const href = buildEngineDeeplink(
          env.N8N_BASE_URL,
          a.engine_project_id,
          a.engine_workflow_id,
        );
        if (!href) return <span className="text-gray-400">·</span>;
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer font-mono text-[11px] font-medium uppercase tracking-wider text-ink underline-offset-2 outline-none transition-colors hover:text-ink hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ink"
          >
            Open in Engine
          </a>
        );
      },
    },
  ];

  const liveCount = automations.filter((a) => a.status === "live").length;
  const buildingCount = automations.filter((a) => a.status === "building").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">
          Automations
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Every automation across all tenants. Cross-tenant registry, staff only.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Total" value={automations.length} />
        <StatCard label="Live" value={liveCount} />
        <StatCard label="Building" value={buildingCount} />
      </div>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-center gap-1.5"
        aria-label="Filter automations by status"
      >
        <span className="mr-1 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
          Status
        </span>
        <FilterPill label="All" href="/admin/automations" active={!activeStatus} />
        {STATUSES.map((s) => (
          <FilterPill
            key={s}
            label={s}
            href={`/admin/automations?status=${s}`}
            active={activeStatus === s}
          />
        ))}
      </form>

      {error && (
        <p
          role="alert"
          className="mt-6 border border-ink bg-brut-red/15 px-4 py-3 text-sm text-brut-red-deep"
        >
          Failed to load automations. Please refresh.
        </p>
      )}

      <div className="mt-6">
        <DataTable
          columns={columns}
          rows={automations}
          getRowKey={(a) => a.id}
          emptyMessage="No automations match this filter."
        />
      </div>
    </div>
  );
}

/** Status filter chip, a plain link so the page stays a server component. */
function FilterPill({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "true" : undefined}
      className={`cursor-pointer rounded border px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink ${
        active
          ? "border-ink bg-brut-lime/25 text-ink"
          : "border-gray-300 bg-paper text-gray-600 hover:border-gray-400 hover:text-ink"
      }`}
    >
      {label}
    </a>
  );
}
