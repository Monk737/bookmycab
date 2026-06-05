"use server";
import { requireStaff } from "@/lib/admin/guard";
import { computeSnapshots } from "@/lib/admin/benchmarks";
import { revalidatePath } from "next/cache";

export async function recomputeAction(): Promise<void> {
  await requireStaff();
  await computeSnapshots();
  revalidatePath("/admin/benchmarks");
}
