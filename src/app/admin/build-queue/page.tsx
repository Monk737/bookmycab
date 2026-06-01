import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { resolveEngineerEmails } from "@/lib/admin/resolve-engineers";
import { BuildQueueBoard, type BuildCard } from "./build-queue-board";

// Always read fresh — stage moves and Go Live should be reflected immediately.
export const dynamic = "force-dynamic";

type AutomationRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  build_stage: string;
  assigned_engineer: string | null;
  target_go_live: string | null;
  build_notes: string | null;
  tenants: { name: string } | { name: string }[] | null;
};

function tenantName(row: AutomationRow): string {
  const rel = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
  return rel?.name ?? "—";
}

export default async function BuildQueuePage() {
  // Defense-in-depth: re-check staff since this reads every tenant's automations
  // via the service-role key.
  await requireStaff();

  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data, error } = await serviceClient
    .from("automations")
    .select(
      "id, name, type, status, build_stage, assigned_engineer, target_go_live, build_notes, tenants(name)",
    )
    .order("target_go_live", { ascending: true, nullsFirst: false });

  const automations = (data ?? []) as AutomationRow[];

  // Resolve assigned_engineer (uuid) → email (one batched query, not N+1).
  const emailByUser = await resolveEngineerEmails(
    serviceClient,
    automations.map((a) => a.assigned_engineer),
  );

  const cards: BuildCard[] = automations.map((a) => ({
    id: a.id,
    tenantName: tenantName(a),
    name: a.name,
    type: a.type,
    status: a.status,
    buildStage: a.build_stage,
    engineerEmail: a.assigned_engineer
      ? emailByUser.get(a.assigned_engineer) ?? null
      : null,
    targetGoLive: a.target_go_live,
    buildNotes: a.build_notes,
  }));

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Build Queue
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Provisioning pipeline across all tenants. Move cards through the stages;
          take UAT automations live. Staff only.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Failed to load the build queue. Please refresh.
        </p>
      )}

      <div className="mt-6">
        <BuildQueueBoard cards={cards} />
      </div>
    </div>
  );
}
