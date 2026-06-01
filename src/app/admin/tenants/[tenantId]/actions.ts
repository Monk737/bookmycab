"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";

/** Form-state shape shared by the detail-page forms (mirrors the new-tenant form). */
export type ActionState = {
  fieldErrors: Record<string, string[]>;
  formError: string | null;
  ok?: boolean;
};

const RENEWAL_MODES = ["rolling_monthly", "auto_12mo"] as const;
const INVITE_ROLES = ["Owner", "Admin", "Viewer"] as const;

function serviceClient() {
  return createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// Empty-string → undefined so optional date/number fields are not tripped by blanks.
const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const editContractSchema = z.object({
  contract_start: optionalDate,
  contract_renewal: optionalDate,
  monthly_price: z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
      message: "Monthly price must be a non-negative number.",
    })
    .optional(),
  renewal_mode: z.enum(RENEWAL_MODES),
});

/**
 * Updates a tenant's contract terms (start, renewal, monthly price, renewal
 * mode). Defense-in-depth staff check, zod validation, service-role update
 * (admin edits span tenants; RLS would block a normal write), and an audit
 * entry. Revalidates the detail page so the change is reflected immediately.
 */
export async function editContract(
  tenantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const claims = await requireStaff();

  const parsed = editContractSchema.safeParse({
    contract_start: formData.get("contract_start"),
    contract_renewal: formData.get("contract_renewal"),
    monthly_price: formData.get("monthly_price"),
    renewal_mode: formData.get("renewal_mode"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
    };
  }

  const data = parsed.data;

  const { error } = await serviceClient()
    .from("tenants")
    .update({
      contract_start: data.contract_start ?? null,
      contract_renewal: data.contract_renewal ?? null,
      monthly_price: data.monthly_price ?? null,
      renewal_mode: data.renewal_mode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);

  if (error) {
    return { fieldErrors: {}, formError: "Could not update the contract. Please try again." };
  }

  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "tenant.edit_contract",
    targetType: "tenant",
    targetId: tenantId,
    metadata: {
      contract_start: data.contract_start ?? null,
      contract_renewal: data.contract_renewal ?? null,
      monthly_price: data.monthly_price ?? null,
      renewal_mode: data.renewal_mode,
    },
  });
  if (!audited) {
    console.error("audit write failed for tenant.edit_contract", { tenantId });
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { fieldErrors: {}, formError: null, ok: true };
}

/**
 * Shared status-transition helper: staff check → service-role status update →
 * audit → revalidate. Each lifecycle wrapper passes its target status and audit
 * action verb.
 */
async function setStatus(
  tenantId: string,
  status: "suspended" | "active" | "churned",
  action: string,
): Promise<void> {
  const claims = await requireStaff();

  const { error } = await serviceClient()
    .from("tenants")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", tenantId);

  if (error) {
    console.error(`${action} failed`, error);
    return;
  }

  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action,
    targetType: "tenant",
    targetId: tenantId,
    metadata: { status },
  });
  if (!audited) {
    console.error(`audit write failed for ${action}`, { tenantId });
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
}

/** Suspends a tenant (status → 'suspended'). */
export async function suspendTenant(tenantId: string): Promise<void> {
  await setStatus(tenantId, "suspended", "tenant.suspend");
}

/** Reinstates a tenant (status → 'active'). */
export async function reinstateTenant(tenantId: string): Promise<void> {
  await setStatus(tenantId, "active", "tenant.reinstate");
}

/** Marks a tenant as churned (status → 'churned'). */
export async function markChurned(tenantId: string): Promise<void> {
  await setStatus(tenantId, "churned", "tenant.churn");
}

const inviteSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  role: z.enum(INVITE_ROLES),
});

/**
 * Invites a user to a tenant.
 *
 * Validates email + role, then uses the service-role Supabase Auth admin API to
 * create the auth user and send the invite email (local dev → Mailpit). Upserts
 * `public.users` and `public.tenant_users` so the membership exists before the
 * Epic 4 /accept-invite flow runs (acceptance is NOT handled here).
 *
 * Existing-user handling: `inviteUserByEmail` errors when the email already has
 * an auth account. Rather than fail, we look the user up by email and link them
 * to this tenant via a tenant_users upsert — re-inviting an existing person just
 * (re)attaches them to the tenant, which is the intent. Their existing invite is
 * not re-sent in that path.
 *
 * TODO(resend): custom branded email templating comes later; Supabase's built-in
 * invite email is acceptable for now.
 */
export async function sendInvite(
  tenantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const claims = await requireStaff();

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
    };
  }

  const { email, role } = parsed.data;
  const client = serviceClient();

  // Create the auth user + send the invite email.
  const { data: invited, error: inviteError } =
    await client.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/accept-invite`,
    });

  let userId = invited?.user?.id ?? null;

  if (inviteError || !userId) {
    // Existing-user path: find their id and link them to this tenant instead of
    // failing. `public.users.id` mirrors the auth user id (FK to auth.users).
    const { data: existing } = await client
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!existing?.id) {
      return {
        fieldErrors: {},
        formError:
          "Could not invite this user. They may already have an account — check the email and try again.",
      };
    }
    userId = existing.id as string;
  }

  // Ensure a public.users row exists (the invite creates the auth user, but the
  // public mirror row is owned by us). Upsert is idempotent on the PK.
  const { error: userUpsertError } = await client
    .from("users")
    .upsert({ id: userId, email }, { onConflict: "id" });
  if (userUpsertError) {
    console.error("sendInvite: users upsert failed", userUpsertError);
  }

  // Link (or re-link) the user to this tenant with the chosen role.
  const { error: membershipError } = await client.from("tenant_users").upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      role,
      invited_by: claims.sub,
      invited_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (membershipError) {
    return {
      fieldErrors: {},
      formError: "The invite was created but linking the user to the tenant failed.",
    };
  }

  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "tenant.invite",
    targetType: "user",
    targetId: userId,
    metadata: { email, role },
  });
  if (!audited) {
    console.error("audit write failed for tenant.invite", { tenantId, email });
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { fieldErrors: {}, formError: null, ok: true };
}
