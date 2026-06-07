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
 * "view-as" session exists this epoch, this banner is the only visible signal
 * of an active impersonation marker. // TODO(epic-7)
 */
export async function ImpersonationBanner() {
  const record = await readActiveImpersonation();
  if (!record) return null;

  // Resolve display names (best-effort) via the service-role client, the
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
      role="region"
      aria-label="Impersonation active"
      className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-ink bg-brut-red px-8 py-2.5 text-sm text-ink"
    >
      <p className="font-medium">
        <span className="mr-1 inline-block border-2 border-ink bg-ink px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-paper">
          Impersonating
        </span>{" "}
        Viewing as <strong className="font-bold">{targetEmail}</strong> at{" "}
        <strong className="font-bold">{tenantName}</strong>, read-only, expires
        in {minutesLeft} min
      </p>
      <form action={endImpersonation}>
        <button
          type="submit"
          aria-label="End impersonation"
          className="brut-press cursor-pointer border-[3px] border-ink bg-paper px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink shadow-brut-sm outline-none transition-colors hover:bg-ink hover:text-paper focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          End
        </button>
      </form>
    </div>
  );
}
