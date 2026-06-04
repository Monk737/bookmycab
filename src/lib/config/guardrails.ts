export interface Guardrail {
  field: string;
  locked: boolean;
  min_value: number | null;
  max_value: number | null;
}

export interface Violation {
  field: string;
  reason: "locked" | "below_min" | "above_max";
}

/**
 * Pure: validate a candidate config against guardrails.
 * - `numericValues`: candidate numeric fields keyed by guardrail field (e.g. min_fare).
 * - `candidateConfig` / `liveConfig`: the full config objects, to detect changes to LOCKED fields.
 * A locked field violates only if its value differs from the live config.
 */
export function validateConfig(
  numericValues: Record<string, number>,
  guardrails: Guardrail[],
  candidateConfig: Record<string, unknown>,
  liveConfig: Record<string, unknown>,
): { ok: boolean; violations: Violation[] } {
  const violations: Violation[] = [];
  for (const g of guardrails) {
    if (g.locked) {
      const before = JSON.stringify(liveConfig[g.field] ?? null);
      const after = JSON.stringify(candidateConfig[g.field] ?? null);
      if (before !== after) violations.push({ field: g.field, reason: "locked" });
    }
    const v = numericValues[g.field];
    if (typeof v === "number") {
      if (g.min_value !== null && v < g.min_value) violations.push({ field: g.field, reason: "below_min" });
      if (g.max_value !== null && v > g.max_value) violations.push({ field: g.field, reason: "above_max" });
    }
  }
  return { ok: violations.length === 0, violations };
}
