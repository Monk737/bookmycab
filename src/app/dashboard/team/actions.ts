"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { requireOrgAccess } from "@/lib/api/guard";
import { writeAudit } from "@/lib/audit";

export type ActionState = { ok: boolean; error?: string };

const ROLES = ["Owner", "Admin", "Viewer"] as const;

const inviteSchema = z.object({
  email: z.string().email("A valid email address is required."),
  role: z.enum(ROLES, { errorMap: () => ({ message: "Choose a valid role." }) }),
  automationRestrictions: z.array(z.string()).default([]),
});

const roleSchema = z.enum(ROLES, { errorMap: () => ({ message: "Choose a valid role." }) });

/** Service-role Supabase client — never exposed outside server actions. */
function serviceClient() {
  return createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Invites a new team member via Supabase Auth invite email.
 * Owner-gated. On success: inserts a `tenant_users` row and writes an audit entry.
 * The invite email is acceptable audit metadata; tokens/secrets are never included.
 */
export async function inviteMember(
  orgId: string,
  input: { email: string; role: string; automationRestrictions: string[] },
): Promise<ActionState> {
  const access = await requireOrgAccess(orgId, { minRole: "Owner" });
  if (access instanceof NextResponse) {
    return { ok: false, error: "Not authorised." };
  }
  const { claims } = access;
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "Invalid input.";
    return { ok: false, error: msg };
  }
  const { email, role, automationRestrictions } = parsed.data;

  const client = serviceClient();

  const { data: inviteData, error: inviteError } = await client.auth.admin.inviteUserByEmail(email);
  if (inviteError || !inviteData?.user?.id) {
    console.error("inviteMember: inviteUserByEmail failed", inviteError);
    return { ok: false, error: "Failed to send the invite. Please try again." };
  }

  const invitedId = inviteData.user.id;
  const now = new Date().toISOString();

  // Upsert the public.users row (handle_new_user may not have fired yet for invited users).
  await client.from("users").upsert({ id: invitedId, email }, { onConflict: "id" });

  // Insert the tenant membership row.
  const { error: tuError } = await client.from("tenant_users").insert({
    tenant_id: orgId,
    user_id: invitedId,
    role,
    automation_restrictions: automationRestrictions,
    invited_by: claims.sub,
    invited_at: now,
  });

  if (tuError) {
    console.error("inviteMember: tenant_users insert failed", tuError);
    return { ok: false, error: "Invite sent but could not create the membership record." };
  }

  // NEVER include tokens/secrets in audit metadata.
  await writeAudit({
    actorUserId: claims.sub,
    tenantId: orgId,
    action: "team.invite",
    targetType: "user",
    targetId: invitedId,
    metadata: { email, role },
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}

/**
 * Changes an existing team member's role (and optionally automation restrictions).
 * Owner-gated. Writes an audit entry on success.
 */
export async function changeRole(
  orgId: string,
  userId: string,
  role: string,
  automationRestrictions?: string[],
): Promise<ActionState> {
  const access = await requireOrgAccess(orgId, { minRole: "Owner" });
  if (access instanceof NextResponse) {
    return { ok: false, error: "Not authorised." };
  }
  const { claims } = access;
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };

  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) {
    return { ok: false, error: "Choose a valid role." };
  }

  const client = serviceClient();

  // Last-Owner guard: demoting the sole Owner would leave the tenant with no one
  // able to manage the team. Only check when the change moves a user OUT of Owner.
  if (parsedRole.data !== "Owner") {
    const { data: owners, error: countError } = await client
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", orgId)
      .eq("role", "Owner");
    if (countError) {
      console.error("changeRole: owner count query failed", countError);
      return { ok: false, error: "Could not verify team composition. Please try again." };
    }
    const ownerIds: string[] = (owners ?? []).map((r: { user_id: string }) => r.user_id);
    if (ownerIds.includes(userId) && ownerIds.length === 1) {
      return { ok: false, error: "Cannot demote the last owner." };
    }
  }

  const patch: Record<string, unknown> = { role: parsedRole.data };
  if (automationRestrictions !== undefined) {
    patch.automation_restrictions = automationRestrictions;
  }

  const { error } = await client
    .from("tenant_users")
    .update(patch)
    .eq("tenant_id", orgId)
    .eq("user_id", userId);

  if (error) {
    console.error("changeRole: update failed", error);
    return { ok: false, error: "Could not update the role. Please try again." };
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: orgId,
    action: "team.role_change",
    targetType: "user",
    targetId: userId,
    metadata: { role: parsedRole.data },
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}

/**
 * Removes a team member from the tenant.
 * Owner-gated. Guards against removing the last Owner.
 * Writes an audit entry on success.
 */
export async function revokeMember(orgId: string, userId: string): Promise<ActionState> {
  const access = await requireOrgAccess(orgId, { minRole: "Owner" });
  if (access instanceof NextResponse) {
    return { ok: false, error: "Not authorised." };
  }
  const { claims } = access;
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };

  const client = serviceClient();

  // Last-Owner guard: count Owner rows for this tenant excluding any non-target users.
  const { data: owners, error: countError } = await client
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", orgId)
    .eq("role", "Owner");

  if (countError) {
    console.error("revokeMember: owner count query failed", countError);
    return { ok: false, error: "Could not verify team composition. Please try again." };
  }

  const ownerIds: string[] = (owners ?? []).map((r: { user_id: string }) => r.user_id);
  if (ownerIds.includes(userId) && ownerIds.length === 1) {
    return { ok: false, error: "Cannot remove the last owner." };
  }

  const { error } = await client
    .from("tenant_users")
    .delete()
    .eq("tenant_id", orgId)
    .eq("user_id", userId);

  if (error) {
    console.error("revokeMember: delete failed", error);
    return { ok: false, error: "Could not remove the member. Please try again." };
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId: orgId,
    action: "team.revoke",
    targetType: "user",
    targetId: userId,
    metadata: {},
  });

  revalidatePath("/dashboard/team");
  return { ok: true };
}
