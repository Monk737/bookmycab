/**
 * Legacy plan-band labels + slugify.
 *
 * The A/B single/bundle commercial model has been fully retired in favour of the
 * two-product model (`commercial_model` + chat/voice subscription tiers), and the
 * `tenants.plan_band` column has been dropped (migration 0046). This module is
 * kept only to label any legacy band value still present on the `subscriptions`
 * mirror and to provide `slugify`.
 */

/** Legacy band values (no longer stored on tenants; may appear on subscriptions). */
export type PlanBand =
  | "A-Single"
  | "A-Bundle"
  | "B-Single"
  | "B-Bundle"
  | "Custom"
  | null;

/** Human-readable label for a (possibly null) legacy band value. */
export function planBandLabel(band: PlanBand): string {
  switch (band) {
    case "A-Single":
      return "Legacy · Plan A (single)";
    case "A-Bundle":
      return "Legacy · Plan A (bundle)";
    case "B-Single":
      return "Legacy · Plan B (single)";
    case "B-Bundle":
      return "Legacy · Plan B (bundle)";
    case "Custom":
      return "Custom (quoted)";
    default:
      return "—";
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
