import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { EngineClient } from "@/lib/engine/client";
import { writeAudit } from "@/lib/audit";
import { del } from "@/lib/redis/cache";
import { automationCacheKey } from "@/lib/webhooks/resolver";

export type BillingProduct = "chat" | "voice";

export interface PausableAutomation {
  id: string;
  type: string;
  engine_workflow_id: string | null;
  status: string;
  billing_paused: boolean;
}

function db() {
  return createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Pure: which of a tenant's automations belong to a billing product. Voice
 * agents are type 'Voice'; everything else (Booking/Support/Driver/Custom) is
 * the chat product.
 */
export function selectProductAutomations<T extends { type: string }>(rows: T[], product: BillingProduct): T[] {
  return rows.filter((a) => (product === "voice" ? a.type === "Voice" : a.type !== "Voice"));
}

async function loadAutomations(tenantId: string): Promise<PausableAutomation[]> {
  const { data } = await db()
    .from("automations")
    .select("id, type, engine_workflow_id, status, billing_paused")
    .eq("tenant_id", tenantId);
  return (data ?? []) as PausableAutomation[];
}

/**
 * Hard-pause a tenant's automations for a product on a billing lapse: deactivate
 * the n8n workflow, mark status 'stopped' + billing_paused, and invalidate the
 * resolver cache so the gateway stops forwarding immediately. Best-effort per
 * automation (one engine error must not abort the rest). Idempotent: an
 * already-stopped automation is skipped.
 */
export async function pauseTenantProduct(tenantId: string, product: BillingProduct): Promise<void> {
  const targets = selectProductAutomations(await loadAutomations(tenantId), product).filter(
    (a) => a.status !== "stopped",
  );
  for (const a of targets) {
    try {
      if (a.engine_workflow_id) await EngineClient.fromEnv().deactivate(a.engine_workflow_id);
    } catch (err) {
      console.error("pauseTenantProduct: engine deactivate failed", { automation: a.id, err });
    }
    await db()
      .from("automations")
      .update({ status: "stopped", billing_paused: true, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    try {
      await del(automationCacheKey(a.id));
    } catch {
      /* cache invalidation is best-effort */
    }
  }
  if (targets.length > 0) {
    await writeAudit({
      actorUserId: null,
      tenantId,
      action: "automation.billing_pause",
      targetType: "tenant",
      targetId: tenantId,
      metadata: { product, count: targets.length },
    });
  }
}

/**
 * Resume a tenant's automations for a product on payment. Reactivates ONLY
 * automations this billing flow paused (`billing_paused = true`), so an
 * admin-stopped automation is never silently brought back. Best-effort per item.
 */
export async function resumeTenantProduct(tenantId: string, product: BillingProduct): Promise<void> {
  const targets = selectProductAutomations(await loadAutomations(tenantId), product).filter(
    (a) => a.billing_paused,
  );
  for (const a of targets) {
    try {
      if (a.engine_workflow_id) await EngineClient.fromEnv().activate(a.engine_workflow_id);
    } catch (err) {
      console.error("resumeTenantProduct: engine activate failed", { automation: a.id, err });
    }
    await db()
      .from("automations")
      .update({ status: "live", billing_paused: false, updated_at: new Date().toISOString() })
      .eq("id", a.id);
    try {
      await del(automationCacheKey(a.id));
    } catch {
      /* cache invalidation is best-effort */
    }
  }
  if (targets.length > 0) {
    await writeAudit({
      actorUserId: null,
      tenantId,
      action: "automation.billing_resume",
      targetType: "tenant",
      targetId: tenantId,
      metadata: { product, count: targets.length },
    });
  }
}
