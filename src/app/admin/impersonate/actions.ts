"use server";

import "server-only";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";
import {
  mintImpersonation,
  IMPERSONATION_TTL_MS,
} from "@/lib/admin/impersonation";
import { IMPERSONATION_COOKIE } from "@/lib/admin/impersonation-cookie";

const startSchema = z.object({
  tenantId: z.string().trim().uuid("A tenant must be selected."),
  targetUserId: z.string().trim().uuid("A user must be selected."),
  reason: z.string().trim().min(1, "A reason is required to impersonate."),
});

export type StartImpersonationState = {
  formError: string | null;
  ok?: boolean;
};

/**
 * Starts a 15-minute, read-only impersonation marker.
 *
 * Staff-only (defense-in-depth requireStaff), zod-validated (tenant, target
 * user, non-empty reason). Mints the pure record, AUDITS `impersonate.start`
 * (with tenantId, targetUserId, reason), and persists the record as an httpOnly
 * cookie scoped to the marker's TTL. No tenant session is minted here — the
 * view-as rendering binds in Epic 7. // TODO(epic-7)
 *
 * Throws on a hard failure so a failed start never looks successful.
 */
export async function startImpersonation(
  _prevState: StartImpersonationState,
  formData: FormData,
): Promise<StartImpersonationState> {
  const claims = await requireStaff();

  const parsed = startSchema.safeParse({
    tenantId: formData.get("tenantId"),
    targetUserId: formData.get("targetUserId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.reason?.[0] ??
      parsed.error.flatten().fieldErrors.tenantId?.[0] ??
      parsed.error.flatten().fieldErrors.targetUserId?.[0] ??
      "Invalid impersonation request.";
    return { formError: first };
  }

  const { tenantId, targetUserId, reason } = parsed.data;

  // Pure mint — also re-enforces the mandatory-reason rule at the model layer.
  const record = mintImpersonation({
    staffUserId: claims.sub,
    tenantId,
    targetUserId,
    reason,
    now: Date.now(),
  });

  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "impersonate.start",
    targetType: "user",
    targetId: targetUserId,
    metadata: { tenantId, targetUserId, reason },
  });
  if (!audited) {
    // Auditing impersonation is not optional — do NOT start an unaudited
    // read-only session. Surface the failure.
    throw new Error("Could not record the impersonation audit entry.");
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, JSON.stringify(record), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(IMPERSONATION_TTL_MS / 1000),
  });

  // TODO(epic-7): attach the read-only tenant "view-as" session here and
  // redirect into the tenant dashboard. This epoch only sets the marker.

  revalidatePath("/admin");
  return { formError: null, ok: true };
}

/**
 * Ends the current impersonation: clears the marker cookie and audits
 * `impersonate.end`. Safe to call when no impersonation is active.
 */
export async function endImpersonation(): Promise<void> {
  const claims = await requireStaff();

  const cookieStore = await cookies();
  const raw = cookieStore.get(IMPERSONATION_COOKIE)?.value;

  let tenantId: string | null = null;
  let targetUserId: string | null = null;
  if (raw) {
    try {
      const record = JSON.parse(raw) as {
        tenantId?: string;
        targetUserId?: string;
      };
      tenantId = record.tenantId ?? null;
      targetUserId = record.targetUserId ?? null;
    } catch {
      // Corrupt cookie — still clear it below; audit with what we have (null).
    }
  }

  cookieStore.delete(IMPERSONATION_COOKIE);

  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "impersonate.end",
    targetType: "user",
    targetId: targetUserId,
    metadata: { tenantId, targetUserId },
  });
  if (!audited) {
    console.error("audit write failed for impersonate.end", { tenantId });
  }

  revalidatePath("/admin");
}
