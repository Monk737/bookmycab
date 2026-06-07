import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { buildReport, resolveBranding, type Branding, type Report } from "./build";
import { recordUsage } from "@/lib/entitlements/meter";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface ReportDefRow { id: string; name: string; metrics: unknown; format: string; white_label: boolean; enabled: boolean }
export interface ReportRunRow { id: string; report_id: string | null; status: string; generated_at: string }

export async function listDefinitions(tenantId: string): Promise<ReportDefRow[]> {
  const { data } = await svc().from("report_definitions").select("id, name, metrics, format, white_label, enabled").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  return (data ?? []) as ReportDefRow[];
}

export async function createDefinition(tenantId: string, input: { name: string; metrics: string[]; format?: string; whiteLabel?: boolean; createdBy: string }): Promise<void> {
  await svc().from("report_definitions").insert({
    tenant_id: tenantId, name: input.name, metrics: input.metrics,
    format: input.format ?? "json", white_label: input.whiteLabel ?? false, created_by: input.createdBy,
  });
}

export async function deleteDefinition(tenantId: string, reportId: string): Promise<void> {
  await svc().from("report_definitions").delete().eq("tenant_id", tenantId).eq("id", reportId);
}

export async function listRuns(tenantId: string, limit = 30): Promise<ReportRunRow[]> {
  const { data } = await svc().from("report_runs").select("id, report_id, status, generated_at").eq("tenant_id", tenantId).order("generated_at", { ascending: false }).limit(limit);
  return (data ?? []) as ReportRunRow[];
}

export async function getBranding(tenantId: string): Promise<Branding> {
  const { data } = await svc().from("tenants").select("branding").eq("id", tenantId).maybeSingle();
  return resolveBranding((data?.branding as Record<string, unknown>) ?? null);
}

export async function setBranding(tenantId: string, branding: { logoUrl?: string | null; primary?: string; accent?: string }): Promise<void> {
  await svc().from("tenants").update({ branding }).eq("id", tenantId);
}

/**
 * Run a report: gather the selected metrics for the tenant, build the payload,
 * persist a report_runs row, and meter one scheduled_reports unit. Metric values
 * are aggregated tenant-wide from bookings/conversations (v1 keeps the fetch
 * simple, totals over the last 30 days). Returns the built report.
 */
export async function runReport(tenantId: string, reportId: string): Promise<{ ok: boolean; report?: Report }> {
  const sb = svc();
  const { data: def } = await sb.from("report_definitions").select("name, metrics").eq("tenant_id", tenantId).eq("id", reportId).maybeSingle();
  if (!def) return { ok: false };
  const metricKeys = Array.isArray(def.metrics) ? (def.metrics as string[]) : [];

  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const values: Record<string, unknown> = {};

  if (metricKeys.includes("revenue")) {
    const { data } = await sb.from("bookings").select("fare, status").eq("tenant_id", tenantId).gte("created_at", since);
    const rows = data ?? [];
    values.revenue = {
      total: rows.reduce((s, r) => s + (Number(r.fare) || 0), 0),
      completed: rows.filter((r) => r.status === "completed").length,
    };
  }
  if (metricKeys.includes("bookings")) {
    const { count } = await sb.from("bookings").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", since);
    values.bookings = { total: count ?? 0 };
  }
  if (metricKeys.includes("response_time")) {
    // v1: not deeply computed here; report shows zeros unless wired to insights.
    values.response_time = { p50Sec: 0, p95Sec: 0 };
  }

  const report = buildReport(metricKeys, values, (def.name as string) ?? "Report");
  await sb.from("report_runs").insert({ tenant_id: tenantId, report_id: reportId, status: "success", payload: report });
  await recordUsage({ tenantId, featureKey: "scheduled_reports", quantity: 1, unit: "reports" });
  return { ok: true, report };
}
