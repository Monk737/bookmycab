# Tenant Dashboard — Surface Real Bot Features

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make the tenant dashboard reflect what the real Premier Mini Cabs bot actually captures — airport/flight details, driver notes, ETA/distance/payment/references, the real vehicle set (incl. wheelchair WAV), and an Airport & Flights analytics view.

**Why:** The dashboard was built against assumed data shapes. The real bot (n8n `Premier-Mini-Cabs-Main-Workflow` + Voice) writes richer shapes that the UI/seed don't match, so airport bookings and several captured fields render as nothing.

---

## Shared data-shape contract (ALL workstreams must use these verbatim)

**`bookings.airport_json`** (only for airport bookings):
```jsonc
{
  "code": "LHR",                       // IATA airport code
  "name": "Heathrow Airport",
  "flightNumber": "AA136",
  "arrivalTerminal": "3",
  "arrivalTimeUtc": "2026-05-31T12:45:00+01:00",
  "bufferMinutes": 30,
  "pickupAtUtc": "2026-05-31T12:15:00.000Z",
  "flightObject": {
    "airline": "American Airlines",
    "airlineCode": "AA",
    "departureAirport": "Los Angeles International Airport",
    "departureAirportCode": "LAX"
  },
  "flightSummary": "AA136 LAX - LHR (T:3) arrival @ 31/05/2026 12:45"
}
```

**`bookings.raw_dispatch_json`** (all bookings):
```jsonc
{ "distanceMiles": 2.6, "journeyTime": "38 min", "tariff": "Main cash Tariff", "bookingType": "Advanced" }
```

**`bookings.vehicle_type`** — exactly one of: `saloon` | `estate` | `mpv` | `8seater` | `wheelchair`.
Display labels: Saloon · Estate · MPV (6-seater) · 8-seater · Wheelchair (WAV).

**`bookings.payment_method`** — one of: `Cash` | `Card` | `Account`.
**`bookings.your_reference_1/2/3`** — `WA-<digits>` · `<vehicle_type>` · `<fare like £14.80>`.

---

## WORKSTREAM A — Seed enrichment (`scripts/seed-demo.ts`)

Make the demo data match the contract so every dashboard feature has real data.

- [ ] **A1. Real vehicle set.** Replace `const VEHICLE_TYPES = ["Saloon", "Executive", "MPV"]` and `pickVehicle()` so it returns weighted lowercase codes: `saloon` (50%), `estate` (15%), `mpv` (20%), `8seater` (10%), `wheelchair` (5%). Update `automations.config.vehicle_types` seed (line ~339) and any booking-message copy that lists "Saloon, Executive, or MPV" to "Saloon, Estate, MPV, 8-seater or Wheelchair".

- [ ] **A2. Real airport_json.** In the per-booking insert (~line 488), when `isAirport && terminal`, write the full contract shape. Use a small `AIRLINES` table, e.g.:
```ts
const AIRLINES = [
  { airline: "British Airways", code: "BA", dep: "John F. Kennedy International Airport", depCode: "JFK" },
  { airline: "Emirates", code: "EK", dep: "Dubai International Airport", depCode: "DXB" },
  { airline: "American Airlines", code: "AA", dep: "Los Angeles International Airport", depCode: "LAX" },
  { airline: "Lufthansa", code: "LH", dep: "Frankfurt Airport", depCode: "FRA" },
  { airline: "Qatar Airways", code: "QR", dep: "Hamad International Airport", depCode: "DOH" },
];
```
Build `airport_json` with `code`/`name` from the existing `terminal` (LHR terminals already in the seed — use code "LHR", name "Heathrow Airport"), `flightNumber = ${al.code}${randInt(100,999)}`, `arrivalTerminal = terminal.terminal`, `arrivalTimeUtc` ≈ `pickupAt` − bufferMinutes, `bufferMinutes = pick([30,45,60])`, `pickupAtUtc = pickupAt`, `flightObject` from the picked airline, and a `flightSummary` string.

- [ ] **A3. Notes / references / payment / dispatch.** On the booking insert add:
  - `driver_note`: ~30% of bookings get one of `["Please call on arrival", "Meet at the main entrance", "Child seat needed", "Luggage — large boot please", ""]` (rest empty/undefined).
  - `payment_method`: weighted `Cash` (60%) / `Card` (30%) / `Account` (10%).
  - `your_reference_1 = \`WA-${customerHandle.replace(/\\D/g, "")}\``, `your_reference_2 = vehicle_type`, `your_reference_3 = \`£${fare.toFixed(2)}\``.
  - `raw_dispatch_json = { distanceMiles: Number(randFloat(0.8, 18).toFixed(1)), journeyTime: \`${randInt(6, 55)} min\`, tariff: "Main cash Tariff", bookingType: pick(["Advanced","Active","Dispatched","Completed"]) }` (replace the `{ demo: true }`).

- [ ] **A4. Re-seed + verify.** Run `npx --yes tsx scripts/seed-demo.ts`, then verify with psql:
  `select vehicle_type, count(*) from bookings group by 1;` (5 real types) and
  `select count(*) from bookings where airport_json ? 'flightNumber';` (>0) and
  `select count(*) from bookings where driver_note <> '';` (>0).

- [ ] **A5. Commit.** `git add scripts/seed-demo.ts && git commit -m "feat(demo): real vehicle set + airport/flight, driver-note, refs, payment, dispatch fields"`

---

## WORKSTREAM B — Booking detail enrichment (`src/app/.../bookings/bookings-client.tsx`)

Render the real captured fields in the booking slide-over. The detail already fetches `detail.airportJson`, `detail.driverNote`, `detail.rawDispatchJson`, `detail.dispatchRef`. The `BookingDetail` type has `airportJson`, `driverNote`, `rawDispatchJson` (all `unknown`/`string|null`) — no type changes needed; cast `rawDispatchJson`/`airportJson` to the contract shapes locally.

- [ ] **B1. Fix `AirportData` + `renderAirportSection`.** Replace the `AirportData` interface and the `fields` list to read the real shape:
```ts
interface AirportData {
  code?: string; name?: string; flightNumber?: string; arrivalTerminal?: string;
  arrivalTimeUtc?: string; bufferMinutes?: number; pickupAtUtc?: string;
  flightObject?: { airline?: string; airlineCode?: string; departureAirport?: string; departureAirportCode?: string };
  flightSummary?: string; [key: string]: unknown;
}
```
Render rows: **Airport** (`name`), **Flight** (`flightNumber`), **Airline** (`flightObject.airline`), **From** (`flightObject.departureAirport` + code), **Terminal** (`arrivalTerminal`), **Arrival** (format `arrivalTimeUtc` via existing `formatDateTime(..., "Europe/London")`), **Driver ready** (`bufferMinutes` → `${n} min after arrival`), **Pickup** (format `pickupAtUtc`). Keep the "show only present fields" pattern.

- [ ] **B2. Trip facts block.** Add a section (rendered in the slide-over alongside the address/airport blocks) that shows, when present: **ETA** (`rawDispatchJson.journeyTime`), **Distance** (`${rawDispatchJson.distanceMiles} mi`), **Payment** (`detail.paymentMethod` — `BookingRow` already maps `payment_method`? if not, read from `rawDispatchJson` is wrong — use `detail` field; the booking row maps payment? If `paymentMethod` is not on the type, render from a cast of the detail object). Also show **Dispatch ref** (`detail.dispatchRef`) and **References** (`your_reference_1..3` — these are on the booking row as `your_reference_*`; if not mapped, cast `detail as unknown as Record<string,unknown>` and read `your_reference_1/2/3`).

- [ ] **B3. Driver note.** When `detail.driverNote` is a non-empty string, render a highlighted note block (amber, like the conversation abandonment block): heading "Driver note", body the text.

- [ ] **B4. Verify.** `pnpm typecheck` clean. (The page is auth-gated; rely on typecheck + the structure test if present.) Run any existing bookings test: `pnpm vitest run $(ls tests | grep -iE 'booking' | sed 's#^#tests/#' | tr '\n' ' ')` if such tests exist.

- [ ] **B5. Commit.** `git add "src/app/dashboard/automations/[automationId]/bookings/bookings-client.tsx" && git commit -m "feat(dashboard): real airport/flight, driver note, ETA/distance/payment/refs in booking detail"`

> Note: if `payment_method` / `your_reference_*` are not on `BookingRow`/`BookingDetail`, do NOT change the shared types — read them by casting the fetched `detail` object to `Record<string, unknown>` locally. Keep changes inside `bookings-client.tsx`.

---

## WORKSTREAM C — Airport & Flights analytics (`src/lib/dashboard/insights*.ts`, `[metric]/route.ts`, `analytics-client.tsx`)

Add a new analytics metric + section reflecting the airport flow.

- [ ] **C1. Types.** In `src/lib/dashboard/insights-types.ts` add:
```ts
export interface AirportStats {
  airportBookings: number;
  totalBookings: number;
  airportSharePct: number;
  topAirports: { name: string; value: number }[];   // by airport code/name
  topTerminals: { name: string; value: number }[];   // "LHR T3" style
}
```

- [ ] **C2. Reducer + getter (TDD).** In `src/lib/dashboard/insights.ts` add `reduceAirportStats(bookings: { airport_json: unknown; pickup_time_mode: string | null }[]): AirportStats` (a booking counts as airport when `airport_json` has a `code`/`flightNumber` OR `pickup_time_mode === "airport"`; topAirports by `airport_json.code`/`name`; topTerminals by `${code} T${arrivalTerminal}` when present; both sorted desc). Add `getAirportStats(automationId, r, client?)` selecting `airport_json, pickup_time_mode` from `bookings` with the date window on `created_at`, mirroring `getRevenueSummary`. Write `tests/dashboard-airport-stats.test.ts` (mirror `reduceRevenue` tests in `tests/dashboard-insights.test.ts`): a fixture with 2 airport + 1 ground booking asserting `airportSharePct`, `topAirports[0]`, `topTerminals[0]`.

- [ ] **C3. Route.** In `[metric]/route.ts` import `getAirportStats` and add `airport: (id, r) => getAirportStats(id, r)` to `METRICS`. Update `tests/dashboard-7b-api.test.ts`: add `getAirportStats` to the `@/lib/dashboard/insights` mock and a case asserting `metric: "airport"` returns 200 with the stats.

- [ ] **C4. Section.** In `analytics-client.tsx` wire an `airport` metric (mirror the `revenue` wiring: add to `AllMetrics`, `emptyMetrics`, loading set, `Promise.allSettled` as `airportRes`, `setMetrics`). Render a new `SectionCard title="Airport & Flights"`: a `StatTile` grid (Airport bookings, Share %, plus the top airport) and a `HorizontalBarChart` of `topTerminals`. Import `AirportStats` from `@/lib/dashboard/insights-types`.

- [ ] **C5. Verify + commit.** `pnpm typecheck && pnpm vitest run tests/dashboard-airport-stats.test.ts tests/dashboard-7b-api.test.ts`. Commit each task per its message.

---

## Integration (controller)

After A/B/C: `pnpm typecheck`; `pnpm test` (expect only the pre-existing live-n8n integration failures); re-seed once; manual smoke optional. Then merge to `master`.
