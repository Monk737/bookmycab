import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { StatusBadge } from "@/components/admin/status-badge";
import { StartControl } from "./start-control";

// Search reads live membership the instant staff provision a tenant.
export const dynamic = "force-dynamic";

type Candidate = {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  userId: string;
  email: string;
  role: string;
};

function serviceClient() {
  return createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Searches tenant_users joined to tenants + users by tenant name OR user email.
 * Returns up to 50 candidate (tenant, user) pairs. Service-role read: admin
 * search spans all tenants, which RLS would otherwise block.
 */
async function search(q: string): Promise<{ rows: Candidate[]; error: boolean }> {
  const term = q.trim();
  if (term.length === 0) return { rows: [], error: false };

  const client = serviceClient();
  const like = `%${term}%`;

  const { data, error } = await client
    .from("tenant_users")
    .select(
      "role, tenant:tenants!inner(id, name, status), user:users!inner(id, email)",
    )
    .or(`name.ilike.${like}`, { referencedTable: "tenants" })
    .limit(50);

  // The OR above only matches tenant name; run a second query for email matches
  // and merge (Supabase can't OR across two joined tables in one filter).
  const emailQuery = await client
    .from("tenant_users")
    .select(
      "role, tenant:tenants!inner(id, name, status), user:users!inner(id, email)",
    )
    .or(`email.ilike.${like}`, { referencedTable: "users" })
    .limit(50);

  if (error && emailQuery.error) return { rows: [], error: true };

  type Joined = {
    role: string;
    tenant: { id: string; name: string; status: string } | null;
    user: { id: string; email: string } | null;
  };

  const merged = [
    ...((data ?? []) as unknown as Joined[]),
    ...((emailQuery.data ?? []) as unknown as Joined[]),
  ];

  const seen = new Set<string>();
  const rows: Candidate[] = [];
  for (const r of merged) {
    if (!r.tenant || !r.user) continue;
    const key = `${r.tenant.id}:${r.user.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      tenantId: r.tenant.id,
      tenantName: r.tenant.name,
      tenantStatus: r.tenant.status,
      userId: r.user.id,
      email: r.user.email,
      role: r.role,
    });
  }
  rows.sort((a, b) => a.tenantName.localeCompare(b.tenantName) || a.email.localeCompare(b.email));
  return { rows, error: false };
}

export default async function ImpersonatePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Defense-in-depth on top of the layout guard: this reads every tenant's
  // membership via the service-role key.
  await requireStaff();

  const { q = "" } = await searchParams;
  const { rows, error } = await search(q);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
        Impersonate
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        Start a read-only, 15-minute, audited impersonation session. A reason is
        mandatory. The tenant view-as dashboard arrives in a later epic &mdash;
        this records the audited marker and shows a persistent banner.
      </p>

      <form method="get" className="mt-6 flex flex-wrap items-center gap-2">
        <label htmlFor="q" className="sr-only">
          Search by tenant name or user email
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search by tenant name or user email…"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors hover:border-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        />
        <button
          type="submit"
          className="shrink-0 cursor-pointer rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Search
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Search failed. Please try again.
        </p>
      )}

      <div className="mt-6 space-y-3">
        {q.trim().length === 0 ? (
          <p className="text-sm text-zinc-500">
            Enter a tenant name or user email to find someone to impersonate.
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No matching tenant users.</p>
        ) : (
          rows.map((c) => (
            <div
              key={`${c.tenantId}:${c.userId}`}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {c.email}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {c.tenantName} &middot; {c.role}
                  </p>
                </div>
                <StatusBadge status={c.tenantStatus} />
              </div>
              <div className="mt-3">
                <StartControl
                  tenantId={c.tenantId}
                  targetUserId={c.userId}
                  label={c.email}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
