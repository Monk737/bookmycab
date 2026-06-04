"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setTenantEntitlement, clearTenantEntitlement } from "@/lib/admin/entitlements";
import { revalidatePath } from "next/cache";

export async function toggleTenantEntitlement(formData: FormData): Promise<void> {
  const claims = await requireStaff();
  const tenantId = String(formData.get("tenantId"));
  const featureKey = String(formData.get("featureKey"));
  const enabled = String(formData.get("enabled")) === "true";
  await setTenantEntitlement({ tenantId, featureKey, enabled, setBy: claims.sub });
  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function clearEntitlement(formData: FormData): Promise<void> {
  const claims = await requireStaff();
  void claims;
  const tenantId = String(formData.get("tenantId"));
  const featureKey = String(formData.get("featureKey"));
  await clearTenantEntitlement(tenantId, featureKey);
  revalidatePath(`/admin/tenants/${tenantId}`);
}
