"use server";
import { requireStaff } from "@/lib/admin/guard";
import { setGuardrail } from "@/lib/config/guardrail-queries";
import { revalidatePath } from "next/cache";

export async function setGuardrailAction(formData: FormData): Promise<void> {
  await requireStaff();
  const automationId = String(formData.get("automationId"));
  const field = String(formData.get("field"));
  const locked = formData.getAll("locked").includes("true");
  const minRaw = String(formData.get("minValue") ?? "");
  const maxRaw = String(formData.get("maxValue") ?? "");
  await setGuardrail({
    automationId, field, locked,
    minValue: minRaw === "" ? null : Number(minRaw),
    maxValue: maxRaw === "" ? null : Number(maxRaw),
  });
  revalidatePath("/admin/guardrails");
}
