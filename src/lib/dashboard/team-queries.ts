import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseLike } from "@/lib/dashboard/queries";

export interface MemberRow {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: string;
  automationRestrictions: string[] | null;
  lastLoginAt: string | null;
}

export async function listMembers(tenantId: string, client?: SupabaseLike): Promise<MemberRow[]> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("tenant_users")
    // Two FKs point at users (user_id, invited_by); name the member FK or
    // PostgREST rejects the embed as ambiguous (HTTP 300).
    .select("role, automation_restrictions, user_id, users!tenant_users_user_id_fkey(email, full_name, last_login_at)")
    .eq("tenant_id", tenantId);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const u = (r.users as Record<string, unknown> | null) ?? {};
    return {
      userId: r.user_id as string,
      email: (u.email as string | null) ?? null,
      fullName: (u.full_name as string | null) ?? null,
      role: r.role as string,
      automationRestrictions: (r.automation_restrictions as string[] | null) ?? null,
      lastLoginAt: (u.last_login_at as string | null) ?? null,
    };
  });
}

export interface AuditRow {
  action: string;
  targetType: string | null;
  targetId: string | null;
  actorUserId: string | null;
  ts: string;
}

// audit_log has no tenant SELECT under RLS (migrations 0005/0011); callers MUST pass a service-role
// client (Owner-gated), the default RLS client returns nothing.
export async function listAudit(tenantId: string, limit = 50, client?: SupabaseLike): Promise<AuditRow[]> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("audit_log")
    .select("action, target_type, target_id, actor_user_id, ts")
    .eq("tenant_id", tenantId)
    .order("ts", { ascending: false })
    .limit(limit);

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    action: r.action as string,
    targetType: (r.target_type as string | null) ?? null,
    targetId: (r.target_id as string | null) ?? null,
    actorUserId: (r.actor_user_id as string | null) ?? null,
    ts: r.ts as string,
  }));
}
