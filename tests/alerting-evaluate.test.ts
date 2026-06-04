// tests/alerting-evaluate.test.ts
import { describe, it, expect } from "vitest";
import { evaluateCondition, formatAlertText, type RuleCondition } from "@/lib/alerting/evaluate";

const cond = (o: RuleCondition["operator"], threshold: number): RuleCondition => ({ operator: o, threshold });

describe("evaluateCondition", () => {
  it("gt fires only when value strictly exceeds threshold", () => {
    expect(evaluateCondition(16, cond("gt", 15))).toBe(true);
    expect(evaluateCondition(15, cond("gt", 15))).toBe(false);
  });
  it("gte fires at or above", () => {
    expect(evaluateCondition(15, cond("gte", 15))).toBe(true);
    expect(evaluateCondition(14, cond("gte", 15))).toBe(false);
  });
  it("lt / lte fire below", () => {
    expect(evaluateCondition(2, cond("lt", 3))).toBe(true);
    expect(evaluateCondition(3, cond("lt", 3))).toBe(false);
    expect(evaluateCondition(3, cond("lte", 3))).toBe(true);
  });
});

describe("formatAlertText", () => {
  it("includes rule name, metric label, value and threshold", () => {
    const text = formatAlertText(
      { name: "High abandonment", metricLabel: "Abandonment rate", operator: "gt", threshold: 15, unit: "%" },
      22.5,
    );
    expect(text).toMatch(/High abandonment/);
    expect(text).toMatch(/Abandonment rate/);
    expect(text).toMatch(/22.5/);
    expect(text).toMatch(/15/);
  });
});
