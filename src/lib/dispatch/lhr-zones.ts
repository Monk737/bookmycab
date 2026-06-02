/**
 * Heathrow terminal → AutoCab zone mapping (PRD §7.6.1).
 * T1/T2/T3 share the consolidated `LHR T123` zone; T4 and T5 are distinct.
 * The zone STRINGS are the AutoCab zone names; the per-tenant numeric zone ids
 * are resolved separately via getZones() when a booking is placed.
 */
export function lhrZoneForTerminal(terminal: string): string | null {
  // Pull the first standalone digit out of inputs like "T5", "Terminal 4", "3".
  const digit = terminal.match(/[1-5]/)?.[0];
  if (!digit) return null;
  switch (digit) {
    case "1":
    case "2":
    case "3":
      return "LHR T123";
    case "4":
      return "LHR T4";
    case "5":
      return "LHR T5";
    default:
      return null;
  }
}
