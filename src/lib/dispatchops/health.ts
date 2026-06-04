export interface AttemptLite {
  adapter: string;
  status: "success" | "failed" | "retrying";
  latency_ms: number | null;
}

export interface AdapterHealth {
  adapter: string;
  total: number;
  succeeded: number;
  failed: number;
  successRate: number; // percentage, 1dp
  p95LatencyMs: number | null;
}

/** Pure: p95 of a numeric array (nearest-rank). */
function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[idx];
}

/** Pure: aggregate dispatch attempts into per-adapter health, sorted by total desc. */
export function reduceAdapterHealth(attempts: AttemptLite[]): AdapterHealth[] {
  const byAdapter = new Map<string, AttemptLite[]>();
  for (const a of attempts) {
    const list = byAdapter.get(a.adapter) ?? [];
    list.push(a);
    byAdapter.set(a.adapter, list);
  }
  const out: AdapterHealth[] = [];
  for (const [adapter, list] of byAdapter) {
    const succeeded = list.filter((a) => a.status === "success").length;
    const failed = list.filter((a) => a.status === "failed").length;
    const total = list.length;
    const latencies = list.map((a) => a.latency_ms).filter((n): n is number => typeof n === "number");
    out.push({
      adapter,
      total,
      succeeded,
      failed,
      successRate: total === 0 ? 0 : +((succeeded / total) * 100).toFixed(1),
      p95LatencyMs: p95(latencies),
    });
  }
  return out.sort((a, b) => b.total - a.total);
}
