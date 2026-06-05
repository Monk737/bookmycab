"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setCommission, createApp, setAppStatus, createSender, setSenderStatus } from "@/lib/admin/platform-config";
import { revalidatePath } from "next/cache";

export async function setCommissionAction(formData: FormData): Promise<void> {
  await requireStaff();
  const tenantId = String(formData.get("tenantId"));
  const pct = Number(formData.get("pct"));
  if (Number.isFinite(pct)) await setCommission(tenantId, pct);
  revalidatePath("/admin/platform");
}

export async function createAppAction(formData: FormData): Promise<void> {
  await requireStaff();
  await createApp(String(formData.get("provider")), String(formData.get("identifier")));
  revalidatePath("/admin/platform");
}

export async function toggleAppAction(formData: FormData): Promise<void> {
  await requireStaff();
  await setAppStatus(String(formData.get("id")), String(formData.get("status")) === "active" ? "disabled" : "active");
  revalidatePath("/admin/platform");
}

export async function createSenderAction(formData: FormData): Promise<void> {
  await requireStaff();
  const provider = String(formData.get("provider") ?? "");
  await createSender(String(formData.get("type")), String(formData.get("identifier")), provider || null);
  revalidatePath("/admin/platform");
}

export async function toggleSenderAction(formData: FormData): Promise<void> {
  await requireStaff();
  await setSenderStatus(String(formData.get("id")), String(formData.get("status")) === "active" ? "disabled" : "active");
  revalidatePath("/admin/platform");
}
