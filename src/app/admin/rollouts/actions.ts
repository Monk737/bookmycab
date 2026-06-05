"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setRollout, type RolloutStrategy } from "@/lib/admin/rollouts";
import { revalidatePath } from "next/cache";

export async function setRolloutAction(formData: FormData): Promise<void> {
  await requireStaff();
  const featureKey = String(formData.get("featureKey"));
  const strategy = String(formData.get("strategy")) as RolloutStrategy;
  const percentage = Number(formData.get("percentage"));
  const killSwitch = formData.getAll("killSwitch").includes("true");
  await setRollout(featureKey, { strategy, percentage: Number.isFinite(percentage) ? percentage : 100, killSwitch });
  revalidatePath("/admin/rollouts");
}
