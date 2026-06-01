"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { writeAudit } from "@/lib/admin/audit";

export const BUILD_STAGES = [
  "Requested",
  "Scoped",
  "Building",
  "UAT",
  "Live",
] as const;
export type BuildStage = (typeof BUILD_STAGES)[number];

function serviceClient() {
  return createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

const stageSchema = z.enum(BUILD_STAGES);
const idSchema = z.string().uuid();

/**
 * No-op placeholder for the stage-change notification email. The real Resend
 * integration (branded build-update emails to the assigned engineer / tenant
 * owner) lands later — see PRD §9.4. Kept as an explicit call site so wiring it
 * up is a one-line change.
 */
// TODO(resend): send a build-stage-changed email here. Will take the automation
// id + new stage once the Resend integration lands; a no-op for now.
function notifyStageChange(): void {
  // intentionally empty
}

/**
 * Moves an automation to a new build pipeline stage (Kanban column).
 *
 * Defense-in-depth staff check, zod-validates the stage against the 5 allowed
 * values, service-role update (admin spans tenants; RLS would block the write),
 * and an audit entry. Throws on a DB error so a failed move surfaces to the
 * staff member rather than silently appearing to succeed.
 */
export async function setBuildStage(
  automationId: string,
  stage: string,
  fromStage?: string,
): Promise<void> {
  const claims = await requireStaff();

  const id = idSchema.parse(automationId);
  const to = stageSchema.parse(stage);

  const { error } = await serviceClient()
    .from("automations")
    .update({ build_stage: to, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("setBuildStage failed", error);
    throw new Error("Failed to update build stage.");
  }

  const audited = await writeAudit({
    actorUserId: claims.sub,
    action: "automation.build_stage",
    targetType: "automation",
    targetId: id,
    metadata: { from: fromStage ?? null, to },
  });
  if (!audited) {
    console.error("audit write failed for automation.build_stage", { automationId: id });
  }

  notifyStageChange();

  revalidatePath("/admin/build-queue");
}

/**
 * Promotes a UAT automation to live (PRD §9.4.3): sets BOTH the pipeline stage
 * (`build_stage='Live'`) AND the runtime status (`status='live'`). Throws on a DB
 * error so the promotion never looks successful when it failed.
 */
export async function goLive(automationId: string): Promise<void> {
  const claims = await requireStaff();

  const id = idSchema.parse(automationId);

  const { error } = await serviceClient()
    .from("automations")
    .update({
      build_stage: "Live",
      status: "live",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("goLive failed", error);
    throw new Error("Failed to take the automation live.");
  }

  const audited = await writeAudit({
    actorUserId: claims.sub,
    action: "automation.go_live",
    targetType: "automation",
    targetId: id,
    metadata: { build_stage: "Live", status: "live" },
  });
  if (!audited) {
    console.error("audit write failed for automation.go_live", { automationId: id });
  }

  revalidatePath("/admin/build-queue");
}
