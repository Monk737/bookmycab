"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setTenantEntitlement } from "@/lib/admin/entitlements";
import { revalidatePath } from "next/cache";

export async function toggleTenantEntitlement(formData: FormData): Promise<void> {
  const claims = await requireStaff();
  const tenantId = String(formData.get("tenantId"));
  const featureKey = String(formData.get("featureKey"));
  const enabled = String(formData.get("enabled")) === "true";
  await setTenantEntitlement({ tenantId, featureKey, enabled, setBy: claims.sub });
  revalidatePath(`/admin/tenants/${tenantId}`);
}
