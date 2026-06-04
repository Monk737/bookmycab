export interface RuleCondition {
  operator: "gt" | "gte" | "lt" | "lte";
  threshold: number;
}

/** Pure: does `value` satisfy the rule condition (i.e. should the alert fire)? */
export function evaluateCondition(value: number, condition: RuleCondition): boolean {
  switch (condition.operator) {
    case "gt": return value > condition.threshold;
    case "gte": return value >= condition.threshold;
    case "lt": return value < condition.threshold;
    case "lte": return value <= condition.threshold;
  }
}

const OP_WORD: Record<RuleCondition["operator"], string> = {
  gt: "above", gte: "at or above", lt: "below", lte: "at or below",
};

/** Human-readable alert body. Pure. */
export function formatAlertText(
  rule: { name: string; metricLabel: string; operator: RuleCondition["operator"]; threshold: number; unit: string },
  value: number,
): string {
  const u = rule.unit ? rule.unit : "";
  return `Alert: "${rule.name}" — ${rule.metricLabel} is ${value}${u}, which is ${OP_WORD[rule.operator]} your threshold of ${rule.threshold}${u}.`;
}
