// tests/alerting-engine.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const rules = [
  { id: "r1", tenant_id: "t1", name: "High abandonment", metric: "abandonment_rate", operator: "gt", threshold: 15, window_hours: 24, enabled: true },
];
const channels = [{ id: "c1", type: "email", destination: "ops@cab.co", enabled: true }];
const eventInsert = vi.fn().mockResolvedValue({ data: { id: "e1" }, error: null });

vi.mock("@/lib/alerting/queries", () => ({
  listEnabledRules: vi.fn(async () => rules),
  listEnabledChannels: vi.fn(async () => channels),
  insertAlertEvent: vi.fn(async () => ({ id: "e1" })),
}));
vi.mock("@/lib/alerting/metrics", () => ({
  ALERT_METRICS: {
    abandonment_rate: { key: "abandonment_rate", label: "Abandonment rate", unit: "%", getValue: vi.fn() },
  },
}));
vi.mock("@/lib/alerting/notify", () => ({ dispatchNotification: vi.fn(async () => ({ status: "sent" })) }));

import { ALERT_METRICS } from "@/lib/alerting/metrics";
import { dispatchNotification } from "@/lib/alerting/notify";
import { insertAlertEvent } from "@/lib/alerting/queries";
import { evaluateAlerts } from "@/lib/alerting/engine";

describe("evaluateAlerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires + dispatches when the metric exceeds the threshold", async () => {
    vi.mocked(ALERT_METRICS.abandonment_rate.getValue).mockResolvedValue(22);
    const summary = await evaluateAlerts("t1");
    expect(insertAlertEvent).toHaveBeenCalledOnce();
    expect(dispatchNotification).toHaveBeenCalledOnce();
    expect(summary.fired).toBe(1);
  });

  it("does nothing when the metric is under the threshold", async () => {
    vi.mocked(ALERT_METRICS.abandonment_rate.getValue).mockResolvedValue(5);
    const summary = await evaluateAlerts("t1");
    expect(insertAlertEvent).not.toHaveBeenCalled();
    expect(dispatchNotification).not.toHaveBeenCalled();
    expect(summary.fired).toBe(0);
  });
});
