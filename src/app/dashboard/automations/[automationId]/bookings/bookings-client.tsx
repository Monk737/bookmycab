"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/dashboard/data-table";
import type { Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ChannelIcon } from "@/components/dashboard/channel-icon";
import { SlideOver } from "@/components/dashboard/slide-over";
import { FilterBar } from "@/components/dashboard/filter-bar";
import type { FilterField } from "@/components/dashboard/filter-bar";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import {
  formatCurrency,
  formatDateTime,
  addressOneLine,
  truncateId,
} from "@/lib/dashboard/format";
import type { BookingRow, BookingDetail, ChannelType } from "@/lib/dashboard/types";

const VALID_CHANNEL_TYPES: ChannelType[] = [
  "whatsapp",
  "telegram",
  "messenger",
  "instagram",
  "widget",
];

function isChannelType(v: string | null): v is ChannelType {
  return v !== null && (VALID_CHANNEL_TYPES as string[]).includes(v);
}

const FILTER_FIELDS: FilterField[] = [
  { key: "from", label: "From", type: "date" },
  { key: "to", label: "To", type: "date" },
  {
    key: "channel",
    label: "Channel",
    type: "select",
    options: [
      { value: "whatsapp", label: "WhatsApp" },
      { value: "telegram", label: "Telegram" },
      { value: "messenger", label: "Messenger" },
      { value: "instagram", label: "Instagram" },
      { value: "widget", label: "Widget" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "confirmed", label: "Confirmed" },
      { value: "dispatched", label: "Dispatched" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
      { value: "no_show", label: "No show" },
    ],
  },
  {
    key: "mode",
    label: "Mode",
    type: "select",
    options: [
      { value: "asap", label: "ASAP" },
      { value: "scheduled", label: "Scheduled" },
      { value: "airport", label: "Airport" },
    ],
  },
  { key: "search", label: "Customer / postcode", type: "search" },
];

const BOOKING_STATUSES: BookingRow["status"][] = [
  "confirmed",
  "dispatched",
  "completed",
  "cancelled",
  "no_show",
];

function mapRealtimeRow(r: unknown): BookingRow | null {
  if (!r || typeof r !== "object") return null;
  const row = r as Record<string, unknown>;
  if (!row.id || typeof row.id !== "string") return null;
  return {
    id: row.id,
    dispatchRef: (row.dispatch_ref as string) ?? null,
    pickupAtUtc: (row.pickup_at_utc as string) ?? null,
    passengerName: (row.passenger_name as string) ?? null,
    customerHandle: (row.customer_handle as string) ?? null,
    channelType: (row.channel_type as string) ?? null,
    pickupAddress: row.pickup_address ?? null,
    destinationAddress: row.destination_address ?? null,
    vehicleType: (row.vehicle_type as string) ?? null,
    passengerCount: (row.passenger_count as number) ?? null,
    fare: (row.fare as number) ?? null,
    currency: (row.currency as string) ?? "GBP",
    status: (row.status as BookingRow["status"]) ?? "confirmed",
    pickupTimeMode: (row.pickup_time_mode as string) ?? null,
  };
}

interface AirportData {
  code?: string;
  name?: string;
  flightNumber?: string;
  arrivalTerminal?: string;
  arrivalTimeUtc?: string;
  bufferMinutes?: number;
  pickupAtUtc?: string;
  flightObject?: {
    airline?: string;
    airlineCode?: string;
    departureAirport?: string;
    departureAirportCode?: string;
  };
  flightSummary?: string;
  [key: string]: unknown;
}

interface RawDispatchData {
  distanceMiles?: number;
  journeyTime?: string;
  tariff?: string;
  bookingType?: string;
  [key: string]: unknown;
}

const VEHICLE_LABELS: Record<string, string> = {
  saloon: "Saloon",
  estate: "Estate",
  mpv: "MPV (6-seater)",
  "8seater": "8-seater",
  wheelchair: "Wheelchair (WAV)",
};

export function BookingsClient({
  orgId,
  automationId,
  initialRows,
  total,
  filterValues,
  canEdit,
}: {
  orgId: string;
  automationId: string;
  initialRows: BookingRow[];
  total: number;
  filterValues: Record<string, string>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<BookingRow[]>(initialRows);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Status update state
  const [newStatus, setNewStatus] = useState<BookingRow["status"]>("confirmed");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Realtime: prepend new booking inserts
  useRealtimeChannel(
    {
      channelName: `bookings:automation_id=${automationId}`,
      table: "bookings",
      event: "INSERT",
      filter: `automation_id=eq.${automationId}`,
    },
    useCallback((payload: unknown) => {
      const mapped = mapRealtimeRow(payload);
      if (mapped) setRows((prev) => [mapped, ...prev]);
    }, []),
  );

  // Pagination
  const page = Number(filterValues.page ?? "1") || 1;
  const limit = Number(filterValues.limit ?? "50") || 50;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function goToPage(p: number) {
    const params = new URLSearchParams(filterValues);
    params.set("page", String(p));
    router.replace(`?${params.toString()}`);
  }

  // SlideOver open handler
  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setStatusError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/automations/${automationId}/bookings/${id}`,
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as { booking: BookingDetail };
      setDetail(json.booking);
      setNewStatus(json.booking.status);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load booking");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setStatusError(null);
  }

  async function handleStatusUpdate() {
    if (!selectedId || !detail) return;
    setStatusUpdating(true);
    setStatusError(null);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/automations/${automationId}/bookings/${selectedId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      router.refresh();
      closeDetail();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setStatusUpdating(false);
    }
  }

  // Table columns
  const columns: Column<BookingRow>[] = [
    {
      key: "id",
      header: "Booking ID",
      render: (row) => (
        <span className="font-mono text-[11px] text-gray-600">{truncateId(row.id)}</span>
      ),
    },
    {
      key: "dispatchRef",
      header: "Dispatch Ref",
      render: (row) => (
        <span className="font-mono text-[11px] text-gray-600">{row.dispatchRef ?? "·"}</span>
      ),
    },
    {
      key: "pickupAt",
      header: "Date / Time",
      render: (row) => (
        <span className="whitespace-nowrap text-sm">
          {formatDateTime(row.pickupAtUtc, "Europe/London")}
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <span className="font-medium text-ink">{row.passengerName ?? "·"}</span>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (row) =>
        isChannelType(row.channelType) ? (
          <ChannelIcon type={row.channelType} />
        ) : (
          <span className="text-gray-400 text-sm">{row.channelType ?? "·"}</span>
        ),
    },
    {
      key: "pickup",
      header: "Pickup",
      render: (row) => (
        <span className="max-w-[160px] truncate block text-sm">
          {addressOneLine(row.pickupAddress)}
        </span>
      ),
    },
    {
      key: "destination",
      header: "Destination",
      render: (row) => (
        <span className="max-w-[160px] truncate block text-sm">
          {addressOneLine(row.destinationAddress)}
        </span>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      render: (row) => <span className="text-sm">{row.vehicleType ?? "·"}</span>,
    },
    {
      key: "pax",
      header: "Pax",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (row) => <span>{row.passengerCount ?? "·"}</span>,
    },
    {
      key: "fare",
      header: "Fare",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
      render: (row) => <span>{formatCurrency(row.fare, row.currency)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <button
          type="button"
          onClick={() => openDetail(row.id)}
          className="font-bold text-ink hover:underline text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink "
        >
          View Details
        </button>
      ),
    },
  ];

  // Airport section renderer
  function renderAirportSection(airportJson: unknown) {
    if (!airportJson || typeof airportJson !== "object") return null;
    const apt = airportJson as AirportData;

    type AptField = { label: string; value: string | undefined | null };
    const fromCode = apt.flightObject?.departureAirportCode
      ? `${apt.flightObject.departureAirport ?? ""} (${apt.flightObject.departureAirportCode})`
      : apt.flightObject?.departureAirport;

    const fields: AptField[] = [
      { label: "Airport", value: apt.name },
      { label: "Flight", value: apt.flightNumber },
      { label: "Airline", value: apt.flightObject?.airline },
      { label: "From", value: fromCode },
      { label: "Terminal", value: apt.arrivalTerminal },
      {
        label: "Arrival",
        value: apt.arrivalTimeUtc
          ? formatDateTime(apt.arrivalTimeUtc, "Europe/London")
          : undefined,
      },
      {
        label: "Driver ready",
        value: apt.bufferMinutes != null
          ? `${apt.bufferMinutes} min after arrival`
          : undefined,
      },
      {
        label: "Pickup",
        value: apt.pickupAtUtc
          ? formatDateTime(apt.pickupAtUtc, "Europe/London")
          : undefined,
      },
    ];

    const present = fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== "");
    if (present.length === 0) return null;
    return (
      <section className="mt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
          Airport Details
        </h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {present.map((f) => (
            <div key={f.label}>
              <dt className="text-gray-500 text-[11px] uppercase tracking-wide">{f.label}</dt>
              <dd className="text-ink font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  // Trip facts block renderer (B2)
  function renderTripFacts(det: BookingDetail) {
    const raw = det.rawDispatchJson as RawDispatchData | null | undefined;
    const detAny = det as unknown as Record<string, unknown>;

    type Fact = { label: string; value: string | null | undefined };
    const facts: Fact[] = [
      {
        label: "ETA",
        value: raw?.journeyTime ?? null,
      },
      {
        label: "Distance",
        value: raw?.distanceMiles != null ? `${raw.distanceMiles} mi` : null,
      },
      {
        label: "Payment",
        value: (detAny.paymentMethod as string | null | undefined) ??
          (detAny.payment_method as string | null | undefined) ?? null,
      },
      {
        label: "Dispatch ref",
        value: det.dispatchRef ?? null,
      },
      {
        label: "Ref 1",
        value: (detAny.yourReference1 as string | null | undefined) ??
          (detAny.your_reference_1 as string | null | undefined) ?? null,
      },
      {
        label: "Ref 2",
        value: (detAny.yourReference2 as string | null | undefined) ??
          (detAny.your_reference_2 as string | null | undefined) ?? null,
      },
      {
        label: "Ref 3",
        value: (detAny.yourReference3 as string | null | undefined) ??
          (detAny.your_reference_3 as string | null | undefined) ?? null,
      },
    ];

    const present = facts.filter((f) => f.value !== null && f.value !== undefined && f.value !== "");
    if (present.length === 0) return null;
    return (
      <section className="mt-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
          Trip Facts
        </h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {present.map((f) => (
            <div key={f.label}>
              <dt className="text-gray-500 text-[11px] uppercase tracking-wide">{f.label}</dt>
              <dd className="text-ink font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  // Detail address block
  function renderAddressBlock(label: string, addr: unknown) {
    if (!addr || typeof addr !== "object") return null;
    const a = addr as Record<string, unknown>;
    const oneLiner = addressOneLine(addr);
    const rawFields = Object.entries(a)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
      .map(([k, v]) => (
        <div key={k}>
          <dt className="text-gray-500 text-[11px] uppercase tracking-wide">{k}</dt>
          <dd className="text-ink text-sm">{String(v)}</dd>
        </div>
      ));
    return (
      <div className="mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
          {label}
        </h4>
        <p className="text-sm text-ink mb-1">{oneLiner}</p>
        {rawFields.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">{rawFields}</dl>
        )}
      </div>
    );
  }

  const csvHref = `/api/orgs/${orgId}/automations/${automationId}/bookings/export?${new URLSearchParams(filterValues).toString()}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-ink">Bookings</h1>
        <a
          href={csvHref}
          download
          className="inline-flex items-center gap-1.5 border-[3px] border-ink bg-paper px-3 py-2 text-sm font-medium text-gray-700 shadow-brut-sm transition-colors duration-150 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink cursor-pointer"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download CSV
        </a>
      </div>

      {/* Filters */}
      <FilterBar fields={FILTER_FIELDS} values={filterValues} />

      {/* Record count */}
      <p className="text-sm text-gray-500">
        {total === 0 ? "No bookings found." : `Showing page ${page} of ${totalPages} (${total} total)`}
      </p>

      {/* Table */}
      <DataTable<BookingRow>
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        emptyMessage="No bookings match the current filters."
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="border-[3px] border-ink bg-paper px-3 py-2 text-sm text-gray-700 shadow-brut-sm transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink cursor-pointer"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            className="border-[3px] border-ink bg-paper px-3 py-2 text-sm text-gray-700 shadow-brut-sm transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink cursor-pointer"
          >
            Next
          </button>
        </div>
      )}

      {/* Booking Detail SlideOver */}
      <SlideOver
        open={selectedId !== null}
        onClose={closeDetail}
        title={`Booking ${truncateId(selectedId)}`}
      >
        {detailLoading && (
          <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
        )}
        {detailError && (
          <p className="text-sm text-brut-red-deep py-4">{detailError}</p>
        )}
        {detail && !detailLoading && (
          <div className="space-y-4 text-sm">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <StatusBadge status={detail.status} />
              {detail.pickupTimeMode && (
                <span className=" border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {detail.pickupTimeMode}
                </span>
              )}
            </div>

            {/* Pickup date/time */}
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                Pickup Time
              </dt>
              <dd className="mt-0.5 text-ink">
                {formatDateTime(detail.pickupAtUtc, "Europe/London")}
              </dd>
            </div>

            {/* Addresses */}
            {renderAddressBlock("Pickup Address", detail.pickupAddress)}
            {renderAddressBlock("Destination Address", detail.destinationAddress)}

            {/* Passenger details */}
            <section>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                Passenger
              </h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500">Name</dt>
                  <dd className="text-ink font-medium">{detail.passengerName ?? "·"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500">Contact</dt>
                  <dd className="text-ink font-medium">{detail.customerHandle ?? "·"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500">Passengers</dt>
                  <dd className="text-ink font-medium">{detail.passengerCount ?? "·"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500">Vehicle</dt>
                  <dd className="text-ink font-medium">
                    {detail.vehicleType
                      ? (VEHICLE_LABELS[detail.vehicleType.toLowerCase()] ?? detail.vehicleType)
                      : "·"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500">Fare</dt>
                  <dd className="text-ink font-medium">
                    {formatCurrency(detail.fare, detail.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500">Dispatch Ref</dt>
                  <dd className="font-mono text-[11px] text-gray-600">
                    {detail.dispatchRef ?? "·"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Driver note (B3) */}
            {detail.driverNote && typeof detail.driverNote === "string" && detail.driverNote.trim() !== "" && (
              <section className=" border border-ink bg-brut-yellow/30 px-3 py-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink mb-1">
                  Driver note
                </h4>
                <p className="text-sm text-gray-700">{detail.driverNote}</p>
              </section>
            )}

            {/* Airport section (B1) */}
            {renderAirportSection(detail.airportJson)}

            {/* Trip facts: ETA / distance / payment / refs (B2) */}
            {renderTripFacts(detail)}

            {/* Conversation link */}
            {detail.conversationId && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Conversation
                </h4>
                <a
                  href={`/dashboard/automations/${automationId}/conversations?id=${detail.conversationId}`}
                  className="font-bold text-ink hover:underline text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink "
                >
                  View transcript &rarr;
                </a>
                <span className="ml-2 font-mono text-[11px] text-gray-400">
                  {truncateId(detail.conversationId)}
                </span>
              </div>
            )}

            {/* Debug raw JSON */}
            <details className="group">
              <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors duration-150">
                Raw dispatch data (debug)
              </summary>
              <pre className="mt-2 overflow-x-auto  bg-gray-50 border border-gray-200 p-3 text-[11px] text-gray-600 max-h-48">
                {JSON.stringify(detail.rawDispatchJson, null, 2)}
              </pre>
            </details>

            {/* Status update (canEdit only) */}
            {canEdit && (
              <section className="border-t border-gray-200 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Update Status
                </h4>
                <div className="flex items-center gap-3">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as BookingRow["status"])}
                    className="cursor-pointer border-[3px] border-ink bg-paper px-3 py-2 text-sm text-ink shadow-brut-sm outline-none transition-shadow duration-150 hover:border-gray-300 focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    {BOOKING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={statusUpdating || newStatus === detail.status}
                    onClick={handleStatusUpdate}
                    className="border-2 border-ink bg-brut-yellow shadow-brut-sm px-4 py-2 text-sm font-medium text-ink shadow-brut-sm transition-colors duration-150 hover:bg-ink hover:text-paper disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink cursor-pointer"
                  >
                    {statusUpdating ? "Saving…" : "Update status"}
                  </button>
                </div>
                {statusError && (
                  <p className="mt-2 text-sm text-brut-red-deep">{statusError}</p>
                )}
              </section>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
