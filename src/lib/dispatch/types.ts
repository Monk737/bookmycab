/**
 * Dispatch adapter layer — vendor-neutral contract (PRD §7.6).
 * One interface, three adapters (AutoCab live; iCabbi/Cordic stubs). All DTOs
 * are vendor-neutral: vendor JSON is normalised into these shapes by each
 * adapter's mappers so the booking state machine never sees vendor specifics.
 */

/** A disambiguated address candidate returned by an address search. */
export interface AddressResult {
  /** Vendor address id, used as a reference in later quote/booking calls. */
  id: string;
  /** Human-readable single-line label shown to the customer for disambiguation. */
  label: string;
  /** Dispatch zone name this address falls in, if known. */
  zone: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
}

/** A dispatch zone (used for LHR terminal mapping + service-area checks). */
export interface Zone {
  id: string;
  name: string;
}

/** A bookable vehicle type / capability flag from the dispatch system. */
export interface Capability {
  id: string;
  name: string;
  /** Max seated passengers, if the vendor reports it. */
  passengers: number | null;
}

/** A resolved address as passed into quote/booking calls. */
export interface AddressRef {
  label: string;
  zone: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
}

export interface QuoteParams {
  companyId: number;
  pickup: AddressRef;
  destination: AddressRef;
  /** Vendor capability id/name, if the customer pre-selected a vehicle. */
  vehicleType?: string;
  /** ISO 8601 requested pickup time; omit for ASAP. */
  pickupTime?: string;
}

export interface QuoteResult {
  /** Single normalised price in major currency units (iCabbi fare ranges
   *  collapse to one value at the adapter boundary — PRD §7.6.2). */
  price: number;
  currency: string;
  etaMinutes: number | null;
  vehicleType: string | null;
}

export interface BookingParams {
  companyId: number;
  pickup: AddressRef;
  destination: AddressRef;
  /** ISO 8601 pickup time (airport flow passes arrival + buffer). */
  pickupTime: string;
  vehicleType?: string;
  passengerName: string;
  passengerPhone: string;
  /** Price the customer confirmed, echoed to dispatch for reconciliation. */
  quotedPrice?: number;
  notes?: string;
}

export interface BookingResult {
  /** Dispatch booking reference (-> bookings.dispatch_ref). */
  dispatchRef: string;
  /** Neutral status: confirmed | dispatched | completed | cancelled | no_show. */
  status: string;
  price: number | null;
  currency: string | null;
  pickupTime: string | null;
  vehicleType: string | null;
  /** Full vendor response for audit (-> bookings.raw_dispatch_json). */
  raw: unknown;
}

export interface FlightResult {
  flightNumber: string;
  airline: string | null;
  origin: string | null;
  /** ISO 8601 scheduled arrival. */
  scheduledArrival: string | null;
  /** ISO 8601 estimated arrival, if live data is available. */
  estimatedArrival: string | null;
  /** Terminal label as reported by the vendor, e.g. "5", "T5". */
  terminal: string | null;
}

/** The common dispatch interface — PRD §7.6. */
export interface DispatchAdapter {
  lookupAddress(query: string, companyId: number): Promise<AddressResult[]>;
  getZones(companyId: number): Promise<Zone[]>;
  getCapabilities(companyId: number): Promise<Capability[]>;
  getQuote(params: QuoteParams): Promise<QuoteResult>;
  createBooking(params: BookingParams): Promise<BookingResult>;
  getBooking(bookingId: string, companyId: number): Promise<BookingResult>;
  modifyBooking(bookingId: string, params: Partial<BookingParams>): Promise<BookingResult>;
  cancelBooking(bookingId: string, companyId: number): Promise<void>;
  searchFlights(flightNumber: string, companyId: number): Promise<FlightResult[]>;
}
