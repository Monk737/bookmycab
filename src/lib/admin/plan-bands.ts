/**
 * Plan band model for tenant provisioning.
 *
 * The five bands match the `tenants.plan_band` CHECK constraint (migration 0001):
 * `A-Single | A-Bundle | B-Single | B-Bundle | Custom`.
 *
 * Prices are NOT duplicated here, they are derived from the billing pricing
 * model (`src/lib/billing/pricing.ts`, PRD §6.1). A-* maps to band A
 * (single/bundle), B-* to band B, and Custom has no fixed price.
 */

import type { Currency } from "@/lib/marketing/pricing";
import { BAND_A, BAND_B } from "@/lib/billing/pricing";

export type PlanBand = "A-Single" | "A-Bundle" | "B-Single" | "B-Bundle" | "Custom";

/** Ordered list of plan bands (selection order in the provisioning form). */
export const PLAN_BANDS = [
  "A-Single",
  "A-Bundle",
  "B-Single",
  "B-Bundle",
  "Custom",
] as const satisfies readonly PlanBand[];

/** Human-readable labels for each band. */
const PLAN_BAND_LABELS: Record<PlanBand, string> = {
  "A-Single": "Plan A, Single channel",
  "A-Bundle": "Plan A, Channel bundle",
  "B-Single": "Plan B, Single channel",
  "B-Bundle": "Plan B, Channel bundle",
  Custom: "Custom (quoted)",
};

/** Returns the human-readable label for a plan band. */
export function planBandLabel(band: PlanBand): string {
  return PLAN_BAND_LABELS[band];
}

/**
 * Monthly price for a band in the given currency, or `null` when no fixed price
 * applies (Custom). Prices are sourced from the billing pricing model so there
 * is a single source of truth for the §6.1 figures.
 */
export function planBandMonthlyPrice(
  band: PlanBand,
  currency: Currency,
): number | null {
  switch (band) {
    case "A-Single":
      return BAND_A.single[currency];
    case "A-Bundle":
      return BAND_A.bundle[currency];
    case "B-Single":
      return BAND_B.single[currency];
    case "B-Bundle":
      return BAND_B.bundle[currency];
    case "Custom":
      return null;
  }
}

/**
 * Converts a tenant/org name into a URL-safe slug: lowercase, alphanumeric
 * words joined by single hyphens, no leading/trailing hyphens.
 *
 * Examples:
 *   "Speedy Cabs Ltd."   → "speedy-cabs-ltd"
 *   "  A&B  Taxis  "     → "a-b-taxis"
 *   "City--Cars"         → "city-cars"
 *   "Éclair Cabs"        → "eclair-cabs"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
