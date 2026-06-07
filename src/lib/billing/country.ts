/**
 * Single source of truth for tenant countries.
 *
 * Stripe's `address.country` (and Stripe Tax location lookup) require an
 * ISO-3166 alpha-2 code ("GB"), not a display name ("United Kingdom"). The
 * admin form stores the code; this module also normalises any legacy free-text
 * value and provides display labels.
 *
 * Pure, no I/O — safe to import from client components and server actions alike.
 */

// Markets BookMyCab onboards (GBP / EUR / USD). Extend as needed.
export const COUNTRIES = [
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "US", name: "United States" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "PT", name: "Portugal" },
  { code: "AT", name: "Austria" },
  { code: "PL", name: "Poland" },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

/** Non-empty tuple of codes, for `z.enum(...)` server-side validation. */
export const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [CountryCode, ...CountryCode[]];

const CODE_TO_NAME = new Map<string, string>(COUNTRIES.map((c) => [c.code, c.name]));

/** Display name for a stored code; falls back to the raw value for legacy data. */
export function countryLabel(code: string): string {
  return CODE_TO_NAME.get(code) ?? code;
}

// Legacy free-text aliases → ISO, so historical rows still resolve for Stripe.
const NAME_TO_ISO: Record<string, string> = {
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  britain: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  ireland: "IE",
  "republic of ireland": "IE",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  france: "FR",
  germany: "DE",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  belgium: "BE",
  portugal: "PT",
  austria: "AT",
  poland: "PL",
};

/**
 * Normalise a country value into a Stripe-acceptable ISO alpha-2 code. Accepts
 * an existing 2-letter code as-is (upper-cased) and maps known display names.
 * Throws on anything unresolvable so staff get a clear, fixable error instead
 * of Stripe's opaque "customer's location isn't recognized".
 */
export function toStripeCountry(input: string): string {
  const raw = input.trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const iso = NAME_TO_ISO[raw.toLowerCase()];
  if (iso) return iso;
  throw new Error(
    `Cannot map country "${input}" to an ISO country code for Stripe. ` +
      `Set the tenant's country to a 2-letter ISO code (e.g. "GB").`,
  );
}
