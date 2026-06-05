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
import {
  IMPERSONATION_COOKIE,
  serializeImpersonation,
  verifyImpersonation,
} from "@/lib/admin/impersonation-cookie";

const startSchema = z.object({
  tenantId: z.string().trim().uuid("A tenant must be selected."),
  targetUserId: z.string().trim().uuid("A user must be selected."),
  reason: z.string().trim().min(1, "A reason is required to impersonate."),
  mode: z.enum(["read_only", "write"]).default("read_only"),
});

export type StartImpersonationState = {
  formError: string | null;
  ok?: boolean;
};

/**
 * Starts a 15-minute impersonation marker. Read-only by default; write mode is
 * opt-in and audited distinctly as `impersonate.start.write`.
 *
 * Staff-only (defense-in-depth requireStaff), zod-validated (tenant, target
 * user, non-empty reason, mode). Mints the pure record, AUDITS the action
 * (with tenantId, targetUserId, reason, mode), and persists the record as an
 * httpOnly cookie scoped to the marker's TTL. No tenant session is minted here
 * — the view-as rendering binds in Epic 7. // TODO(epic-7)
 *
 * Throws on a hard failure so a failed start never looks successful.
 */
export async function startImpersonation(
  _prevState: StartImpersonationState,
  formData: FormData,
): Promise<StartImpersonationState> {
  const claims = await requireStaff();

  const modeRaw = formData.getAll("mode");
  const modeChoice = modeRaw.includes("write") ? "write" : "read_only";

  const parsed = startSchema.safeParse({
    tenantId: formData.get("tenantId"),
    targetUserId: formData.get("targetUserId"),
    reason: formData.get("reason"),
    mode: modeChoice,
  });
  if (!parsed.success) {
    const first =
      parsed.error.flatten().fieldErrors.reason?.[0] ??
      parsed.error.flatten().fieldErrors.tenantId?.[0] ??
      parsed.error.flatten().fieldErrors.targetUserId?.[0] ??
      "Invalid impersonation request.";
    return { formError: first };
  }

  const { tenantId, targetUserId, reason, mode } = parsed.data;

  // Pure mint — also re-enforces the mandatory-reason rule at the model layer.
  const record = mintImpersonation({
    staffUserId: claims.sub,
    tenantId,
    targetUserId,
    reason,
    mode,
    now: Date.now(),
  });

  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: mode === "write" ? "impersonate.start.write" : "impersonate.start",
    targetType: "user",
    targetId: targetUserId,
    metadata: { tenantId, targetUserId, reason, mode },
  });
  if (!audited) {
    // Auditing impersonation is not optional — do NOT start an unaudited
    // read-only session. Surface the failure.
    throw new Error("Could not record the impersonation audit entry.");
  }

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, serializeImpersonation(record), {
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

  // Only trust a signature-verified record; a forged/corrupt cookie audits with
  // nulls. (Verification also re-checks the full shape.)
  const record = raw ? verifyImpersonation(raw) : null;
  const tenantId = record?.tenantId ?? null;
  const targetUserId = record?.targetUserId ?? null;

  cookieStore.delete(IMPERSONATION_COOKIE);

  const audited = await writeAudit({
    actorUserId: claims.sub,
    tenantId,
    action: "impersonate.end",
    targetType: "user",
    targetId: targetUserId,
    metadata: { tenantId, targetUserId, reason: record?.reason ?? null },
  });
  if (!audited) {
    console.error("audit write failed for impersonate.end", { tenantId });
  }

  revalidatePath("/admin");
}
