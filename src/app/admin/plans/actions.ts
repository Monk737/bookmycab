"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setPlanFeature } from "@/lib/admin/entitlements";
import { revalidatePath } from "next/cache";

export async function togglePlanFeature(formData: FormData): Promise<void> {
  await requireStaff();
  const planId = String(formData.get("planId"));
  const featureKey = String(formData.get("featureKey"));
  const enabled = String(formData.get("enabled")) === "true";
  await setPlanFeature(planId, featureKey, enabled);
  revalidatePath("/admin/plans");
}
