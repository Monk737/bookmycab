import type {
  AddressResult,
  Zone,
  Capability,
  QuoteResult,
  BookingResult,
  FlightResult,
  QuoteParams,
  BookingParams,
  AddressRef,
} from "../types";
import { airlineForFlightNumber } from "../iata";

/** Narrow an unknown JSON value to a record for safe field access. */
function obj(v: unknown): Record<string, unknown> {
  return (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

export function mapAddress(raw: unknown): AddressResult {
  const r = obj(raw);
  return {
    id: str(r.id) ?? "",
    label: str(r.text) ?? str(r.label) ?? "",
    zone: str(r.zone),
    postcode: str(r.postCode) ?? str(r.postcode),
    lat: num(r.latitude),
    lng: num(r.longitude),
  };
}

export function mapZone(raw: unknown): Zone {
  const r = obj(raw);
  return { id: str(r.id) ?? "", name: str(r.name) ?? "" };
}

export function mapCapability(raw: unknown): Capability {
  const r = obj(raw);
  return {
    id: str(r.id) ?? "",
    name: str(r.name) ?? "",
    passengers: num(r.maxPassengers),
  };
}

export function mapQuote(raw: unknown): QuoteResult {
  const r = obj(raw);
  return {
    price: num(r.price) ?? 0,
    currency: str(r.currency) ?? "GBP",
    etaMinutes: num(r.etaMinutes),
    vehicleType: str(r.vehicleType),
  };
}

/** Normalises an AutoCab booking status to the neutral bookings.status set. */
export function mapBookingStatus(raw: string | null): string {
  switch ((raw ?? "").toLowerCase()) {
    case "active":
    case "confirmed":
    case "accepted":
      return "confirmed";
    case "dispatched":
    case "allocated":
      return "dispatched";
    case "completed":
    case "finished":
      return "completed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "noshow":
    case "no_show":
      return "no_show";
    default:
      return "confirmed";
  }
}

export function mapBooking(raw: unknown): BookingResult {
  const r = obj(raw);
  return {
    dispatchRef: str(r.bookingId) ?? str(r.id) ?? "",
    status: mapBookingStatus(str(r.status)),
    price: num(r.price),
    currency: str(r.currency),
    pickupTime: str(r.pickupTime),
    vehicleType: str(r.vehicleType),
    raw,
  };
}

export function mapFlight(raw: unknown): FlightResult {
  const r = obj(raw);
  const flightNumber = str(r.flightNumber) ?? "";
  return {
    flightNumber,
    airline: str(r.airline) ?? airlineForFlightNumber(flightNumber),
    origin: str(r.origin),
    scheduledArrival: str(r.scheduledArrival),
    estimatedArrival: str(r.estimatedArrival),
    terminal: str(r.terminal),
  };
}

/** AutoCab address sub-object shape used in quote/booking request bodies. */
function toAutoCabAddress(a: AddressRef) {
  return {
    text: a.label,
    zone: a.zone,
    postCode: a.postcode,
    latitude: a.lat,
    longitude: a.lng,
  };
}

export function toQuoteBody(params: QuoteParams) {
  return {
    companyId: params.companyId,
    pickup: toAutoCabAddress(params.pickup),
    destination: toAutoCabAddress(params.destination),
    vehicleType: params.vehicleType,
    pickupTime: params.pickupTime,
  };
}

export function toBookingBody(params: BookingParams) {
  return {
    companyId: params.companyId,
    pickup: toAutoCabAddress(params.pickup),
    destination: toAutoCabAddress(params.destination),
    pickupTime: params.pickupTime,
    vehicleType: params.vehicleType,
    passengerName: params.passengerName,
    passengerPhone: params.passengerPhone,
    price: params.quotedPrice,
    notes: params.notes,
  };
}
