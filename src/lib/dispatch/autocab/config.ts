/** Per-tenant AutoCab connection config (PRD §7.6.1). */
export interface AutoCabConfig {
  /** Customer-specific AutoCab instance base URL, no trailing slash. */
  baseUrl: string;
  /** Azure APIM subscription key (the secret) — from the credentials vault. */
  subscriptionKey: string;
}
