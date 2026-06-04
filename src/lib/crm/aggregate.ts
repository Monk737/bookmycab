export interface BookingLite {
  fare: number | null;
  vehicle_type: string | null;
  created_at: string | null;
  passenger_name: string | null;
}
export interface ConversationLite {
  customer_name: string | null;
  started_at: string | null;
}
export interface CustomerStats {
  name: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  totalBookings: number;
  totalSpend: number;
  preferredVehicle: string | null;
}

function isoOrNull(ts: number | null): string | null {
  return ts === null ? null : new Date(ts).toISOString();
}

/** Pure: fold a customer's bookings + conversations into a stats row. */
export function reduceCustomerStats(
  bookings: BookingLite[],
  conversations: ConversationLite[],
): CustomerStats {
  const totalBookings = bookings.length;
  const totalSpend = +bookings.reduce((sum, b) => sum + (b.fare ?? 0), 0).toFixed(2);

  // preferred vehicle = mode of vehicle_type across bookings
  const counts = new Map<string, number>();
  for (const b of bookings) {
    if (!b.vehicle_type) continue;
    counts.set(b.vehicle_type, (counts.get(b.vehicle_type) ?? 0) + 1);
  }
  let preferredVehicle: string | null = null;
  let best = 0;
  for (const [v, c] of counts) {
    if (c > best) { best = c; preferredVehicle = v; }
  }

  // first/last seen across both sources
  const times: number[] = [];
  for (const b of bookings) if (b.created_at) times.push(Date.parse(b.created_at));
  for (const c of conversations) if (c.started_at) times.push(Date.parse(c.started_at));
  const firstSeen = times.length ? isoOrNull(Math.min(...times)) : null;
  const lastSeen = times.length ? isoOrNull(Math.max(...times)) : null;

  // name: latest non-empty by timestamp, conversations + bookings combined
  const named: { name: string; ts: number }[] = [];
  for (const b of bookings) if (b.passenger_name && b.created_at) named.push({ name: b.passenger_name, ts: Date.parse(b.created_at) });
  for (const c of conversations) if (c.customer_name && c.started_at) named.push({ name: c.customer_name, ts: Date.parse(c.started_at) });
  named.sort((a, b) => b.ts - a.ts);
  const name = named.length ? named[0].name : null;

  return { name, firstSeen, lastSeen, totalBookings, totalSpend, preferredVehicle };
}
