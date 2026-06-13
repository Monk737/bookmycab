"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import { isValidProduct } from "@/lib/credentials/integration-fields";

function svc() {
  return createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export type CredActionState = { error: string | null; ok?: boolean };

const REVALIDATE = "/admin/credentials";

/**
 * Create a new credential instance: one row per non-empty value. Field values
 * come in as repeated `value.<fieldKey>` form entries, so a field can carry
 * several values (e.g. multiple AutoCab URLs). Empty values are skipped.
 */
export async function addCredentialInstance(
  _prev: CredActionState,
  formData: FormData,
): Promise<CredActionState> {
  const claims = await requireStaff();
  const tenantId = String(formData.get("tenant_id") ?? "");
  const product = String(formData.get("product") ?? "");
  const label = (String(formData.get("instance_label") ?? "").trim() || "Primary").slice(0, 80);
  if (!tenantId || !isValidProduct(product)) {
    return { error: "Pick a tenant and a product." };
  }

  // Collect every `value.<fieldKey>` entry (multiple per key allowed).
  const rows: Array<{ tenant_id: string; product: string; instance_label: string; field_key: string; field_value: string }> = [];
  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith("value.")) continue;
    const fieldKey = name.slice("value.".length);
    const value = String(raw).trim();
    if (!fieldKey || !value) continue;
    rows.push({ tenant_id: tenantId, product, instance_label: label, field_key: fieldKey, field_value: value });
  }
  if (rows.length === 0) return { error: "Add at least one value before saving." };

  const { error } = await svc().from("integration_credentials").insert(rows);
  if (error) {
    console.error("addCredentialInstance failed", error);
    return { error: "Could not save the credentials. Please try again." };
  }

  await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "credential.integration_add",
    targetType: "credential",
    targetId: null,
    metadata: { product, instance_label: label, field_count: rows.length },
  });

  revalidatePath(REVALIDATE);
  return { error: null, ok: true };
}

/** Update a single value row. */
export async function updateCredentialValue(id: string, tenantId: string, value: string): Promise<void> {
  const claims = await requireStaff();
  const { error } = await svc()
    .from("integration_credentials")
    .update({ field_value: value })
    .eq("id", id);
  if (error) throw new Error("Could not update the value.");
  await writeAudit({ actorUserId: claims.sub, tenantId, action: "credential.integration_edit", targetType: "credential", targetId: id, metadata: {} });
  revalidatePath(REVALIDATE);
}

/** Delete a single value row. */
export async function deleteCredentialValue(id: string, tenantId: string): Promise<void> {
  const claims = await requireStaff();
  const { error } = await svc().from("integration_credentials").delete().eq("id", id);
  if (error) throw new Error("Could not delete the value.");
  await writeAudit({ actorUserId: claims.sub, tenantId, action: "credential.integration_delete_value", targetType: "credential", targetId: id, metadata: {} });
  revalidatePath(REVALIDATE);
}

/** Add a single value to an existing field within an instance. */
export async function addCredentialValue(args: {
  tenantId: string;
  product: string;
  label: string;
  fieldKey: string;
  value: string;
}): Promise<void> {
  const claims = await requireStaff();
  if (!isValidProduct(args.product) || !args.value.trim()) throw new Error("Invalid value.");
  const { error } = await svc().from("integration_credentials").insert({
    tenant_id: args.tenantId,
    product: args.product,
    instance_label: args.label,
    field_key: args.fieldKey,
    field_value: args.value.trim(),
  });
  if (error) throw new Error("Could not add the value.");
  await writeAudit({ actorUserId: claims.sub, tenantId: args.tenantId, action: "credential.integration_add_value", targetType: "credential", targetId: null, metadata: { product: args.product, field_key: args.fieldKey } });
  revalidatePath(REVALIDATE);
}

/** Delete an entire instance (all of its value rows). */
export async function deleteCredentialInstance(args: {
  tenantId: string;
  product: string;
  label: string;
}): Promise<void> {
  const claims = await requireStaff();
  const { error } = await svc()
    .from("integration_credentials")
    .delete()
    .eq("tenant_id", args.tenantId)
    .eq("product", args.product)
    .eq("instance_label", args.label);
  if (error) throw new Error("Could not delete the instance.");
  await writeAudit({ actorUserId: claims.sub, tenantId: args.tenantId, action: "credential.integration_delete_instance", targetType: "credential", targetId: null, metadata: { product: args.product, instance_label: args.label } });
  revalidatePath(REVALIDATE);
}
