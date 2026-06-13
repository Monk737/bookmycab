import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { tenantWelcomeEmail } from "@/lib/email/templates";

export type InviteRole = "Owner" | "Admin" | "Viewer";

export interface InviteResult {
  ok: boolean;
  userId: string | null;
  /** Machine-readable failure reason for the caller to map to a field error. */
  error?: "invite_failed" | "no_user" | "membership_failed";
}

/**
 * Invites a user to a tenant and emails them their secure sign-in link.
 *
 * Login deliverability does NOT depend on Supabase's own SMTP. We use
 * `generateLink` to create the auth user and obtain the action link, then send
 * a branded email through Resend (the same path that already delivers automation
 * and billing emails). For an email that already has an account we fall back to
 * a magic-link sign-in and just (re)attach the membership.
 *
 * Idempotent on membership (upsert on tenant_id+user_id). The caller writes the
 * audit entry and decides how to react to the returned `error`.
 */
export async function inviteUserToTenant(args: {
  client: SupabaseClient;
  tenantId: string;
  tenantName: string;
  email: string;
  role: InviteRole;
}): Promise<InviteResult> {
  const { client, tenantId, tenantName, email, role } = args;
  const redirectTo = `${env.NEXT_PUBLIC_SITE_URL}/accept-invite`;

  let actionUrl: string | null = null;
  let userId: string | null = null;
  let newAccount = true;

  const { data, error } = await client.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  if (error) {
    // Only treat an already-registered email as recoverable; anything else
    // (rate limit, transport) is a hard failure rather than silently linking
    // the wrong person.
    const msg = error.message?.toLowerCase() ?? "";
    const exists =
      error.status === 422 ||
      (error as { code?: string }).code === "email_exists" ||
      msg.includes("already") ||
      msg.includes("registered");
    if (!exists) return { ok: false, userId: null, error: "invite_failed" };

    newAccount = false;
    const { data: existing } = await client.from("users").select("id").eq("email", email).maybeSingle();
    userId = (existing?.id as string | undefined) ?? null;
    const { data: ml } = await client.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    actionUrl = ml?.properties?.action_link ?? null;
    userId = userId ?? (ml?.user?.id as string | undefined) ?? null;
  } else {
    actionUrl = data?.properties?.action_link ?? null;
    userId = (data?.user?.id as string | undefined) ?? null;
  }

  if (!userId) return { ok: false, userId: null, error: "no_user" };

  // public.users mirror row (owned by us) + tenant membership.
  await client.from("users").upsert({ id: userId, email }, { onConflict: "id" });
  const { error: memErr } = await client.from("tenant_users").upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      role,
      // invited_by FKs public.users(id); a staff auth user may have no mirror
      // row, so leave null (actor attribution lives in audit_log).
      invited_by: null,
      invited_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (memErr) return { ok: false, userId, error: "membership_failed" };

  // The login email, via Resend (best-effort, no-op when Resend is unconfigured).
  const body = tenantWelcomeEmail({
    tenantName,
    role,
    actionUrl: actionUrl ?? `${env.NEXT_PUBLIC_SITE_URL}/login`,
    newAccount,
  });
  await sendEmail({ to: email, subject: body.subject, html: body.html, text: body.text });

  return { ok: true, userId };
}
