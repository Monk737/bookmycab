export interface FareRule {
  base_fare: number;
  per_mile: number;
  per_min: number;
  min_fare: number;
  airport_surcharge: number;
}

/** Pure: price a journey. Applies the min-fare floor, then airport surcharge. */
export function computeFare(
  distanceMiles: number,
  durationMin: number,
  rule: FareRule,
  isAirport: boolean,
): number {
  const raw = rule.base_fare + distanceMiles * rule.per_mile + durationMin * rule.per_min;
  const floored = Math.max(raw, rule.min_fare);
  const total = floored + (isAirport ? rule.airport_surcharge : 0);
  return Math.round(total * 100) / 100;
}
