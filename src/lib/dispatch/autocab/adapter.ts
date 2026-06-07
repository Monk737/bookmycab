import "server-only";
import type {
  DispatchAdapter,
  AddressResult,
  Zone,
  Capability,
  QuoteParams,
  QuoteResult,
  BookingParams,
  BookingResult,
  FlightResult,
} from "../types";
import { DispatchError } from "../errors";
import type { AutoCabConfig } from "./config";
import {
  mapAddress,
  mapZone,
  mapCapability,
  mapQuote,
  mapBooking,
  mapFlight,
  toQuoteBody,
  toBookingBody,
  toBookingPatchBody,
} from "./mappers";

type Fetcher = typeof fetch;

/**
 * AutoCab dispatch adapter (PRD §7.6.1). Endpoints are called against the
 * customer's AutoCab instance with the Azure APIM subscription-key header. The
 * fetcher is injectable so every method is unit-testable without network, the
 * same pattern as src/lib/engine/client.ts EngineClient.
 */
export class AutoCabAdapter implements DispatchAdapter {
  constructor(
    private readonly config: AutoCabConfig,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  /** Issues a request and returns parsed JSON; throws a neutral error on non-2xx. */
  private async call(path: string, init?: RequestInit): Promise<unknown> {
    const res = await this.fetcher(`${this.config.baseUrl}${path}`, {
      ...init,
      // Caller headers first, then auth + content-type (callee-wins) so a caller
      // can never accidentally override the subscription key.
      headers: {
        ...(init?.headers ?? {}),
        "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
        "content-type": "application/json",
      },
    });
    if (!res.ok) {
      throw new DispatchError(`Dispatch request failed (${res.status}).`);
    }
    if (res.status === 204) return {};
    return res.json();
  }

  async lookupAddress(query: string, companyId: number): Promise<AddressResult[]> {
    const json = await this.call("/address", {
      method: "POST",
      body: JSON.stringify({ text: query, companyId }),
    });
    const rows = (json as { results?: unknown[] }).results ?? [];
    return rows.map(mapAddress);
  }

  async getZones(companyId: number): Promise<Zone[]> {
    const json = await this.call(`/zones?companyId=${companyId}`);
    const rows = (json as { zones?: unknown[] }).zones ?? [];
    return rows.map(mapZone);
  }

  async getCapabilities(companyId: number): Promise<Capability[]> {
    const json = await this.call(`/capabilities?companyId=${companyId}`);
    const rows = (json as { capabilities?: unknown[] }).capabilities ?? [];
    return rows.map(mapCapability);
  }

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const json = await this.call("/quote", {
      method: "POST",
      body: JSON.stringify(toQuoteBody(params)),
    });
    return mapQuote(json);
  }

  async createBooking(params: BookingParams): Promise<BookingResult> {
    const json = await this.call("/booking", {
      method: "POST",
      body: JSON.stringify(toBookingBody(params)),
    });
    return mapBooking(json);
  }

  async getBooking(bookingId: string, companyId: number): Promise<BookingResult> {
    const json = await this.call(
      `/booking/${encodeURIComponent(bookingId)}?companyId=${companyId}`,
    );
    return mapBooking(json);
  }

  async modifyBooking(
    bookingId: string,
    params: Partial<BookingParams>,
  ): Promise<BookingResult> {
    const json = await this.call(`/booking/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      body: JSON.stringify(toBookingPatchBody(params)),
    });
    return mapBooking(json);
  }

  async cancelBooking(bookingId: string, companyId: number): Promise<void> {
    await this.call(
      `/booking/${encodeURIComponent(bookingId)}?companyId=${companyId}`,
      { method: "DELETE" },
    );
  }

  async searchFlights(flightNumber: string, companyId: number): Promise<FlightResult[]> {
    const json = await this.call(
      `/flights/search?flightNumber=${encodeURIComponent(flightNumber)}&companyId=${companyId}`,
    );
    const rows = (json as { flights?: unknown[] }).flights ?? [];
    return rows.map(mapFlight);
  }
}
