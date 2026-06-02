/**
 * IATA airline-code resolution for airport pickups (PRD §7.6.1).
 * The flight number's leading code identifies the carrier. The table covers the
 * carriers UK airport-transfer customers see most; unknown codes resolve to null
 * (airline name is cosmetic — the booking still proceeds on flight number alone).
 */
const IATA_AIRLINES: Record<string, string> = {
  BA: "British Airways",
  VS: "Virgin Atlantic",
  U2: "easyJet",
  FR: "Ryanair",
  LS: "Jet2",
  TOM: "TUI Airways",
  EK: "Emirates",
  QR: "Qatar Airways",
  EY: "Etihad Airways",
  AA: "American Airlines",
  DL: "Delta Air Lines",
  UA: "United Airlines",
  AF: "Air France",
  KL: "KLM",
  LH: "Lufthansa",
  IB: "Iberia",
  EI: "Aer Lingus",
  TP: "TAP Air Portugal",
  SK: "SAS",
  TK: "Turkish Airlines",
};

/**
 * Extracts the IATA carrier prefix from a flight number. Handles 2-letter
 * codes (BA), alphanumeric codes (U2, easyJet), and 3-char codes (TOM).
 * Returns the UPPERCASED prefix, or null when no leading letter is present.
 */
export function iataPrefix(flightNumber: string): string | null {
  const cleaned = flightNumber.replace(/\s+/g, "").toUpperCase();
  // A flight designator is 2-3 letters (BA, TOM) OR a letter+digit (U2),
  // immediately followed by the flight-number digits. The 2-3 letter branch is
  // tried first and can't consume a trailing digit, so BA245 -> "BA" (not "BA2");
  // U28042 falls through to the letter+digit branch -> "U2". The lookahead keeps
  // the designator anchored to the flight digits.
  const match = cleaned.match(/^([A-Z]{2,3}|[A-Z]\d)(?=\d)/);
  if (!match) return null;
  return match[1];
}

/** Resolves a flight number to a carrier name, or null if unknown. */
export function airlineForFlightNumber(flightNumber: string): string | null {
  const prefix = iataPrefix(flightNumber);
  if (!prefix) return null;
  return IATA_AIRLINES[prefix] ?? null;
}
