// Pure, no I/O. The canonical set of gateable features. Each `key` MUST have a
// matching row in public.features (seeded by scripts/seed-entitlements.ts).
export const FEATURE_KEYS = [
  "live_takeover",
  "alerting",
  "crm",
  "config_versioning",
  "fare_rules",
  "dispatch_retry",
  "conversation_intelligence",
  "account_invoicing",
  "scheduled_reports",
  "white_label",
  "self_serve_channels",
  "benchmarking",
  "custom_roles",
  "api_access",
  "outbound_webhooks",
  "ai_copilot",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureCategory =
  | "operations"
  | "intelligence"
  | "revenue"
  | "platform"
  | "growth";

export interface FeatureDef {
  key: FeatureKey;
  name: string;
  category: FeatureCategory;
  metered: boolean;
  /** Required when `metered` is true. */
  unit?: string;
}

export const FEATURE_CATALOG: Record<FeatureKey, FeatureDef> = {
  live_takeover: { key: "live_takeover", name: "Live ops & human takeover", category: "operations", metered: false },
  alerting: { key: "alerting", name: "Alerting & notifications", category: "operations", metered: true, unit: "notifications" },
  crm: { key: "crm", name: "Customer CRM", category: "operations", metered: false },
  config_versioning: { key: "config_versioning", name: "Bot config versioning", category: "operations", metered: false },
  fare_rules: { key: "fare_rules", name: "Fare & pricing rules", category: "operations", metered: false },
  dispatch_retry: { key: "dispatch_retry", name: "Dispatch retry queue", category: "operations", metered: false },
  conversation_intelligence: { key: "conversation_intelligence", name: "Conversation intelligence", category: "intelligence", metered: true, unit: "tokens" },
  account_invoicing: { key: "account_invoicing", name: "Account-customer invoicing", category: "revenue", metered: false },
  scheduled_reports: { key: "scheduled_reports", name: "Scheduled reports", category: "revenue", metered: true, unit: "reports" },
  white_label: { key: "white_label", name: "White-label branding", category: "revenue", metered: false },
  self_serve_channels: { key: "self_serve_channels", name: "Self-serve channels", category: "growth", metered: false },
  benchmarking: { key: "benchmarking", name: "Network benchmarking", category: "growth", metered: false },
  custom_roles: { key: "custom_roles", name: "Custom roles & permissions", category: "platform", metered: false },
  api_access: { key: "api_access", name: "API access", category: "platform", metered: true, unit: "calls" },
  outbound_webhooks: { key: "outbound_webhooks", name: "Outbound webhooks", category: "platform", metered: false },
  ai_copilot: { key: "ai_copilot", name: "AI copilot", category: "intelligence", metered: true, unit: "tokens" },
};
