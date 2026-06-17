import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";

/**
 * Input contract for an admin audit-log entry. This is the single, centralized
 * shape every admin action must use, keep all writes flowing through
 * `writeAudit` so the audit contract lives in one place.
 */
export type AuditEntry = {
  /** UUID of the user performing the action, or null for system / webhook-driven
   *  actions (e.g. billing-driven automation pause/resume). The column is a
   *  nullable FK, so null is a valid actor. */
  actorUserId: string | null;
  /** Tenant the action targets, when applicable (null for platform-wide actions). */
  tenantId?: string | null;
  /** Required machine-readable action verb, e.g. "tenant.provision". */
  action: string;
  /** Optional entity type the action targets, e.g. "tenant", "automation". */
  targetType?: string | null;
  /** Optional id of the targeted entity. */
  targetId?: string | null;
  /** Optional structured context stored as jsonb. */
  metadata?: Record<string, unknown> | null;
};

/**
 * Appends a row to `public.audit_log` using the service-role client.
 *
 * `audit_log` RLS hard-denies tenant users, so this MUST use the service-role
 * key (which bypasses RLS), same privileged-write pattern as recordLogin /
 * acceptInvite in `src/app/(auth)/actions.ts`. Server-only: this module reads
 * the service-role key, so it must only ever be imported from server code ,
 * never from a Client Component.
 *
 * `ip_address` is passed as null; capturing the request IP is the caller's
 * concern and is not trivially available here.
 *
 * @returns `true` when the row was inserted successfully, `false` when the
 * insert errored. Never throws and never blocks the admin action, a failed
 * audit write is logged via `console.error` and callers decide how to react
 * to the returned boolean.
 */
export async function writeAudit(entry: AuditEntry): Promise<boolean> {
  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Wrapped in try/catch so any unexpected throw (transport failure, or a thrown
  // FK violation on actor_user_id when a staff user has no public.users row) is
  // logged and downgraded to `false` rather than crashing the calling action.
  // A FK error normally surfaces as the returned `error`, but we guard against
  // throws too so the "never throws, never blocks" contract holds.
  try {
    const { error } = await serviceClient.from("audit_log").insert({
      tenant_id: entry.tenantId ?? null,
      actor_user_id: entry.actorUserId,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? null,
      ip_address: null,
    });

    if (error) {
      console.error("writeAudit failed", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("writeAudit threw", err);
    return false;
  }
}
