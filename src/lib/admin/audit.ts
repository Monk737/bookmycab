import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";

/**
 * Input contract for an admin audit-log entry. This is the single, centralized
 * shape every admin action must use — keep all writes flowing through
 * `writeAudit` so the audit contract lives in one place.
 */
export type AuditEntry = {
  /** UUID of the staff user performing the action. */
  actorUserId: string;
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
 * key (which bypasses RLS) — same privileged-write pattern as recordLogin /
 * acceptInvite in `src/app/(auth)/actions.ts`. Server-only: this module reads
 * the service-role key, so it must only ever be imported from server code —
 * never from a Client Component.
 *
 * `ip_address` is passed as null; capturing the request IP is the caller's
 * concern and is not trivially available here.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

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
  }
}
