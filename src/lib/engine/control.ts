import "server-only";
import { EngineClient } from "./client";
import { writeAudit } from "@/lib/audit";
import { getEngineWorkflowId, setAutomationStatus } from "./control-db";
import type { EngineRun } from "./types";

type Ctx = { automationId: string; tenantId: string; actorUserId: string };

async function workflowOrThrow(automationId: string): Promise<string> {
  const wf = await getEngineWorkflowId(automationId);
  if (!wf) throw new Error("Automation is not yet provisioned in the engine.");
  return wf;
}

export async function startAutomation(ctx: Ctx): Promise<void> {
  const wf = await workflowOrThrow(ctx.automationId);
  await EngineClient.fromEnv().activate(wf);
  await setAutomationStatus(ctx.automationId, "live");
  await writeAudit({
    actorUserId: ctx.actorUserId, tenantId: ctx.tenantId,
    action: "automation.start", targetType: "automation", targetId: ctx.automationId,
  });
}

export async function stopAutomation(ctx: Ctx): Promise<void> {
  const wf = await workflowOrThrow(ctx.automationId);
  await EngineClient.fromEnv().deactivate(wf);
  await setAutomationStatus(ctx.automationId, "stopped");
  await writeAudit({
    actorUserId: ctx.actorUserId, tenantId: ctx.tenantId,
    action: "automation.stop", targetType: "automation", targetId: ctx.automationId,
  });
}

export async function restartAutomation(ctx: Ctx): Promise<void> {
  const wf = await workflowOrThrow(ctx.automationId);
  const client = EngineClient.fromEnv();
  await client.deactivate(wf);
  await client.activate(wf);
  await setAutomationStatus(ctx.automationId, "live");
  await writeAudit({
    actorUserId: ctx.actorUserId, tenantId: ctx.tenantId,
    action: "automation.restart", targetType: "automation", targetId: ctx.automationId,
  });
}

export async function getStatus(ctx: { automationId: string }): Promise<{ status: "live" | "stopped" }> {
  const wf = await workflowOrThrow(ctx.automationId);
  const active = await EngineClient.fromEnv().isActive(wf);
  return { status: active ? "live" : "stopped" };
}

export async function listRuns(ctx: { automationId: string }, limit = 50): Promise<EngineRun[]> {
  const wf = await workflowOrThrow(ctx.automationId);
  return EngineClient.fromEnv().listRuns(wf, limit);
}
