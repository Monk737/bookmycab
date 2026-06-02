import type {
  DispatchAdapter,
  AddressResult,
  Zone,
  Capability,
  QuoteResult,
  BookingResult,
  FlightResult,
} from "../types";
import { DispatchNotImplementedError } from "../errors";

const VENDOR = "Cordic";

/**
 * Cordic adapter — v1.2 roadmap (PRD §7.6.3). Stubbed so the factory can route
 * `dispatch_adapter='cordic'` today; every method throws a neutral
 * DispatchNotImplementedError until the real SOAP/REST adapter lands.
 */
export class CordicAdapter implements DispatchAdapter {
  async lookupAddress(): Promise<AddressResult[]> {
    throw new DispatchNotImplementedError(VENDOR, "lookupAddress");
  }
  async getZones(): Promise<Zone[]> {
    throw new DispatchNotImplementedError(VENDOR, "getZones");
  }
  async getCapabilities(): Promise<Capability[]> {
    throw new DispatchNotImplementedError(VENDOR, "getCapabilities");
  }
  async getQuote(): Promise<QuoteResult> {
    throw new DispatchNotImplementedError(VENDOR, "getQuote");
  }
  async createBooking(): Promise<BookingResult> {
    throw new DispatchNotImplementedError(VENDOR, "createBooking");
  }
  async getBooking(): Promise<BookingResult> {
    throw new DispatchNotImplementedError(VENDOR, "getBooking");
  }
  async modifyBooking(): Promise<BookingResult> {
    throw new DispatchNotImplementedError(VENDOR, "modifyBooking");
  }
  async cancelBooking(): Promise<void> {
    throw new DispatchNotImplementedError(VENDOR, "cancelBooking");
  }
  async searchFlights(): Promise<FlightResult[]> {
    throw new DispatchNotImplementedError(VENDOR, "searchFlights");
  }
}
