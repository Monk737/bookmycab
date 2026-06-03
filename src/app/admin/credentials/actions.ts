"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { CREDENTIAL_TYPES } from "./credential-types";

/** Form-state shape shared by the credentials forms (mirrors the tenant forms). */
export type ActionState = {
  fieldErrors: Record<string, string[]>;
  formError: string | null;
  ok?: boolean;
};

function serviceClient() {
  return createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

const idSchema = z.string().uuid();

const addSchema = z.object({
  tenant_id: z.string().uuid("Select a tenant."),
  channel_id: z.string().uuid("Select a channel."),
  credential_type: z.enum(CREDENTIAL_TYPES, {
    errorMap: () => ({ message: "Choose a valid credential type." }),
  }),
  secret: z.string().min(1, "The secret value is required."),
});

/**
 * Adds (encrypts + stores) a channel credential via the vault.
 *
 * Staff guard first (capturing claims for the audit actor), zod validation,
 * then `vault_store_credential_rpc` through the service-role client — the RPC
 * sets `app.vault_key` transaction-locally from the env key and delegates to
 * the SECURITY DEFINER vault function, so the plaintext is encrypted server-side
 * by pgcrypto and never stored in the clear. The secret is NEVER written to the
 * audit metadata or logs. Throws on a DB error so a failed store surfaces.
 */
export async function addCredential(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const claims = await requireStaff();

  const parsed = addSchema.safeParse({
    tenant_id: formData.get("tenant_id"),
    channel_id: formData.get("channel_id"),
    credential_type: formData.get("credential_type"),
    secret: formData.get("secret"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      formError: null,
    };
  }

  const { tenant_id, channel_id, credential_type, secret } = parsed.data;

  const { error } = await serviceClient().rpc("vault_store_credential_rpc", {
    p_tenant_id: tenant_id,
    p_channel_id: channel_id,
    p_credential_type: credential_type,
    p_secret: secret,
    // Staff users may have no public.users row (no handle_new_user trigger);
    // created_by FKs to public.users and is nullable, so pass null rather than
    // risk a 23503. Actor attribution lives in the audit_log below.
    p_created_by: null,
    p_key: env.SUPABASE_VAULT_KEY,
  });

  if (error) {
    console.error("addCredential failed", error);
    return {
      fieldErrors: {},
      formError: "Could not store the credential. Please try again.",
    };
  }

  // NEVER include the secret in audit metadata.
  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId: tenant_id,
    action: "credential.add",
    targetType: "channel",
    targetId: channel_id,
    metadata: { tenant_id, channel_id, credential_type },
  });
  if (!audited) {
    console.error("audit write failed for credential.add", { channel_id });
  }

  revalidatePath("/admin/credentials");
  return { fieldErrors: {}, formError: null, ok: true };
}

/**
 * Reveals (decrypts) a stored credential — a deliberate, audited senior-ops
 * action. Calls `vault_read_credential_rpc`, which decrypts and stamps
 * last_accessed_at/by. The decrypted plaintext is RETURNED to the caller for
 * transient display only; it is NEVER logged and NEVER written to audit
 * metadata. The audit row records who viewed which credential, not its value.
 *
 * TODO(senior-ops-role): reveal/rotate should be gated on a dedicated senior-ops
 * claim once that role exists. requireStaff (is_flowmo_staff) is the current
 * gate — tighten this when the finer-grained role lands.
 */
export async function revealCredential(
  id: string,
): Promise<{ ok: true; secret: string } | { ok: false; error: string }> {
  const claims = await requireStaff();

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: "Invalid credential id." };
  }
  const credId = parsed.data;

  // Read tenant/channel for the audit metadata WITHOUT touching secret_encrypted.
  const { data: row } = await serviceClient()
    .from("channel_credentials")
    .select("tenant_id, channel_id")
    .eq("id", credId)
    .maybeSingle();

  const { data: secret, error } = await serviceClient().rpc(
    "vault_read_credential_rpc",
    {
      p_id: credId,
      p_accessed_by: null,
      p_key: env.SUPABASE_VAULT_KEY,
    },
  );

  if (error || typeof secret !== "string") {
    console.error("revealCredential failed", error);
    return { ok: false, error: "Could not reveal the credential." };
  }

  // NEVER include the plaintext secret in audit metadata.
  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId: (row?.tenant_id as string | undefined) ?? null,
    action: "credential.view",
    targetType: "credential",
    targetId: credId,
    metadata: {
      credential_id: credId,
      tenant_id: (row?.tenant_id as string | undefined) ?? null,
      channel_id: (row?.channel_id as string | undefined) ?? null,
    },
  });
  if (!audited) {
    console.error("audit write failed for credential.view", { credId });
  }

  return { ok: true, secret };
}

/**
 * Rotates a stored credential by storing a new encrypted secret — a deliberate,
 * audited senior-ops action. Re-encrypts via the vault store RPC and updates the
 * existing row's ciphertext (the row identity / created_at are preserved). The
 * new secret is NEVER logged or audited. Throws on a DB error.
 *
 * TODO(senior-ops-role): see revealCredential — gate on a senior-ops claim once
 * that role exists; requireStaff is the current gate.
 */
export async function rotateCredential(
  id: string,
  newSecret: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const claims = await requireStaff();

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    return { ok: false, error: "Invalid credential id." };
  }
  const credId = parsed.data;
  const secret = z.string().min(1).safeParse(newSecret);
  if (!secret.success) {
    return { ok: false, error: "The new secret value is required." };
  }

  const client = serviceClient();

  const { data: row } = await client
    .from("channel_credentials")
    .select("tenant_id, channel_id")
    .eq("id", credId)
    .maybeSingle();

  if (!row) {
    return { ok: false, error: "Credential not found." };
  }

  // Re-encrypt the new secret onto the existing row (preserves id/created_at/
  // credential_type). The new plaintext is passed only to pgcrypto inside the RPC.
  const { error: rotateError } = await client.rpc("vault_rotate_credential_rpc", {
    p_id: credId,
    p_secret: secret.data,
    p_key: env.SUPABASE_VAULT_KEY,
  });

  if (rotateError) {
    console.error("rotateCredential failed", rotateError);
    return { ok: false, error: "Could not rotate the credential." };
  }

  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId: row.tenant_id as string,
    action: "credential.rotate",
    targetType: "credential",
    targetId: credId,
    metadata: {
      credential_id: credId,
      tenant_id: row.tenant_id as string,
      channel_id: row.channel_id as string,
    },
  });
  if (!audited) {
    console.error("audit write failed for credential.rotate", { credId });
  }

  revalidatePath("/admin/credentials");
  return { ok: true };
}
