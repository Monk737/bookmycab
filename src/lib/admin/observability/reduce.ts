export interface UsageCounterRow {
  tenant_id: string;
  feature_key: string;
  used: number;
  limit_amount: number | null;
}

export interface TenantUsage {
  tenantId: string;
  tenantName: string;
  nearLimit: boolean;
  features: { featureKey: string; used: number; limit: number | null; utilisationPct: number | null }[];
}

/** Pure: group usage counters by tenant, compute utilisation %, flag near-limit (>=80%). */
export function reduceUsage(counters: UsageCounterRow[], tenantsById: Map<string, string>): TenantUsage[] {
  const byTenant = new Map<string, UsageCounterRow[]>();
  for (const c of counters) {
    const list = byTenant.get(c.tenant_id) ?? [];
    list.push(c);
    byTenant.set(c.tenant_id, list);
  }
  const out: TenantUsage[] = [];
  for (const [tenantId, rows] of byTenant) {
    let nearLimit = false;
    const features = rows.map((r) => {
      const utilisationPct = r.limit_amount && r.limit_amount > 0 ? Math.round((r.used / r.limit_amount) * 100) : null;
      if (utilisationPct !== null && utilisationPct >= 80) nearLimit = true;
      return { featureKey: r.feature_key, used: r.used, limit: r.limit_amount, utilisationPct };
    });
    out.push({ tenantId, tenantName: tenantsById.get(tenantId) ?? tenantId.slice(0, 8), nearLimit, features });
  }
  return out.sort((a, b) => a.tenantName.localeCompare(b.tenantName));
}

export interface RunRow { status: string }
export interface DispatchRow { adapter: string; status: string }
export interface NotifRow { status: string }

export interface PlatformHealth {
  automations: { total: number; successRate: number };
  dispatch: { adapter: string; total: number; successRate: number }[];
  notifications: { total: number; deliveredRate: number };
}

function rate(n: number, d: number): number {
  return d === 0 ? 0 : +((n / d) * 100).toFixed(1);
}

/** Pure: aggregate platform-wide health from runs, dispatch attempts, notifications. */
export function reducePlatformHealth(args: { runs: RunRow[]; dispatch: DispatchRow[]; notifications: NotifRow[] }): PlatformHealth {
  const { runs, dispatch, notifications } = args;

  const autoTotal = runs.length;
  const autoSuccess = runs.filter((r) => r.status === "success").length;

  const byAdapter = new Map<string, DispatchRow[]>();
  for (const d of dispatch) {
    const list = byAdapter.get(d.adapter) ?? [];
    list.push(d);
    byAdapter.set(d.adapter, list);
  }
  const dispatchOut = [...byAdapter.entries()].map(([adapter, rows]) => ({
    adapter,
    total: rows.length,
    successRate: rate(rows.filter((r) => r.status === "success").length, rows.length),
  })).sort((a, b) => b.total - a.total);

  const notifTotal = notifications.length;
  const notifDelivered = notifications.filter((n) => n.status === "sent" || n.status === "delivered").length;

  return {
    automations: { total: autoTotal, successRate: autoTotal === 0 ? 0 : Math.round((autoSuccess / autoTotal) * 100) },
    dispatch: dispatchOut,
    notifications: { total: notifTotal, deliveredRate: rate(notifDelivered, notifTotal) },
  };
}
