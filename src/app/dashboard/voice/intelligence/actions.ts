"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireUser } from "@/lib/auth/session";

const schema = z.object({
  recoveryId: z.string().uuid(),
  status: z.enum(["pending", "contacted", "recovered", "dismissed"]),
  note: z.string().max(500).optional(),
});

export type RecoveryActionState = { ok: boolean; error?: string };

/**
 * Update a lost-call recovery row (operator working the callback list). Tenant-
 * scoped: the row must belong to the caller's tenant. Service role (the table has
 * no write policy); audited by actioned_by/actioned_at.
 */
export async function updateRecoveryStatus(input: {
  recoveryId: string;
  status: string;
  note?: string;
}): Promise<RecoveryActionState> {
  const claims = await requireUser();
  if (!claims.tenant_id) return { ok: false, error: "No organisation linked." };
  if (claims.is_demo) return { ok: false, error: "Read-only in demo mode." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const svc = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const patch: Record<string, unknown> = {
    status: parsed.data.status,
    actioned_by: claims.sub,
    actioned_at: new Date().toISOString(),
  };
  if (parsed.data.note !== undefined) patch.note = parsed.data.note || null;

  const { error } = await svc
    .from("voice_call_recovery")
    .update(patch)
    .eq("id", parsed.data.recoveryId)
    .eq("tenant_id", claims.tenant_id);

  if (error) {
    console.error("updateRecoveryStatus failed", error);
    return { ok: false, error: "Could not update the recovery item." };
  }

  revalidatePath("/dashboard/voice/intelligence");
  return { ok: true };
}
