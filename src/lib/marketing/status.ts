// Public status catalogue. Live status is wired to the Epic 11 observability
// stack (Grafana) at deploy; until then every component reports operational.
// Brand rule: the internal engine is the "CabbyBot Automation Engine" — never
// name the underlying tooling on this customer-facing page.

export type ComponentStatus = "operational" | "degraded" | "outage";

export interface StatusComponent {
  name: string;
  description: string;
  status: ComponentStatus;
}

export interface PerfTarget {
  metric: string;
  target: string;
}

export const STATUS_COMPONENTS: StatusComponent[] = [
  { name: "Booking Dashboard", description: "Your live booking feed, conversations and analytics.", status: "operational" },
  { name: "Webhook Gateway", description: "Inbound messages from WhatsApp, Telegram, Messenger, Instagram and the web widget.", status: "operational" },
  { name: "CabbyBot Automation Engine", description: "The bot that runs your booking conversations end to end.", status: "operational" },
  { name: "Dispatch Integrations", description: "AutoCab, iCabbi and Cordic booking hand-off.", status: "operational" },
  { name: "Realtime & Database", description: "Live updates and stored booking records.", status: "operational" },
];

export const PERF_TARGETS: PerfTarget[] = [
  { metric: "Webhook acknowledgement", target: "≤ 300 ms (p95)" },
  { metric: "Message to bot reply", target: "≤ 3 s (p95)" },
  { metric: "Voice note to reply", target: "≤ 8 s (p95)" },
  { metric: "Dashboard page load", target: "≤ 1.5 s (p95)" },
];

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  operational: "All systems operational",
  degraded: "Some systems degraded",
  outage: "Active outage",
};

const RANK: Record<ComponentStatus, number> = { operational: 0, degraded: 1, outage: 2 };

/** Overall status is the worst of all component statuses. */
export function overallStatus(components: StatusComponent[]): ComponentStatus {
  return components.reduce<ComponentStatus>(
    (worst, c) => (RANK[c.status] > RANK[worst] ? c.status : worst),
    "operational",
  );
}
