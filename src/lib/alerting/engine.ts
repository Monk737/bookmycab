import "server-only";
import { ALERT_METRICS } from "./metrics";
import { evaluateCondition, formatAlertText } from "./evaluate";
import { dispatchNotification } from "./notify";
import { listEnabledRules, listEnabledChannels, insertAlertEvent } from "./queries";

/**
 * Evaluate all enabled rules for a tenant. For each rule whose metric satisfies
 * its condition, insert an alert_event and dispatch to every enabled channel.
 * Returns a summary. Never throws on a single rule failure.
 */
export async function evaluateAlerts(tenantId: string): Promise<{ evaluated: number; fired: number; dispatched: number }> {
  const [rules, channels] = await Promise.all([listEnabledRules(tenantId), listEnabledChannels(tenantId)]);
  let fired = 0;
  let dispatched = 0;

  for (const rule of rules) {
    const metric = ALERT_METRICS[rule.metric];
    if (!metric) continue;
    let value: number;
    try {
      value = await metric.getValue(tenantId, rule.window_hours);
    } catch {
      continue;
    }
    if (!evaluateCondition(value, { operator: rule.operator, threshold: rule.threshold })) continue;

    fired++;
    const event = await insertAlertEvent(tenantId, rule.id, value);
    const text = formatAlertText(
      { name: rule.name, metricLabel: metric.label, operator: rule.operator, threshold: rule.threshold, unit: metric.unit },
      value,
    );
    for (const ch of channels) {
      const res = await dispatchNotification({ tenantId, channel: ch, alertEventId: event.id, text });
      if (res.status === "sent") dispatched++;
    }
  }

  return { evaluated: rules.length, fired, dispatched };
}
