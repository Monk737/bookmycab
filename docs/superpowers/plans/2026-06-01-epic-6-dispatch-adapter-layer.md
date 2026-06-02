# Epic 6 — Dispatch Adapter Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the typed `DispatchAdapter` layer — a full AutoCab adapter (address/zones/capabilities/quote/booking CRUD/flights) plus LHR terminal-zone mapping, IATA→airline lookup, airport-buffer logic, per-tenant adapter selection, and graceful iCabbi/Cordic stubs.

**Architecture:** A `DispatchAdapter` TypeScript interface (PRD §7.6) with pure DTOs in `src/lib/dispatch/`. The AutoCab adapter is a class constructed from an explicit `AutoCabConfig` and an **injectable `fetch`** (same pattern as `src/lib/engine/client.ts` `EngineClient`), so every method is unit-testable with fixture JSON and zero network. Pure helpers (zone map, IATA table, buffer math, response mappers) are separate, side-effect-free modules. A `getDispatchAdapter(tenantId)` factory loads the per-tenant adapter choice + company id + base URL from `tenants` and the AutoCab subscription key from the existing Epic-3 pgcrypto vault, then returns the right adapter; iCabbi/Cordic return stub adapters whose methods throw a neutral `DispatchNotImplementedError`.

**Tech Stack:** TypeScript, Next.js 15 server modules (`server-only`), Vitest, Supabase service-role client + `vault_read_credential_rpc` (migration 0010), pgcrypto vault (migration 0008).

**Depends on:** Plan 5 (Automation Engine Integration) — reuses the `EngineClient` injectable-fetcher pattern, the Supabase service-role read pattern (`src/lib/webhooks/resolver-loader.ts`), and the vault RPC wrappers from Epic 3.

---

## Decisions locked for this plan

- **Q2 (iCabbi/Cordic):** Ship **stubs that error gracefully**. The factory routes all three adapter values; iCabbi/Cordic adapters implement the full interface but every method throws `DispatchNotImplementedError` carrying a customer-neutral message. This keeps `tenants.dispatch_adapter` honest and makes the v1.2 work a drop-in replacement.
- **Where the AutoCab subscription key lives:** the existing `channel_credentials` vault. `channel_credentials.channel_id` is **nullable**, so a dispatch credential is stored tenant-scoped with `channel_id = NULL` and a new `credential_type = 'autocab_subscription_key'`. No new table or RPC — reuse `vault_store_credential_rpc` / `vault_read_credential_rpc`. Migration 0014 only (a) adds `tenants.dispatch_base_url` and (b) extends the `credential_type` CHECK allow-list.
- **AutoCab auth header:** `Ocp-Apim-Subscription-Key` (AutoCab fronts its API with Azure API Management). The subscription key is the secret; `companyId` is non-secret and lives in `tenants.dispatch_company_id`.
- **AutoCab JSON shapes:** there is no live AutoCab instance in this repo, so the request/response shapes below are the **contract this adapter targets**. They are encapsulated entirely in `autocab/mappers.ts`; if the real API differs, only the mappers change. Every mapper is written to be tolerant of missing fields (returns `null`, never throws on shape drift).
- **Brand rule:** nothing in this layer is customer-facing, but error messages still must never leak vendor/engine internals beyond the dispatch vendor name. Errors say e.g. `"iCabbi dispatch is not yet available."` — never "n8n", "workflow", or "execution".

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/dispatch/types.ts` | `DispatchAdapter` interface + all DTOs (`AddressResult`, `Zone`, `Capability`, `AddressRef`, `QuoteParams`, `QuoteResult`, `BookingParams`, `BookingResult`, `FlightResult`) |
| `src/lib/dispatch/errors.ts` | `DispatchError`, `DispatchConfigError`, `DispatchNotImplementedError` |
| `src/lib/dispatch/lhr-zones.ts` | `lhrZoneForTerminal(terminal)` — LHR terminal → AutoCab zone string |
| `src/lib/dispatch/iata.ts` | `iataPrefix(flightNumber)`, `airlineForFlightNumber(flightNumber)` — embedded IATA airline table |
| `src/lib/dispatch/airport-buffer.ts` | `pickupTimeFromArrival(arrivalIso, bufferMinutes?)` — arrival + buffer → pickup ISO |
| `src/lib/dispatch/autocab/config.ts` | `AutoCabConfig` type |
| `src/lib/dispatch/autocab/mappers.ts` | Pure AutoCab-JSON → neutral-DTO mappers + request-body builders |
| `src/lib/dispatch/autocab/adapter.ts` | `AutoCabAdapter implements DispatchAdapter` (injectable fetcher) |
| `src/lib/dispatch/icabbi/adapter.ts` | `ICabbiAdapter` stub (throws `DispatchNotImplementedError`) |
| `src/lib/dispatch/cordic/adapter.ts` | `CordicAdapter` stub (throws `DispatchNotImplementedError`) |
| `src/lib/dispatch/factory.ts` | `loadDispatchConfig(tenantId)` + `getDispatchAdapter(tenantId)` |
| `src/lib/dispatch/index.ts` | Barrel re-exports for the layer's public surface |
| `supabase/migrations/0014_dispatch_config.sql` | `tenants.dispatch_base_url` + `credential_type` allow-list extension |
| `tests/dispatch-lhr-zones.test.ts` | Zone-map unit tests |
| `tests/dispatch-iata.test.ts` | IATA-lookup unit tests |
| `tests/dispatch-airport-buffer.test.ts` | Buffer-math unit tests |
| `tests/dispatch-autocab-mappers.test.ts` | Mapper unit tests |
| `tests/dispatch-autocab-adapter.test.ts` | AutoCab adapter tests (fixture fetcher) |
| `tests/dispatch-stubs.test.ts` | iCabbi/Cordic stub tests |
| `tests/dispatch-factory.test.ts` | Factory routing tests (mocked config loader) |
| `tests/dispatch-brand.test.ts` | Asserts no banned internal vocabulary in the layer |

---

### Task 1: Types + errors (foundation)

**Files:**
- Create: `src/lib/dispatch/types.ts`
- Create: `src/lib/dispatch/errors.ts`
- Test: `tests/dispatch-stubs.test.ts` (created here as a smoke check, expanded in Task 6)

- [ ] **Step 1: Write the failing test**

`tests/dispatch-stubs.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { DispatchError, DispatchNotImplementedError, DispatchConfigError } from "@/lib/dispatch/errors";

describe("dispatch errors", () => {
  it("DispatchError is an Error with the given message", () => {
    const e = new DispatchError("boom");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("DispatchError");
    expect(e.message).toBe("boom");
  });

  it("DispatchNotImplementedError names the vendor + method, neutrally", () => {
    const e = new DispatchNotImplementedError("iCabbi", "createBooking");
    expect(e).toBeInstanceOf(DispatchError);
    expect(e.name).toBe("DispatchNotImplementedError");
    expect(e.message).toBe("iCabbi dispatch is not yet available.");
    expect(e.method).toBe("createBooking");
    // brand rule: no engine/internal vocabulary
    expect(e.message).not.toMatch(/n8n|workflow|execution/i);
  });

  it("DispatchConfigError is a DispatchError", () => {
    expect(new DispatchConfigError("bad")).toBeInstanceOf(DispatchError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-stubs.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dispatch/errors'`.

- [ ] **Step 3: Write the DTOs**

`src/lib/dispatch/types.ts`:

```typescript
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
```

- [ ] **Step 4: Write the errors**

`src/lib/dispatch/errors.ts`:

```typescript
/** Base error for the dispatch layer. Messages stay customer-neutral. */
export class DispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchError";
  }
}

/** Tenant dispatch config is missing or invalid (no key, no company id, etc.). */
export class DispatchConfigError extends DispatchError {
  constructor(message: string) {
    super(message);
    this.name = "DispatchConfigError";
  }
}

/** A stub adapter (iCabbi/Cordic) method was called before v1.2 shipped. */
export class DispatchNotImplementedError extends DispatchError {
  readonly method: string;
  constructor(vendor: string, method: string) {
    super(`${vendor} dispatch is not yet available.`);
    this.name = "DispatchNotImplementedError";
    this.method = method;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/dispatch-stubs.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dispatch/types.ts src/lib/dispatch/errors.ts tests/dispatch-stubs.test.ts
git commit -m "feat(dispatch): DispatchAdapter interface + neutral error types"
```

---

### Task 2: LHR terminal → zone mapping

**Files:**
- Create: `src/lib/dispatch/lhr-zones.ts`
- Test: `tests/dispatch-lhr-zones.test.ts`

LHR mapping (PRD §7.6.1): T1/T2/T3 → `LHR T123`; T4 → `LHR T4`; T5 → `LHR T5`.

- [ ] **Step 1: Write the failing test**

`tests/dispatch-lhr-zones.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { lhrZoneForTerminal } from "@/lib/dispatch/lhr-zones";

describe("lhrZoneForTerminal", () => {
  it("maps terminals 1/2/3 to LHR T123", () => {
    for (const t of ["1", "2", "3", "T1", "T2", "T3", "t3", "Terminal 2"]) {
      expect(lhrZoneForTerminal(t)).toBe("LHR T123");
    }
  });
  it("maps terminal 4 to LHR T4", () => {
    expect(lhrZoneForTerminal("4")).toBe("LHR T4");
    expect(lhrZoneForTerminal("T4")).toBe("LHR T4");
    expect(lhrZoneForTerminal("Terminal 4")).toBe("LHR T4");
  });
  it("maps terminal 5 to LHR T5", () => {
    expect(lhrZoneForTerminal("5")).toBe("LHR T5");
    expect(lhrZoneForTerminal("T5")).toBe("LHR T5");
  });
  it("returns null for unknown / empty terminals", () => {
    expect(lhrZoneForTerminal("6")).toBeNull();
    expect(lhrZoneForTerminal("")).toBeNull();
    expect(lhrZoneForTerminal("North")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-lhr-zones.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dispatch/lhr-zones'`.

- [ ] **Step 3: Write the implementation**

`src/lib/dispatch/lhr-zones.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dispatch-lhr-zones.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dispatch/lhr-zones.ts tests/dispatch-lhr-zones.test.ts
git commit -m "feat(dispatch): LHR terminal to AutoCab zone mapping"
```

---

### Task 3: IATA → airline lookup

**Files:**
- Create: `src/lib/dispatch/iata.ts`
- Test: `tests/dispatch-iata.test.ts`

A flight number is `<IATA prefix><digits>` (e.g. `BA245`, `U28042`, `EZY1234`). The prefix is the leading letters/alphanumerics before the flight digits. Map the common prefixes the customers' airports see to airline names; unknown prefixes return `null` (the caller still books — airline name is cosmetic).

- [ ] **Step 1: Write the failing test**

`tests/dispatch-iata.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { iataPrefix, airlineForFlightNumber } from "@/lib/dispatch/iata";

describe("iataPrefix", () => {
  it("extracts a 2-letter prefix", () => {
    expect(iataPrefix("BA245")).toBe("BA");
    expect(iataPrefix("ba 245")).toBe("BA");
  });
  it("extracts an alphanumeric prefix (e.g. easyJet U2, Jet2 LS)", () => {
    expect(iataPrefix("U28042")).toBe("U2");
    expect(iataPrefix("LS810")).toBe("LS");
  });
  it("returns null when there is no usable prefix", () => {
    expect(iataPrefix("")).toBeNull();
    expect(iataPrefix("1234")).toBeNull();
  });
});

describe("airlineForFlightNumber", () => {
  it("resolves known carriers", () => {
    expect(airlineForFlightNumber("BA245")).toBe("British Airways");
    expect(airlineForFlightNumber("U28042")).toBe("easyJet");
    expect(airlineForFlightNumber("FR1234")).toBe("Ryanair");
    expect(airlineForFlightNumber("VS155")).toBe("Virgin Atlantic");
  });
  it("is case-insensitive", () => {
    expect(airlineForFlightNumber("ba245")).toBe("British Airways");
  });
  it("returns null for unknown carriers", () => {
    expect(airlineForFlightNumber("ZZ999")).toBeNull();
    expect(airlineForFlightNumber("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-iata.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dispatch/iata'`.

- [ ] **Step 3: Write the implementation**

`src/lib/dispatch/iata.ts`:

```typescript
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
  // immediately followed by the flight-number digits. The lookahead ensures the
  // designator is followed by a digit so we don't swallow a flight digit into
  // the carrier code (the 2-3 letter branch is tried first; it can't consume a
  // trailing digit, so BA245 -> "BA", not "BA2").
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
```

> Note on `iataPrefix`: the regex `^([A-Z]{2,3}|[A-Z]\d)(?=\d)` tries the 2-3 letter branch first. `BA245` → the letter branch matches `BA` (it can't take the `2`, which is a digit) → `BA`. `TOM123` → `TOM`. `U28042` → the letter branch needs ≥2 letters but only `U` is available, so the `[A-Z]\d` branch matches `U2`. `1234`/`""` → no leading designator → `null`. (An earlier draft used `[A-Z]+\d?`, which greedily ate the first flight digit — `BA245` → `BA2`; that was wrong and is fixed here.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dispatch-iata.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dispatch/iata.ts tests/dispatch-iata.test.ts
git commit -m "feat(dispatch): IATA flight-number to airline lookup"
```

---

### Task 4: Airport buffer logic

**Files:**
- Create: `src/lib/dispatch/airport-buffer.ts`
- Test: `tests/dispatch-airport-buffer.test.ts`

Buffer logic (PRD §7.6.1): pickup time = flight arrival + buffer (default 30 min).

- [ ] **Step 1: Write the failing test**

`tests/dispatch-airport-buffer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pickupTimeFromArrival } from "@/lib/dispatch/airport-buffer";

describe("pickupTimeFromArrival", () => {
  it("adds the default 30-minute buffer", () => {
    expect(pickupTimeFromArrival("2026-06-01T14:00:00.000Z")).toBe(
      "2026-06-01T14:30:00.000Z",
    );
  });
  it("respects a custom buffer", () => {
    expect(pickupTimeFromArrival("2026-06-01T14:00:00.000Z", 45)).toBe(
      "2026-06-01T14:45:00.000Z",
    );
  });
  it("rolls over hours/days correctly", () => {
    expect(pickupTimeFromArrival("2026-06-01T23:50:00.000Z", 30)).toBe(
      "2026-06-02T00:20:00.000Z",
    );
  });
  it("throws on an unparseable arrival time", () => {
    expect(() => pickupTimeFromArrival("not-a-date")).toThrow();
  });
  it("rejects a negative buffer", () => {
    expect(() => pickupTimeFromArrival("2026-06-01T14:00:00.000Z", -5)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-airport-buffer.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dispatch/airport-buffer'`.

- [ ] **Step 3: Write the implementation**

`src/lib/dispatch/airport-buffer.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dispatch-airport-buffer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dispatch/airport-buffer.ts tests/dispatch-airport-buffer.test.ts
git commit -m "feat(dispatch): airport arrival-to-pickup buffer logic"
```

---

### Task 5: AutoCab response mappers + request builders

**Files:**
- Create: `src/lib/dispatch/autocab/config.ts`
- Create: `src/lib/dispatch/autocab/mappers.ts`
- Test: `tests/dispatch-autocab-mappers.test.ts`

Pure functions that translate AutoCab JSON (assumed shapes — see plan header) into the neutral DTOs from Task 1, and build AutoCab request bodies from neutral params. No I/O, fully unit-testable.

- [ ] **Step 1: Write the failing test**

`tests/dispatch-autocab-mappers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  mapAddress,
  mapZone,
  mapCapability,
  mapQuote,
  mapBooking,
  mapBookingStatus,
  mapFlight,
  toQuoteBody,
  toBookingBody,
} from "@/lib/dispatch/autocab/mappers";
import type { QuoteParams, BookingParams } from "@/lib/dispatch/types";

describe("mapAddress", () => {
  it("maps a full AutoCab address row", () => {
    expect(
      mapAddress({
        id: 42,
        text: "10 Downing St, London",
        zone: "SW1",
        postCode: "SW1A 2AA",
        latitude: 51.5,
        longitude: -0.12,
      }),
    ).toEqual({
      id: "42",
      label: "10 Downing St, London",
      zone: "SW1",
      postcode: "SW1A 2AA",
      lat: 51.5,
      lng: -0.12,
    });
  });
  it("tolerates missing optional fields", () => {
    expect(mapAddress({ id: 7, text: "Somewhere" })).toEqual({
      id: "7",
      label: "Somewhere",
      zone: null,
      postcode: null,
      lat: null,
      lng: null,
    });
  });
});

describe("mapZone / mapCapability", () => {
  it("maps a zone", () => {
    expect(mapZone({ id: 3, name: "LHR T5" })).toEqual({ id: "3", name: "LHR T5" });
  });
  it("maps a capability with passenger count", () => {
    expect(mapCapability({ id: 1, name: "Saloon", maxPassengers: 4 })).toEqual({
      id: "1",
      name: "Saloon",
      passengers: 4,
    });
  });
  it("maps a capability with no passenger count", () => {
    expect(mapCapability({ id: 2, name: "Estate" })).toEqual({
      id: "2",
      name: "Estate",
      passengers: null,
    });
  });
});

describe("mapQuote", () => {
  it("maps price/eta/currency", () => {
    expect(
      mapQuote({ price: 23.5, currency: "GBP", etaMinutes: 8, vehicleType: "Saloon" }),
    ).toEqual({ price: 23.5, currency: "GBP", etaMinutes: 8, vehicleType: "Saloon" });
  });
  it("defaults currency to GBP and eta to null", () => {
    expect(mapQuote({ price: 10 })).toEqual({
      price: 10,
      currency: "GBP",
      etaMinutes: null,
      vehicleType: null,
    });
  });
});

describe("mapBookingStatus", () => {
  it("normalises known AutoCab statuses", () => {
    expect(mapBookingStatus("Active")).toBe("confirmed");
    expect(mapBookingStatus("Dispatched")).toBe("dispatched");
    expect(mapBookingStatus("Completed")).toBe("completed");
    expect(mapBookingStatus("Cancelled")).toBe("cancelled");
    expect(mapBookingStatus("NoShow")).toBe("no_show");
  });
  it("defaults unknown/empty to confirmed", () => {
    expect(mapBookingStatus("Weird")).toBe("confirmed");
    expect(mapBookingStatus(null)).toBe("confirmed");
  });
});

describe("mapBooking", () => {
  it("maps a booking and preserves the raw payload", () => {
    const raw = {
      bookingId: 9001,
      status: "Active",
      price: 30,
      currency: "GBP",
      pickupTime: "2026-06-01T14:30:00.000Z",
      vehicleType: "MPV",
    };
    const result = mapBooking(raw);
    expect(result.dispatchRef).toBe("9001");
    expect(result.status).toBe("confirmed");
    expect(result.price).toBe(30);
    expect(result.currency).toBe("GBP");
    expect(result.pickupTime).toBe("2026-06-01T14:30:00.000Z");
    expect(result.vehicleType).toBe("MPV");
    expect(result.raw).toBe(raw);
  });
});

describe("mapFlight", () => {
  it("maps a flight and fills airline from IATA when vendor omits it", () => {
    expect(
      mapFlight({
        flightNumber: "BA245",
        origin: "GRU",
        scheduledArrival: "2026-06-01T06:00:00.000Z",
        estimatedArrival: "2026-06-01T06:12:00.000Z",
        terminal: "5",
      }),
    ).toEqual({
      flightNumber: "BA245",
      airline: "British Airways",
      origin: "GRU",
      scheduledArrival: "2026-06-01T06:00:00.000Z",
      estimatedArrival: "2026-06-01T06:12:00.000Z",
      terminal: "5",
    });
  });
  it("prefers a vendor-provided airline name", () => {
    expect(mapFlight({ flightNumber: "ZZ999", airline: "Mystery Air" }).airline).toBe(
      "Mystery Air",
    );
  });
});

describe("toQuoteBody / toBookingBody", () => {
  const pickup = { label: "A", zone: "Z1", postcode: "P1", lat: 1, lng: 2 };
  const destination = { label: "B", zone: "Z2", postcode: "P2", lat: 3, lng: 4 };

  it("builds a quote body", () => {
    const params: QuoteParams = {
      companyId: 55,
      pickup,
      destination,
      vehicleType: "Saloon",
      pickupTime: "2026-06-01T14:00:00.000Z",
    };
    expect(toQuoteBody(params)).toEqual({
      companyId: 55,
      pickup: { text: "A", zone: "Z1", postCode: "P1", latitude: 1, longitude: 2 },
      destination: { text: "B", zone: "Z2", postCode: "P2", latitude: 3, longitude: 4 },
      vehicleType: "Saloon",
      pickupTime: "2026-06-01T14:00:00.000Z",
    });
  });

  it("builds a booking body with passenger details", () => {
    const params: BookingParams = {
      companyId: 55,
      pickup,
      destination,
      pickupTime: "2026-06-01T14:30:00.000Z",
      vehicleType: "MPV",
      passengerName: "Jo Bloggs",
      passengerPhone: "+447700900000",
      quotedPrice: 30,
      notes: "Meet at arrivals",
    };
    expect(toBookingBody(params)).toEqual({
      companyId: 55,
      pickup: { text: "A", zone: "Z1", postCode: "P1", latitude: 1, longitude: 2 },
      destination: { text: "B", zone: "Z2", postCode: "P2", latitude: 3, longitude: 4 },
      pickupTime: "2026-06-01T14:30:00.000Z",
      vehicleType: "MPV",
      passengerName: "Jo Bloggs",
      passengerPhone: "+447700900000",
      price: 30,
      notes: "Meet at arrivals",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-autocab-mappers.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dispatch/autocab/mappers'`.

- [ ] **Step 3: Write the config type**

`src/lib/dispatch/autocab/config.ts`:

```typescript
/** Per-tenant AutoCab connection config (PRD §7.6.1). */
export interface AutoCabConfig {
  /** Customer-specific AutoCab instance base URL, no trailing slash. */
  baseUrl: string;
  /** Azure APIM subscription key (the secret) — from the credentials vault. */
  subscriptionKey: string;
}
```

- [ ] **Step 4: Write the mappers**

`src/lib/dispatch/autocab/mappers.ts`:

```typescript
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
```

> The `toQuoteBody`/`toBookingBody` tests above pass `vehicleType`/`pickupTime`/`notes` so every key is present; when a caller omits an optional field the key is present with value `undefined`, which `JSON.stringify` drops. That's intended and matches the test expectations (which always supply the optionals).

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/dispatch-autocab-mappers.test.ts`
Expected: PASS (all mapper tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dispatch/autocab/config.ts src/lib/dispatch/autocab/mappers.ts tests/dispatch-autocab-mappers.test.ts
git commit -m "feat(dispatch): AutoCab JSON mappers + request-body builders"
```

---

### Task 6: AutoCab adapter (injectable fetcher)

**Files:**
- Create: `src/lib/dispatch/autocab/adapter.ts`
- Test: `tests/dispatch-autocab-adapter.test.ts`

Implements `DispatchAdapter` over AutoCab's REST endpoints (PRD §7.6.1) using an injectable `fetch` (same pattern as `EngineClient`). Asserts the right method/path/headers/body and maps responses via Task-5 mappers.

- [ ] **Step 1: Write the failing test**

`tests/dispatch-autocab-adapter.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

// server-only throws outside the react-server condition (Vitest); stub it.
vi.mock("server-only", () => ({}));

import { AutoCabAdapter } from "@/lib/dispatch/autocab/adapter";
import { DispatchError } from "@/lib/dispatch/errors";

const config = { baseUrl: "https://acme.autocab.test", subscriptionKey: "sub-key-123" };

/** Builds a fake fetch returning `body` as JSON, recording the call. */
function fakeFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe("AutoCabAdapter.lookupAddress", () => {
  it("POSTs /address with the subscription-key header and maps results", async () => {
    const { fetcher, calls } = fakeFetch({
      results: [{ id: 1, text: "10 Downing St", zone: "SW1", postCode: "SW1A 2AA" }],
    });
    const adapter = new AutoCabAdapter(config, fetcher);
    const out = await adapter.lookupAddress("downing", 55);

    expect(out).toEqual([
      { id: "1", label: "10 Downing St", zone: "SW1", postcode: "SW1A 2AA", lat: null, lng: null },
    ]);
    expect(calls[0].url).toBe("https://acme.autocab.test/address");
    expect(calls[0].init?.method).toBe("POST");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers["Ocp-Apim-Subscription-Key"]).toBe("sub-key-123");
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ text: "downing", companyId: 55 });
  });
});

describe("AutoCabAdapter.getZones / getCapabilities", () => {
  it("GETs /zones?companyId= and maps", async () => {
    const { fetcher, calls } = fakeFetch({ zones: [{ id: 3, name: "LHR T5" }] });
    const out = await new AutoCabAdapter(config, fetcher).getZones(55);
    expect(out).toEqual([{ id: "3", name: "LHR T5" }]);
    expect(calls[0].url).toBe("https://acme.autocab.test/zones?companyId=55");
    expect(calls[0].init?.method ?? "GET").toBe("GET");
  });
  it("GETs /capabilities?companyId= and maps", async () => {
    const { fetcher, calls } = fakeFetch({
      capabilities: [{ id: 1, name: "Saloon", maxPassengers: 4 }],
    });
    const out = await new AutoCabAdapter(config, fetcher).getCapabilities(55);
    expect(out).toEqual([{ id: "1", name: "Saloon", passengers: 4 }]);
    expect(calls[0].url).toBe("https://acme.autocab.test/capabilities?companyId=55");
  });
});

describe("AutoCabAdapter.getQuote", () => {
  it("POSTs /quote and returns a normalised quote", async () => {
    const { fetcher, calls } = fakeFetch({ price: 23.5, currency: "GBP", etaMinutes: 8 });
    const out = await new AutoCabAdapter(config, fetcher).getQuote({
      companyId: 55,
      pickup: { label: "A", zone: "Z1", postcode: "P1", lat: 1, lng: 2 },
      destination: { label: "B", zone: "Z2", postcode: "P2", lat: 3, lng: 4 },
      vehicleType: "Saloon",
      pickupTime: "2026-06-01T14:00:00.000Z",
    });
    expect(out).toEqual({ price: 23.5, currency: "GBP", etaMinutes: 8, vehicleType: null });
    expect(calls[0].url).toBe("https://acme.autocab.test/quote");
    expect(calls[0].init?.method).toBe("POST");
  });
});

describe("AutoCabAdapter booking CRUD", () => {
  const base = {
    companyId: 55,
    pickup: { label: "A", zone: "Z1", postcode: "P1", lat: 1, lng: 2 },
    destination: { label: "B", zone: "Z2", postcode: "P2", lat: 3, lng: 4 },
    pickupTime: "2026-06-01T14:30:00.000Z",
    passengerName: "Jo",
    passengerPhone: "+447700900000",
  };

  it("createBooking POSTs /booking and maps the result", async () => {
    const { fetcher, calls } = fakeFetch({ bookingId: 9001, status: "Active", price: 30, currency: "GBP" });
    const out = await new AutoCabAdapter(config, fetcher).createBooking(base);
    expect(out.dispatchRef).toBe("9001");
    expect(out.status).toBe("confirmed");
    expect(calls[0].url).toBe("https://acme.autocab.test/booking");
    expect(calls[0].init?.method).toBe("POST");
  });

  it("getBooking GETs /booking/{id}?companyId=", async () => {
    const { fetcher, calls } = fakeFetch({ bookingId: 9001, status: "Dispatched" });
    const out = await new AutoCabAdapter(config, fetcher).getBooking("9001", 55);
    expect(out.status).toBe("dispatched");
    expect(calls[0].url).toBe("https://acme.autocab.test/booking/9001?companyId=55");
  });

  it("modifyBooking PATCHes /booking/{id}", async () => {
    const { fetcher, calls } = fakeFetch({ bookingId: 9001, status: "Active" });
    const out = await new AutoCabAdapter(config, fetcher).modifyBooking("9001", {
      pickupTime: "2026-06-01T15:00:00.000Z",
    });
    expect(out.dispatchRef).toBe("9001");
    expect(calls[0].url).toBe("https://acme.autocab.test/booking/9001");
    expect(calls[0].init?.method).toBe("PATCH");
  });

  it("cancelBooking DELETEs /booking/{id}?companyId= and returns void", async () => {
    const { fetcher, calls } = fakeFetch({}, 204);
    const out = await new AutoCabAdapter(config, fetcher).cancelBooking("9001", 55);
    expect(out).toBeUndefined();
    expect(calls[0].url).toBe("https://acme.autocab.test/booking/9001?companyId=55");
    expect(calls[0].init?.method).toBe("DELETE");
  });
});

describe("AutoCabAdapter.searchFlights", () => {
  it("GETs /flights/search and maps", async () => {
    const { fetcher, calls } = fakeFetch({
      flights: [{ flightNumber: "BA245", terminal: "5", scheduledArrival: "2026-06-01T06:00:00.000Z" }],
    });
    const out = await new AutoCabAdapter(config, fetcher).searchFlights("BA245", 55);
    expect(out[0].airline).toBe("British Airways");
    expect(out[0].terminal).toBe("5");
    expect(calls[0].url).toBe(
      "https://acme.autocab.test/flights/search?flightNumber=BA245&companyId=55",
    );
  });
});

describe("AutoCabAdapter error handling", () => {
  it("throws a neutral DispatchError on a non-2xx response", async () => {
    const { fetcher } = fakeFetch({ error: "bad" }, 500);
    await expect(
      new AutoCabAdapter(config, fetcher).getZones(55),
    ).rejects.toBeInstanceOf(DispatchError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-autocab-adapter.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dispatch/autocab/adapter'`.

- [ ] **Step 3: Write the adapter**

`src/lib/dispatch/autocab/adapter.ts`:

```typescript
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
} from "./mappers";

type Fetcher = typeof fetch;

/**
 * AutoCab dispatch adapter (PRD §7.6.1). Endpoints are called against the
 * customer's AutoCab instance with the Azure APIM subscription-key header. The
 * fetcher is injectable so every method is unit-testable without network — the
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
      body: JSON.stringify(params),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dispatch-autocab-adapter.test.ts`
Expected: PASS (all adapter tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dispatch/autocab/adapter.ts tests/dispatch-autocab-adapter.test.ts
git commit -m "feat(dispatch): AutoCab adapter over REST with injectable fetcher"
```

---

### Task 7: iCabbi + Cordic stub adapters

**Files:**
- Create: `src/lib/dispatch/icabbi/adapter.ts`
- Create: `src/lib/dispatch/cordic/adapter.ts`
- Modify: `tests/dispatch-stubs.test.ts` (extend the Task-1 file)

Each stub implements the full `DispatchAdapter` interface so it is type-compatible and a drop-in for the v1.2 build, but every method throws `DispatchNotImplementedError`.

- [ ] **Step 1: Add the failing tests**

Append to `tests/dispatch-stubs.test.ts`:

```typescript
import { ICabbiAdapter } from "@/lib/dispatch/icabbi/adapter";
import { CordicAdapter } from "@/lib/dispatch/cordic/adapter";
import type { DispatchAdapter } from "@/lib/dispatch/types";

const addr = { label: "A", zone: null, postcode: null, lat: null, lng: null };

function bookingParams() {
  return {
    companyId: 1,
    pickup: addr,
    destination: addr,
    pickupTime: "2026-06-01T14:00:00.000Z",
    passengerName: "Jo",
    passengerPhone: "+447700900000",
  };
}

/** Every DispatchAdapter method on a stub must reject with NotImplemented. */
function assertAllNotImplemented(adapter: DispatchAdapter, vendorWord: RegExp) {
  const calls: Array<Promise<unknown>> = [
    adapter.lookupAddress("x", 1),
    adapter.getZones(1),
    adapter.getCapabilities(1),
    adapter.getQuote({ companyId: 1, pickup: addr, destination: addr }),
    adapter.createBooking(bookingParams()),
    adapter.getBooking("1", 1),
    adapter.modifyBooking("1", {}),
    adapter.cancelBooking("1", 1),
    adapter.searchFlights("BA245", 1),
  ];
  return Promise.all(
    calls.map((p) =>
      p.then(
        () => { throw new Error("expected rejection"); },
        (e: Error) => {
          expect(e).toBeInstanceOf(DispatchNotImplementedError);
          expect(e.message).toMatch(vendorWord);
          expect(e.message).not.toMatch(/n8n|workflow|execution/i);
        },
      ),
    ),
  );
}

describe("ICabbiAdapter stub", () => {
  it("throws DispatchNotImplementedError on every method", async () => {
    await assertAllNotImplemented(new ICabbiAdapter(), /iCabbi/);
  });
});

describe("CordicAdapter stub", () => {
  it("throws DispatchNotImplementedError on every method", async () => {
    await assertAllNotImplemented(new CordicAdapter(), /Cordic/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-stubs.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dispatch/icabbi/adapter'`.

- [ ] **Step 3: Write the iCabbi stub**

`src/lib/dispatch/icabbi/adapter.ts`:

```typescript
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

const VENDOR = "iCabbi";

/**
 * iCabbi adapter — v1.2 roadmap (PRD §7.6.2). Stubbed so the factory can route
 * `dispatch_adapter='icabbi'` today; every method throws a neutral
 * DispatchNotImplementedError until the real REST/polling adapter lands.
 */
export class ICabbiAdapter implements DispatchAdapter {
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
```

- [ ] **Step 4: Write the Cordic stub**

`src/lib/dispatch/cordic/adapter.ts`:

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/dispatch-stubs.test.ts`
Expected: PASS (errors + both stubs).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dispatch/icabbi/adapter.ts src/lib/dispatch/cordic/adapter.ts tests/dispatch-stubs.test.ts
git commit -m "feat(dispatch): iCabbi + Cordic stub adapters (graceful not-implemented)"
```

---

### Task 8: Migration — `tenants.dispatch_base_url` + dispatch credential type

**Files:**
- Create: `supabase/migrations/0014_dispatch_config.sql`
- Test: `tests/dispatch-migration.test.ts`

Adds the AutoCab base-URL column and extends the vault `credential_type` allow-list to include `autocab_subscription_key` (stored tenant-scoped with `channel_id = NULL`). The test asserts the SQL contains both changes (mirrors the lightweight SQL-presence checks the repo already uses for migration coverage).

- [ ] **Step 1: Write the failing test**

`tests/dispatch-migration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0014_dispatch_config.sql"),
  "utf8",
);

describe("0014_dispatch_config migration", () => {
  it("adds the dispatch_base_url column to tenants", () => {
    expect(sql).toMatch(/alter table public\.tenants\s+add column if not exists dispatch_base_url text/i);
  });
  it("re-adds the credential_type CHECK including autocab_subscription_key", () => {
    expect(sql).toMatch(/drop constraint if exists channel_credentials_credential_type_check/i);
    expect(sql).toMatch(/autocab_subscription_key/);
  });
  it("preserves the existing credential types in the new CHECK", () => {
    for (const t of [
      "whatsapp_token",
      "telegram_token",
      "messenger_token",
      "instagram_token",
      "widget_secret",
      "meta_app_secret",
      "telegram_webhook_secret",
      "widget_signing_key",
      "meta_verify_token",
    ]) {
      expect(sql).toContain(t);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-migration.test.ts`
Expected: FAIL — `ENOENT ... 0014_dispatch_config.sql`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/0014_dispatch_config.sql`:

```sql
-- Epic 6 — Dispatch adapter layer config.
--
-- (a) AutoCab base URL: the per-tenant AutoCab instance endpoint (PRD §7.6.1).
--     Non-secret, so a plain column on tenants (the subscription KEY is the
--     secret and lives in the vault — see below).
alter table public.tenants
  add column if not exists dispatch_base_url text;

-- (b) Store the AutoCab subscription key in the EXISTING channel_credentials
--     vault. Dispatch credentials are tenant-scoped, not channel-scoped, and
--     channel_credentials.channel_id is nullable — so a dispatch key is stored
--     with channel_id = NULL and credential_type = 'autocab_subscription_key',
--     reusing vault_store_credential_rpc / vault_read_credential_rpc (no new
--     table or RPC). Extend the allow-list by dropping + re-adding the CHECK
--     (same pattern as migration 0013).
alter table public.channel_credentials
  drop constraint if exists channel_credentials_credential_type_check;

alter table public.channel_credentials
  add constraint channel_credentials_credential_type_check
  check (credential_type in (
    -- send tokens (0008)
    'whatsapp_token','telegram_token','messenger_token','instagram_token','widget_secret',
    -- inbound verify secrets (0013)
    'meta_app_secret','telegram_webhook_secret','widget_signing_key','meta_verify_token',
    -- dispatch secrets (Epic 6)
    'autocab_subscription_key'
  ));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dispatch-migration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify the migration applies cleanly on local Supabase**

Run: `supabase db reset` (or the repo's migration-dry-run task used in CI)
Expected: all migrations 0001–0014 apply with no error.

> If `supabase` CLI is unavailable in the execution environment, skip the live apply and note it; the CI migration-dry-run step (Plan 1) covers it. Do not mark this step done without one of the two having run.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0014_dispatch_config.sql tests/dispatch-migration.test.ts
git commit -m "feat(dispatch): migration for tenant dispatch base URL + AutoCab key vault type"
```

---

### Task 9: Factory — per-tenant config loader + adapter selection

**Files:**
- Create: `src/lib/dispatch/factory.ts`
- Test: `tests/dispatch-factory.test.ts`

`loadDispatchConfig(tenantId)` reads `dispatch_adapter`, `dispatch_company_id`, `dispatch_base_url` from `tenants` and (for AutoCab) decrypts the subscription key from the vault. `getDispatchAdapter(tenantId)` returns the right adapter or a stub. The Supabase client + a `secretReader` are injectable so the factory is testable without a live DB (same spirit as the resolver-loader service-role pattern).

- [ ] **Step 1: Write the failing test**

`tests/dispatch-factory.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getDispatchAdapter, loadDispatchConfig } from "@/lib/dispatch/factory";
import { AutoCabAdapter } from "@/lib/dispatch/autocab/adapter";
import { ICabbiAdapter } from "@/lib/dispatch/icabbi/adapter";
import { CordicAdapter } from "@/lib/dispatch/cordic/adapter";
import { DispatchConfigError } from "@/lib/dispatch/errors";

/** A deps double: a tenant row + a vault secret keyed by tenant. */
function deps(opts: {
  adapter: string;
  companyId?: string | null;
  baseUrl?: string | null;
  secret?: string | null;
}) {
  return {
    loadTenantDispatch: vi.fn(async () => ({
      dispatchAdapter: opts.adapter,
      dispatchCompanyId: opts.companyId ?? null,
      dispatchBaseUrl: opts.baseUrl ?? null,
    })),
    loadAutoCabKey: vi.fn(async () => opts.secret ?? null),
  };
}

describe("loadDispatchConfig", () => {
  it("returns AutoCab config when fully provisioned", async () => {
    const d = deps({
      adapter: "autocab",
      companyId: "55",
      baseUrl: "https://acme.autocab.test/",
      secret: "sub-key",
    });
    const cfg = await loadDispatchConfig("t1", d);
    expect(cfg).toEqual({
      adapter: "autocab",
      companyId: 55,
      autoCab: { baseUrl: "https://acme.autocab.test", subscriptionKey: "sub-key" },
    });
  });

  it("throws DispatchConfigError when the tenant is missing", async () => {
    const d = {
      loadTenantDispatch: vi.fn(async () => null),
      loadAutoCabKey: vi.fn(async () => null),
    };
    await expect(loadDispatchConfig("missing", d)).rejects.toBeInstanceOf(DispatchConfigError);
  });

  it("throws DispatchConfigError when AutoCab base URL or key is missing", async () => {
    const noUrl = deps({ adapter: "autocab", companyId: "55", baseUrl: null, secret: "k" });
    await expect(loadDispatchConfig("t1", noUrl)).rejects.toBeInstanceOf(DispatchConfigError);
    const noKey = deps({ adapter: "autocab", companyId: "55", baseUrl: "https://x.test", secret: null });
    await expect(loadDispatchConfig("t1", noKey)).rejects.toBeInstanceOf(DispatchConfigError);
  });

  it("does not require an AutoCab key for stub adapters", async () => {
    const d = deps({ adapter: "icabbi", companyId: "9" });
    const cfg = await loadDispatchConfig("t1", d);
    expect(cfg).toEqual({ adapter: "icabbi", companyId: 9, autoCab: null });
    expect(d.loadAutoCabKey).not.toHaveBeenCalled();
  });
});

describe("getDispatchAdapter", () => {
  it("returns an AutoCabAdapter for autocab tenants", async () => {
    const d = deps({
      adapter: "autocab",
      companyId: "55",
      baseUrl: "https://acme.autocab.test",
      secret: "sub-key",
    });
    expect(await getDispatchAdapter("t1", d)).toBeInstanceOf(AutoCabAdapter);
  });
  it("returns the iCabbi stub for icabbi tenants", async () => {
    expect(await getDispatchAdapter("t1", deps({ adapter: "icabbi", companyId: "1" }))).toBeInstanceOf(
      ICabbiAdapter,
    );
  });
  it("returns the Cordic stub for cordic tenants", async () => {
    expect(await getDispatchAdapter("t1", deps({ adapter: "cordic", companyId: "1" }))).toBeInstanceOf(
      CordicAdapter,
    );
  });
  it("throws DispatchConfigError for an unknown adapter value", async () => {
    await expect(
      getDispatchAdapter("t1", deps({ adapter: "weird", companyId: "1" })),
    ).rejects.toBeInstanceOf(DispatchConfigError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-factory.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dispatch/factory'`.

- [ ] **Step 3: Write the factory**

`src/lib/dispatch/factory.ts`:

```typescript
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { DispatchAdapter } from "./types";
import { DispatchConfigError } from "./errors";
import { AutoCabAdapter } from "./autocab/adapter";
import { ICabbiAdapter } from "./icabbi/adapter";
import { CordicAdapter } from "./cordic/adapter";

/** Raw per-tenant dispatch settings from the `tenants` row. */
type TenantDispatch = {
  dispatchAdapter: string;
  dispatchCompanyId: string | null;
  dispatchBaseUrl: string | null;
};

/** Injectable data access so the factory is testable without a live DB. */
export interface DispatchDeps {
  loadTenantDispatch(tenantId: string): Promise<TenantDispatch | null>;
  loadAutoCabKey(tenantId: string): Promise<string | null>;
}

/** Resolved, validated config the factory builds adapters from. */
export type DispatchConfig = {
  adapter: string;
  companyId: number;
  autoCab: { baseUrl: string; subscriptionKey: string } | null;
};

/** Service-role read of the tenant's dispatch settings (RLS would block anon). */
async function defaultLoadTenantDispatch(tenantId: string): Promise<TenantDispatch | null> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from("tenants")
    .select("dispatch_adapter, dispatch_company_id, dispatch_base_url")
    .eq("id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    dispatchAdapter: data.dispatch_adapter,
    dispatchCompanyId: data.dispatch_company_id,
    dispatchBaseUrl: data.dispatch_base_url,
  };
}

/** Decrypts the tenant-scoped AutoCab subscription key from the Epic-3 vault. */
async function defaultLoadAutoCabKey(tenantId: string): Promise<string | null> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: cred } = await supabase
    .from("channel_credentials")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("credential_type", "autocab_subscription_key")
    .is("channel_id", null)
    .maybeSingle();
  if (!cred) return null;
  const { data: secret, error } = await supabase.rpc("vault_read_credential_rpc", {
    p_id: (cred as { id: string }).id,
    p_accessed_by: null,
    p_key: env.SUPABASE_VAULT_KEY,
  });
  if (error) return null;
  return (secret as string) ?? null;
}

const defaultDeps: DispatchDeps = {
  loadTenantDispatch: defaultLoadTenantDispatch,
  loadAutoCabKey: defaultLoadAutoCabKey,
};

/**
 * Loads + validates a tenant's dispatch config. Throws DispatchConfigError when
 * the tenant is unknown, the company id is missing/non-numeric, or (for AutoCab)
 * the base URL / subscription key is absent.
 */
export async function loadDispatchConfig(
  tenantId: string,
  deps: DispatchDeps = defaultDeps,
): Promise<DispatchConfig> {
  const t = await deps.loadTenantDispatch(tenantId);
  if (!t) {
    throw new DispatchConfigError("No dispatch configuration for this account.");
  }
  const companyId = Number(t.dispatchCompanyId);
  if (!t.dispatchCompanyId || Number.isNaN(companyId)) {
    throw new DispatchConfigError("Dispatch company id is missing or invalid.");
  }

  if (t.dispatchAdapter === "autocab") {
    const baseUrl = (t.dispatchBaseUrl ?? "").replace(/\/$/, "");
    if (!baseUrl) {
      throw new DispatchConfigError("AutoCab base URL is not configured.");
    }
    const subscriptionKey = await deps.loadAutoCabKey(tenantId);
    if (!subscriptionKey) {
      throw new DispatchConfigError("AutoCab subscription key is not configured.");
    }
    return { adapter: "autocab", companyId, autoCab: { baseUrl, subscriptionKey } };
  }

  // Stub adapters need no AutoCab secret.
  return { adapter: t.dispatchAdapter, companyId, autoCab: null };
}

/**
 * Returns the DispatchAdapter for a tenant. AutoCab is fully wired; iCabbi and
 * Cordic return stubs that throw DispatchNotImplementedError on use (PRD §7.6.2/3).
 */
export async function getDispatchAdapter(
  tenantId: string,
  deps: DispatchDeps = defaultDeps,
): Promise<DispatchAdapter> {
  const config = await loadDispatchConfig(tenantId, deps);
  switch (config.adapter) {
    case "autocab":
      // autoCab is non-null here — loadDispatchConfig guarantees it for autocab.
      return new AutoCabAdapter(config.autoCab!);
    case "icabbi":
      return new ICabbiAdapter();
    case "cordic":
      return new CordicAdapter();
    default:
      throw new DispatchConfigError("Unknown dispatch adapter for this account.");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/dispatch-factory.test.ts`
Expected: PASS (all factory tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dispatch/factory.ts tests/dispatch-factory.test.ts
git commit -m "feat(dispatch): per-tenant config loader + adapter selection factory"
```

---

### Task 10: Public barrel + brand-safety guard + full-suite gate

**Files:**
- Create: `src/lib/dispatch/index.ts`
- Create: `tests/dispatch-brand.test.ts`

A single import surface for the layer, plus a guard test that the layer never embeds banned internal vocabulary in user/log-reachable strings (mirrors `tests/engine-brand.test.ts`).

- [ ] **Step 1: Write the failing brand test**

`tests/dispatch-brand.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Recursively list .ts files under a dir. */
function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("dispatch layer brand safety", () => {
  it("contains no banned internal/engine vocabulary", () => {
    const banned = /\bn8n\b|\bCabLab\b|\bworkflow\b|\bexecution\b/i;
    for (const file of tsFiles(join(process.cwd(), "src/lib/dispatch"))) {
      const text = readFileSync(file, "utf8");
      expect(text, `${file} contains banned vocabulary`).not.toMatch(banned);
    }
  });

  it("re-exports the public surface from index.ts", async () => {
    const mod = await import("@/lib/dispatch");
    expect(typeof mod.getDispatchAdapter).toBe("function");
    expect(typeof mod.lhrZoneForTerminal).toBe("function");
    expect(typeof mod.airlineForFlightNumber).toBe("function");
    expect(typeof mod.pickupTimeFromArrival).toBe("function");
    expect(typeof mod.DispatchError).toBe("function");
  });
});
```

> `index.ts` re-exports `AutoCabAdapter`/factory which import `server-only`; the dynamic `import("@/lib/dispatch")` in this test runs under Vitest where `server-only` is unstubbed and would throw. Add `vi.mock("server-only", () => ({}))` at the top of this file (before the `import`s that matter) — see Step 2.

- [ ] **Step 2: Add the server-only stub to the brand test**

Insert at the very top of `tests/dispatch-brand.test.ts`, above the other imports:

```typescript
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run tests/dispatch-brand.test.ts`
Expected: FAIL — `Cannot find module '@/lib/dispatch'` (index missing).

- [ ] **Step 4: Write the barrel**

`src/lib/dispatch/index.ts`:

```typescript
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
```

- [ ] **Step 5: Run the brand test to verify it passes**

Run: `pnpm vitest run tests/dispatch-brand.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the whole dispatch suite + typecheck + lint**

Run:
```bash
pnpm vitest run tests/dispatch-*.test.ts
pnpm typecheck
pnpm lint
```
Expected: all dispatch tests PASS; `tsc --noEmit` clean; `next lint` clean.

> If `pnpm typecheck` flags the `config.autoCab!` non-null assertion as a lint error under a `no-non-null-assertion` rule, replace it in `factory.ts` with an explicit guard:
> ```typescript
> case "autocab": {
>   if (!config.autoCab) throw new DispatchConfigError("AutoCab config missing.");
>   return new AutoCabAdapter(config.autoCab);
> }
> ```

- [ ] **Step 7: Commit**

```bash
git add src/lib/dispatch/index.ts tests/dispatch-brand.test.ts
git commit -m "feat(dispatch): public barrel + brand-safety guard for dispatch layer"
```

---

## Self-review against the spec

**Spec coverage (PRD §7.6 + roadmap Plan 6):**
- `DispatchAdapter` TS interface (§7.6) → Task 1 ✅
- AutoCab address / zones / capabilities / quote / booking CRUD / flights (§7.6.1) → Tasks 5–6 ✅
- LHR terminal zone mapping T1/T2/T3→`LHR T123`, T4→`LHR T4`, T5→`LHR T5` (§7.6.1) → Task 2 ✅
- IATA→airline lookup (§7.6.1) → Task 3 ✅
- Airport buffer (arrival + default 30 min) (§7.6.1) → Task 4 ✅
- Per-tenant adapter selection (§7.6) → Task 9 ✅ (+ config storage in Task 8)
- iCabbi/Cordic stubs that error gracefully (Q2, §7.6.2/3) → Task 7 ✅
- Brand rule (no n8n/CabLab vocabulary) → Task 10 guard ✅

**Placeholder scan:** every code step has full code; every test step has full assertions; no "TBD"/"add error handling" left abstract.

**Type consistency:** `AddressRef`/`QuoteParams`/`BookingParams`/`BookingResult` defined once in `types.ts` and used unchanged by mappers (Task 5), adapter (Task 6), stubs (Task 7), and factory (Task 9). `AutoCabConfig` ( `{ baseUrl, subscriptionKey }` ) is defined in Task 5 and consumed identically in Tasks 6 and 9. Factory `DispatchDeps` method names (`loadTenantDispatch`, `loadAutoCabKey`) match between the test doubles and the implementation.

**Note for the executor:** the AutoCab request/response JSON shapes are this adapter's *target contract*, isolated in `autocab/mappers.ts`. If a real AutoCab instance is connected later and its shapes differ, only the mappers + their tests change — the interface, adapter wiring, factory, and state-machine callers stay put.

---

## Post-review follow-ups (for when the live AutoCab API is connected)

Found during the final code review; **not blocking** — they only matter against a real AutoCab instance, since all vendor shapes here are an assumed contract isolated in `autocab/mappers.ts`:

- **`mapAddress` blank-id fallback** (`mappers.ts`): an id-less address row maps to `id: ""`. Once the real shape is known, consider dropping id-less rows in `lookupAddress` so a blank reference can't reach a quote/booking call.
- **`mapQuote` zero-price default** (`mappers.ts`): a missing price defaults to `0`, indistinguishable from a genuine £0. When wiring live, prefer `null` + an explicit guard at the call site before confirming a booking.
- **End-to-end body assertion on `createBooking`** (`tests/dispatch-autocab-adapter.test.ts`): body correctness is covered indirectly via the `toBookingBody` mapper test; an explicit request-body assertion on `createBooking` would guard against a future wiring regression.

(The review's one blocking item — `modifyBooking` sending neutral DTO field names instead of AutoCab shapes — was fixed in-branch via the `toBookingPatchBody` mapper, with mapper + adapter-body tests added.)

## Execution handoff

This plan is ready to execute with **subagent-driven-development** (fresh subagent per task, two-stage review between tasks) — Tasks 1–10 are sequential (each imports types/modules from earlier tasks), so they run in order, not in parallel.
