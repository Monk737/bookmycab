"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { sendEmail } from "@/lib/email/resend";
import { automationCreatedEmail, tenantWelcomeEmail } from "@/lib/email/templates";
import { VOICE_IGNITION_SPEC } from "@/lib/billing/pricing";

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

/**
 * Permanently force-deletes a tenant and ALL of its data, even when it has
 * bookings, calls, ledgers, or audit history that a normal delete can't touch.
 *
 * Two-step safety: the caller must type the tenant's exact slug into `confirm`,
 * mirroring the type-to-confirm UI, so a stray click can't wipe a live tenant.
 * The heavy lifting (disabling append-only guards, clearing the NO ACTION audit
 * rows, cascading the rest) lives in the force_delete_tenant SECURITY DEFINER
 * RPC. A durable platform-level audit row (tenant_id null, so it survives the
 * purge) records who deleted what.
 */
export async function forceDeleteTenant(
  tenantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const claims = await requireStaff();
  const client = serviceClient();

  const { data: t } = await client
    .from("tenants")
    .select("name, slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (!t) {
    return { fieldErrors: {}, formError: "Tenant not found." };
  }

  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== t.slug) {
    return {
      fieldErrors: { confirm: [`Type the exact slug "${t.slug as string}" to confirm.`] },
      formError: null,
    };
  }

  const { error } = await client.rpc("force_delete_tenant", { p_tenant: tenantId });
  if (error) {
    console.error("forceDeleteTenant: rpc failed", { tenantId, error });
    return { fieldErrors: {}, formError: "Could not delete the tenant. Please try again." };
  }

  // Platform-level audit (tenant_id null so it is not purged with the tenant).
  await writeAudit({
    actorUserId: claims.sub,
    tenantId: null,
    action: "tenant.force_delete",
    targetType: "tenant",
    targetId: tenantId,
    metadata: { name: t.name as string, slug: t.slug as string },
  });

  redirect("/admin/tenants");
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

  // Email logic depends on whether this is a brand-new account or an existing one:
  //
  //  - NEW account (inviteUserByEmail succeeded): Supabase Auth has already sent
  //    the branded Invite-user email, which carries the "Set your password"
  //    link. We send nothing else, so the set-password step isn't competed with.
  //
  //  - EXISTING account (`inviteError` was an email_exists 422): Supabase sends
  //    NO email for an already-registered address, and the user already has a
  //    password. So we send a branded "you've been added" note via Resend with a
  //    "Sign in to your dashboard" button, otherwise they'd be linked silently
  //    with no notice at all.
  if (inviteError) {
    const { data: t } = await client.from("tenants").select("name").eq("id", tenantId).maybeSingle();
    const body = tenantWelcomeEmail({
      tenantName: (t?.name as string | null) ?? "your organisation",
      role,
      loginUrl: `${env.NEXT_PUBLIC_SITE_URL}/login`,
      invitePending: false,
    });
    await sendEmail({ to: email, subject: body.subject, html: body.html, text: body.text });
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
    // Engine wiring (Voice): the tenant's cloned n8n workflow + Vapi assistant.
    engine_workflow_id: optionalText,
    vapi_assistant_id: optionalText,
    // Engine wiring (Chat): the paired WhatsApp Voice-Note sub-workflow id.
    voice_note_workflow_id: optionalText,
  })
  .superRefine((d, ctx) => {
    if (d.type === "Voice" && !d.phone_number) {
      ctx.addIssue({ code: "custom", path: ["phone_number"], message: "Voice agents need a phone number." });
    }
  });

const wiringSchema = z.object({
  automation_id: z.string().uuid(),
  engine_workflow_id: optionalText,
  vapi_assistant_id: optionalText,
  voice_note_workflow_id: optionalText,
});

/**
 * Wires (or re-wires) an EXISTING automation to its engine: the tenant's cloned
 * n8n workflow id and, for Voice agents, the Vapi assistant id. Setting a
 * workflow id on a still-building automation takes it live (the engine pair
 * exists, so the agent is operational). Clearing both leaves status untouched.
 */
export async function updateAutomationWiring(
  tenantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const claims = await requireStaff();

  const parsed = wiringSchema.safeParse({
    automation_id: formData.get("automation_id"),
    engine_workflow_id: formData.get("engine_workflow_id") ?? undefined,
    vapi_assistant_id: formData.get("vapi_assistant_id") ?? undefined,
    voice_note_workflow_id: formData.get("voice_note_workflow_id") ?? undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>, formError: null };
  }
  const data = parsed.data;
  const client = serviceClient();

  const { data: auto } = await client
    .from("automations")
    .select("id, status")
    .eq("id", data.automation_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!auto) {
    return { fieldErrors: {}, formError: "Automation not found for this tenant." };
  }

  const goLive = Boolean(data.engine_workflow_id) && (auto.status as string) === "building";
  const { error: autoErr } = await client
    .from("automations")
    .update({
      engine_workflow_id: data.engine_workflow_id ?? null,
      voice_note_workflow_id: data.voice_note_workflow_id ?? null,
      ...(goLive ? { status: "live", build_stage: "Live" } : {}),
    })
    .eq("id", data.automation_id);
  if (autoErr) {
    return { fieldErrors: {}, formError: "Could not update the engine wiring. Please try again." };
  }

  // Voice agents also carry the Vapi assistant id (no-op for chat automations).
  await client
    .from("voice_agents")
    .update({ vapi_assistant_id: data.vapi_assistant_id ?? null })
    .eq("automation_id", data.automation_id);

  await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "automation.wire_engine",
    targetType: "automation",
    targetId: data.automation_id,
    metadata: {
      engine_workflow_id: data.engine_workflow_id ?? null,
      vapi_assistant_id: data.vapi_assistant_id ?? null,
      voice_note_workflow_id: data.voice_note_workflow_id ?? null,
      went_live: goLive,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { fieldErrors: {}, formError: null, ok: true };
}

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

  // The form renders fields conditionally on the automation type (Voice shows
  // phone/engine fields, chat shows channel fields). formData.get() returns
  // null for non-rendered fields and zod .optional() rejects null, so every
  // optional field must be coerced or the submit fails on a hidden field with
  // no visible error.
  const parsed = createAutomationSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    dispatch_adapter: formData.get("dispatch_adapter") || undefined,
    phone_number: formData.get("phone_number") ?? undefined,
    channel_type: formData.get("channel_type") || undefined,
    channel_handle: formData.get("channel_handle") ?? undefined,
    engine_workflow_id: formData.get("engine_workflow_id") ?? undefined,
    vapi_assistant_id: formData.get("vapi_assistant_id") ?? undefined,
    voice_note_workflow_id: formData.get("voice_note_workflow_id") ?? undefined,
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
      // Adding voice to a tenant with no voice plan provisions the base AI Voice
      // Ignition plan (1,000 calls / 1 agent). Bespoke allowances are set via a
      // Custom plan at tenant creation, not here.
      const { start, end } = currentMonthBounds();
      const { error: subErr } = await client.from("voice_subscriptions").insert({
        tenant_id: tenantId,
        plan_tier: "ignition",
        monthly_call_allowance: VOICE_IGNITION_SPEC.callAllowance,
        included_agents: VOICE_IGNITION_SPEC.includedAgents,
        monthly_price_gbp: VOICE_IGNITION_SPEC.priceGbp,
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

  // A newly provisioned automation always enters the build queue at the
  // "Building" stage, even when its engine workflow id is supplied up front.
  // Going Live is a deliberate step taken from the Build Queue board (the
  // "Go Live" action), which flips build_stage and runtime status atomically.
  const { data: created, error: autoErr } = await client
    .from("automations")
    .insert({
      tenant_id: tenantId,
      name: data.name,
      type: data.type,
      status: "building",
      build_stage: "Building",
      dispatch_adapter: data.dispatch_adapter ?? null,
      engine_workflow_id: data.engine_workflow_id ?? null,
      voice_note_workflow_id: data.voice_note_workflow_id ?? null,
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
    metadata: { name: data.name, type: data.type, dispatch_adapter: data.dispatch_adapter ?? null, engine_workflow_id: data.engine_workflow_id ?? null, vapi_assistant_id: data.vapi_assistant_id ?? null, voice_note_workflow_id: data.voice_note_workflow_id ?? null },
  });

  // Notify the tenant's primary contact (best-effort; no-op without Resend).
  const { data: tRow } = await client.from("tenants").select("name, contact_email").eq("id", tenantId).maybeSingle();
  const contactEmail = (tRow?.contact_email as string | null) ?? null;
  if (contactEmail) {
    const body = automationCreatedEmail({
      tenantName: (tRow?.name as string | null) ?? "your organisation",
      automationName: data.name,
      automationType: data.type,
      live: false,
      dashboardUrl: `${env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    });
    await sendEmail({ to: contactEmail, subject: body.subject, html: body.html, text: body.text });
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { fieldErrors: {}, formError: null, ok: true };
}

/**
 * Deletes an automation and its engine-side records (voice_agents, channels,
 * config all cascade on the automation_id FK).
 *
 * Guarded against destroying operational history: most automation children
 * cascade-delete, and bookings/conversations would vanish silently while
 * append-only tables (calls, usage_events) would block the delete at the DB.
 * So we refuse when the automation has any booking, call, or conversation
 * history, an admin must stop a live automation rather than delete it. Removing
 * an orphaned or never-used automation stays a one-click action. Fully audited.
 */
export async function deleteAutomation(
  tenantId: string,
  automationId: string,
): Promise<void> {
  const claims = await requireStaff();
  const client = serviceClient();

  const { data: auto } = await client
    .from("automations")
    .select("id, name, type")
    .eq("id", automationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!auto) {
    throw new Error("Automation not found for this tenant.");
  }

  // Refuse to delete anything with operational history (would destroy records
  // or fail against append-only child tables). Count is enough; HEAD requests.
  const [{ count: bookingCount }, { count: callCount }, { count: convoCount }] =
    await Promise.all([
      client.from("bookings").select("id", { count: "exact", head: true }).eq("automation_id", automationId),
      client.from("calls").select("id", { count: "exact", head: true }).eq("automation_id", automationId),
      client.from("conversations").select("id", { count: "exact", head: true }).eq("automation_id", automationId),
    ]);
  if ((bookingCount ?? 0) > 0 || (callCount ?? 0) > 0 || (convoCount ?? 0) > 0) {
    throw new Error(
      "This automation has booking, call, or conversation history and cannot be deleted. Stop it instead to preserve the records.",
    );
  }

  const { error } = await client.from("automations").delete().eq("id", automationId);
  if (error) {
    throw new Error("Failed to delete the automation. Please try again.");
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "automation.delete",
    targetType: "automation",
    targetId: automationId,
    metadata: { name: auto.name as string, type: auto.type as string },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
}

/**
 * Force-deletes an automation INCLUDING its history (bookings, calls,
 * conversations, ledger entries). Use only when `deleteAutomation` refuses
 * because data exists. The force_delete_automation RPC disables the append-only
 * guards so the cascade can proceed. Two-step in the UI (arm, then confirm).
 * Fully audited with the data it destroyed.
 */
export async function forceDeleteAutomation(
  tenantId: string,
  automationId: string,
): Promise<void> {
  const claims = await requireStaff();
  const client = serviceClient();

  const { data: auto } = await client
    .from("automations")
    .select("id, name, type")
    .eq("id", automationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!auto) {
    throw new Error("Automation not found for this tenant.");
  }

  const { error } = await client.rpc("force_delete_automation", { p_automation: automationId });
  if (error) {
    console.error("forceDeleteAutomation: rpc failed", { automationId, error });
    throw new Error("Failed to force-delete the automation. Please try again.");
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "automation.force_delete",
    targetType: "automation",
    targetId: automationId,
    metadata: { name: auto.name as string, type: auto.type as string },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
}
