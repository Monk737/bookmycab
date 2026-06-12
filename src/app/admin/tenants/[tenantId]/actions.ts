"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { VOICE_PLAN_SPEC, VOICE_PRICE_GBP, type NewTierKey } from "@/lib/billing/pricing";

/** Form-state shape shared by the detail-page forms (mirrors the new-tenant form). */
export type ActionState = {
  fieldErrors: Record<string, string[]>;
  formError: string | null;
  ok?: boolean;
};

const RENEWAL_MODES = ["rolling_monthly", "auto_12mo"] as const;
const INVITE_ROLES = ["Owner", "Admin", "Viewer"] as const;
const DISPATCH_ADAPTERS = ["autocab", "icabbi", "cordic"] as const;
const AUTOMATION_TYPES = ["Booking", "Support", "Driver", "Custom", "Voice"] as const;
const CHANNEL_TYPES = ["whatsapp", "telegram", "messenger", "instagram", "widget"] as const;
const VOICE_TIERS = ["ignition", "in_motion", "full_throttle"] as const;

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

// Generic optional free-text field (blank → undefined).
const optionalText = optionalDate;

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
    // Throw so Next surfaces an error to the staff member rather than silently
    // returning, a failed suspend/reinstate/churn must NOT look successful.
    console.error(`${action} failed`, error);
    throw new Error(`Failed to update tenant status (${action}).`);
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
 * to this tenant via a tenant_users upsert, re-inviting an existing person just
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

  if (inviteError) {
    // Only fall through to the existing-user path when the error genuinely means
    // the email is already registered. The Supabase AuthError exposes `status`
    // (HTTP) and `code` (machine code); an already-registered email is 422 /
    // `email_exists`. Any other error (429 rate-limit, 503, network) is a hard
    // failure, attaching some other user who shares this email would be wrong,
    // and reporting success when no email was sent is worse. So short-circuit.
    const msg = inviteError.message?.toLowerCase() ?? "";
    const alreadyRegistered =
      inviteError.status === 422 ||
      inviteError.code === "email_exists" ||
      msg.includes("already");

    if (!alreadyRegistered) {
      return {
        fieldErrors: {},
        formError: "Could not send the invite, please try again.",
      };
    }

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
          "Could not invite this user. They may already have an account, check the email and try again.",
      };
    }
    userId = existing.id as string;
  }

  if (!userId) {
    // No error but also no user id, treat as a hard failure rather than
    // proceeding with a null id.
    return {
      fieldErrors: {},
      formError: "Could not send the invite, please try again.",
    };
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
      // invited_by FKs to public.users(id). A FlowMo staff auth user may have no
      // public.users row (no handle_new_user trigger), so claims.sub could
      // violate the FK (23503) and block the invite. The column is nullable;
      // actor attribution lives in audit_log, which is the source of truth for
      // who invited whom.
      invited_by: null,
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

/* ----------------------------------------------------------------------------
   Granular organisation + membership management (staff authority).
   -------------------------------------------------------------------------- */

const editOrgSchema = z.object({
  name: z.string().trim().min(1, "Organisation name is required."),
  contact_email: z.string().trim().email("Enter a valid contact email."),
  dispatch_adapter: z.enum(DISPATCH_ADAPTERS),
  dispatch_company_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

/** Edits an organisation's profile (name, contact email, dispatch binding). */
export async function editOrgProfile(
  tenantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const claims = await requireStaff();

  const parsed = editOrgSchema.safeParse({
    name: formData.get("name"),
    contact_email: formData.get("contact_email"),
    dispatch_adapter: formData.get("dispatch_adapter"),
    dispatch_company_id: formData.get("dispatch_company_id"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>, formError: null };
  }
  const data = parsed.data;

  const { error } = await serviceClient()
    .from("tenants")
    .update({
      name: data.name,
      contact_email: data.contact_email,
      dispatch_adapter: data.dispatch_adapter,
      dispatch_company_id: data.dispatch_company_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tenantId);
  if (error) {
    return { fieldErrors: {}, formError: "Could not update the organisation. Please try again." };
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "tenant.edit_profile",
    targetType: "tenant",
    targetId: tenantId,
    metadata: { name: data.name, contact_email: data.contact_email, dispatch_adapter: data.dispatch_adapter },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { fieldErrors: {}, formError: null, ok: true };
}

/** Counts the active Owner memberships for a tenant (last-owner guard). */
async function ownerCount(client: ReturnType<typeof serviceClient>, tenantId: string): Promise<number> {
  const { count } = await client
    .from("tenant_users")
    .select("user_id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("role", "Owner");
  return count ?? 0;
}

/**
 * Changes a member's role within a tenant. Refuses to demote the last Owner so a
 * tenant is never left without one. Throws on guard violation so the staff member
 * sees the failure rather than a silent no-op.
 */
export async function setMemberRole(tenantId: string, userId: string, formData: FormData): Promise<void> {
  const claims = await requireStaff();
  const role = String(formData.get("role") ?? "");
  if (!(INVITE_ROLES as readonly string[]).includes(role)) {
    throw new Error("Invalid role.");
  }
  const client = serviceClient();

  if (role !== "Owner") {
    const { data: current } = await client
      .from("tenant_users")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (current?.role === "Owner" && (await ownerCount(client, tenantId)) <= 1) {
      throw new Error("Cannot change the last Owner. Promote another member to Owner first.");
    }
  }

  const { error } = await client
    .from("tenant_users")
    .update({ role })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error("Failed to change the member's role.");

  await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "tenant.member_role_change",
    targetType: "user",
    targetId: userId,
    metadata: { role },
  });
  revalidatePath(`/admin/tenants/${tenantId}`);
}

/** Removes a member from a tenant. Refuses to remove the last Owner. */
export async function removeMember(tenantId: string, userId: string): Promise<void> {
  const claims = await requireStaff();
  const client = serviceClient();

  const { data: current } = await client
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (current?.role === "Owner" && (await ownerCount(client, tenantId)) <= 1) {
    throw new Error("Cannot remove the last Owner. Assign another Owner first.");
  }

  const { error } = await client
    .from("tenant_users")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  if (error) throw new Error("Failed to remove the member.");

  await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "tenant.member_remove",
    targetType: "user",
    targetId: userId,
    metadata: {},
  });
  revalidatePath(`/admin/tenants/${tenantId}`);
}

/* ----------------------------------------------------------------------------
   Manual automation provisioning (DB record only; engine wired separately).
   -------------------------------------------------------------------------- */

const createAutomationSchema = z
  .object({
    name: z.string().trim().min(1, "Automation name is required."),
    type: z.enum(AUTOMATION_TYPES),
    dispatch_adapter: z.enum(DISPATCH_ADAPTERS).optional(),
    phone_number: optionalText,
    channel_type: z.enum(CHANNEL_TYPES).optional(),
    channel_handle: optionalText,
    // Only used when adding a Voice agent to a tenant with no voice plan yet.
    voice_tier: z.enum(VOICE_TIERS).optional(),
    // Engine wiring (Voice): the tenant's cloned n8n workflow + Vapi assistant.
    engine_workflow_id: optionalText,
    vapi_assistant_id: optionalText,
  })
  .superRefine((d, ctx) => {
    if (d.type === "Voice" && !d.phone_number) {
      ctx.addIssue({ code: "custom", path: ["phone_number"], message: "Voice agents need a phone number." });
    }
  });

/** First/last day of the current month as YYYY-MM-DD (voice plan period). */
function currentMonthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/**
 * Creates an automation record for a tenant. For a Voice automation it also
 * creates the voice_agent (phone number); for a chat automation an optional
 * channel can be bound. Status starts at 'building' / 'Requested' — engineers
 * wire the actual engine workflow afterwards. Fully audited.
 */
export async function createAutomation(
  tenantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const claims = await requireStaff();

  const parsed = createAutomationSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    dispatch_adapter: formData.get("dispatch_adapter") || undefined,
    phone_number: formData.get("phone_number"),
    channel_type: formData.get("channel_type") || undefined,
    channel_handle: formData.get("channel_handle"),
    voice_tier: formData.get("voice_tier") || undefined,
    engine_workflow_id: formData.get("engine_workflow_id"),
    vapi_assistant_id: formData.get("vapi_assistant_id"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>, formError: null };
  }
  const data = parsed.data;
  const client = serviceClient();

  // Adding a Voice agent to a tenant that has no voice plan would leave the
  // tenant's call pool at 0/0. Provision a voice_subscription first (and flip the
  // commercial_model so the tenant Voice surface unlocks).
  if (data.type === "Voice") {
    const { data: existingVoice } = await client
      .from("voice_subscriptions")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!existingVoice) {
      if (!data.voice_tier) {
        return {
          fieldErrors: { voice_tier: ["Pick a voice plan tier (this tenant has no voice plan yet)."] },
          formError: null,
        };
      }
      const tier = data.voice_tier as NewTierKey;
      const spec = VOICE_PLAN_SPEC[tier];
      const { start, end } = currentMonthBounds();
      const { error: subErr } = await client.from("voice_subscriptions").insert({
        tenant_id: tenantId,
        plan_tier: tier,
        monthly_call_allowance: spec.callAllowance,
        included_agents: spec.includedAgents,
        monthly_price_gbp: VOICE_PRICE_GBP[tier],
        status: "active",
        current_period_start: start,
        current_period_end: end,
      });
      if (subErr) {
        return { fieldErrors: {}, formError: "Could not provision the voice plan. Please try again." };
      }
      // Unlock the voice product: chat-only → double_decker, otherwise → voice.
      const { data: tRow } = await client.from("tenants").select("commercial_model").eq("id", tenantId).maybeSingle();
      const cm = (tRow?.commercial_model as string | null) ?? null;
      const nextModel = cm === "chat" || cm === "double_decker" ? "double_decker" : "voice";
      if (cm !== nextModel) {
        await client.from("tenants").update({ commercial_model: nextModel }).eq("id", tenantId);
      }
    }
  }

  // When the engine workflow id is supplied at creation time the automation is
  // already wired (cloned n8n workflow + Vapi assistant exist) — it goes
  // straight to live. Otherwise it starts in the build queue as before.
  const wired = Boolean(data.engine_workflow_id);
  const { data: created, error: autoErr } = await client
    .from("automations")
    .insert({
      tenant_id: tenantId,
      name: data.name,
      type: data.type,
      status: wired ? "live" : "building",
      build_stage: wired ? "Live" : "Requested",
      dispatch_adapter: data.dispatch_adapter ?? null,
      engine_workflow_id: data.engine_workflow_id ?? null,
    })
    .select("id")
    .single();
  if (autoErr || !created) {
    return { fieldErrors: {}, formError: "Could not create the automation. Please try again." };
  }
  const automationId = created.id as string;

  if (data.type === "Voice") {
    const { error: agentErr } = await client.from("voice_agents").insert({
      automation_id: automationId,
      tenant_id: tenantId,
      display_name: data.name,
      phone_number: data.phone_number ?? null,
      vapi_assistant_id: data.vapi_assistant_id ?? null,
    });
    if (agentErr) {
      // Roll back the orphan automation so a failed agent insert isn't left half-provisioned.
      await client.from("automations").delete().eq("id", automationId);
      return { fieldErrors: {}, formError: "Could not create the voice agent. Please try again." };
    }
  } else if (data.channel_type) {
    const { error: chErr } = await client.from("channels").insert({
      tenant_id: tenantId,
      automation_id: automationId,
      type: data.channel_type,
      webhook_path: `/webhooks/${data.channel_type}/${automationId}`,
      external_id: data.channel_handle ?? null,
      status: "active",
    });
    if (chErr) {
      console.error("createAutomation: channel insert failed", chErr);
      // Keep the automation; the channel can be added later. Surface a soft notice.
      return { fieldErrors: {}, formError: "Automation created, but binding the channel failed. Add it from Channels." };
    }
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "tenant.create_automation",
    targetType: "automation",
    targetId: automationId,
    metadata: { name: data.name, type: data.type, dispatch_adapter: data.dispatch_adapter ?? null, engine_workflow_id: data.engine_workflow_id ?? null, vapi_assistant_id: data.vapi_assistant_id ?? null },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { fieldErrors: {}, formError: null, ok: true };
}
