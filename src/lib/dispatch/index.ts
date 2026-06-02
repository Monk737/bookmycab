/** Public surface of the dispatch adapter layer (Epic 6). */
export type {
  DispatchAdapter,
  AddressResult,
  Zone,
  Capability,
  AddressRef,
  QuoteParams,
  QuoteResult,
  BookingParams,
  BookingResult,
  FlightResult,
} from "./types";
export { DispatchError, DispatchConfigError, DispatchNotImplementedError } from "./errors";
export { lhrZoneForTerminal } from "./lhr-zones";
export { iataPrefix, airlineForFlightNumber } from "./iata";
export { pickupTimeFromArrival, DEFAULT_AIRPORT_BUFFER_MIN } from "./airport-buffer";
export { getDispatchAdapter, loadDispatchConfig } from "./factory";
export type { DispatchConfig, DispatchDeps } from "./factory";
export { AutoCabAdapter } from "./autocab/adapter";
export type { AutoCabConfig } from "./autocab/config";
export { ICabbiAdapter } from "./icabbi/adapter";
export { CordicAdapter } from "./cordic/adapter";
