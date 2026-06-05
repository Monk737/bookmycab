"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setProvisioning } from "@/lib/channels/service";
import { revalidatePath } from "next/cache";

export async function approveChannelAction(formData: FormData): Promise<void> {
  await requireStaff();
  await setProvisioning(String(formData.get("channelId")), "approve");
  revalidatePath("/admin/channel-review");
}

export async function rejectChannelAction(formData: FormData): Promise<void> {
  await requireStaff();
  await setProvisioning(String(formData.get("channelId")), "reject");
  revalidatePath("/admin/channel-review");
}
