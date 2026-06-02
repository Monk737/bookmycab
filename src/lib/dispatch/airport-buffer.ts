import { DispatchError } from "./errors";

/** Default minutes added to a flight's arrival to compute pickup (PRD §7.6.1). */
export const DEFAULT_AIRPORT_BUFFER_MIN = 30;

/**
 * Computes the dispatch pickup time for an airport job: arrival + buffer.
 * `arrivalIso` is an ISO 8601 instant; returns an ISO 8601 instant. Throws a
 * DispatchError on an unparseable time or a negative buffer.
 */
export function pickupTimeFromArrival(
  arrivalIso: string,
  bufferMinutes: number = DEFAULT_AIRPORT_BUFFER_MIN,
): string {
  if (bufferMinutes < 0) {
    throw new DispatchError("Airport buffer must not be negative.");
  }
  const arrival = new Date(arrivalIso);
  if (Number.isNaN(arrival.getTime())) {
    throw new DispatchError("Unparseable flight arrival time.");
  }
  return new Date(arrival.getTime() + bufferMinutes * 60_000).toISOString();
}
