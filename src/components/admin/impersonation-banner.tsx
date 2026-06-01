import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { readActiveImpersonation } from "@/lib/admin/impersonation-cookie";
import { endImpersonation } from "@/app/admin/impersonate/actions";

/**
 * Persistent impersonation banner. Server component: reads the read-only
 * impersonation marker cookie and, when one is ACTIVE (not expired), shows who
 * is being impersonated, the read-only notice, the minutes remaining, and an
 * "End" control wired to the `endImpersonation` server action.
 *
 * When no marker is present or it has expired, renders nothing. No tenant
 * "view-as" session exists this epoch — this banner is the only visible signal
 * of an active impersonation marker. // TODO(epic-7)
 */
export async function ImpersonationBanner() {
  const record = await readActiveImpersonation();
  if (!record) return null;

  // Resolve display names (best-effort) via the service-role client — the
  // marker stores only ids. Failure falls back to the ids.
  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const [tenantRes, userRes] = await Promise.all([
    serviceClient.from("tenants").select("name").eq("id", record.tenantId).maybeSingle(),
    serviceClient.from("users").select("email").eq("id", record.targetUserId).maybeSingle(),
  ]);

  const tenantName = (tenantRes.data?.name as string | undefined) ?? record.tenantId;
  const targetEmail = (userRes.data?.email as string | undefined) ?? record.targetUserId;

  const minutesLeft = Math.max(
    0,
    Math.ceil((record.expiresAt - Date.now()) / 60000),
  );

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/50 bg-amber-500/15 px-8 py-2.5 text-sm text-amber-900"
    >
      <p>
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-amber-700">
          Impersonating
        </span>{" "}
        Viewing as <strong className="font-semibold">{targetEmail}</strong> at{" "}
        <strong className="font-semibold">{tenantName}</strong> &mdash; read-only
        &mdash; expires in {minutesLeft} min
      </p>
      <form action={endImpersonation}>
        <button
          type="submit"
          className="cursor-pointer rounded-md border border-amber-600/40 bg-white px-3 py-1 text-xs font-medium text-amber-800 outline-none transition-colors hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          End
        </button>
      </form>
    </div>
  );
}
