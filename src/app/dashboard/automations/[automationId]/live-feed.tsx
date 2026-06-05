"use client";

import { useState } from "react";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { formatDateTime, formatCurrency } from "@/lib/dashboard/format";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { BookingRow } from "@/lib/dashboard/types";

const MAX_ROWS = 20;

function mapRawRow(raw: unknown): BookingRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" ? r.id : String(r.id ?? ""),
    dispatchRef: typeof r.dispatch_ref === "string" ? r.dispatch_ref : null,
    pickupAtUtc: typeof r.pickup_at_utc === "string" ? r.pickup_at_utc : null,
    passengerName: typeof r.passenger_name === "string" ? r.passenger_name : null,
    customerHandle: typeof r.customer_handle === "string" ? r.customer_handle : null,
    channelType: typeof r.channel_type === "string" ? r.channel_type : null,
    pickupAddress: r.pickup_address ?? null,
    destinationAddress: r.destination_address ?? null,
    vehicleType: typeof r.vehicle_type === "string" ? r.vehicle_type : null,
    passengerCount: typeof r.passenger_count === "number" ? r.passenger_count : null,
    fare: typeof r.fare === "number" ? r.fare : null,
    currency: typeof r.currency === "string" ? r.currency : "GBP",
    status: (typeof r.status === "string" ? r.status : "confirmed") as BookingRow["status"],
    pickupTimeMode: typeof r.pickup_time_mode === "string" ? r.pickup_time_mode : null,
  };
}

export function LiveFeed({
  automationId,
  initialRows,
}: {
  automationId: string;
  initialRows: BookingRow[];
}): React.JSX.Element {
  const [rows, setRows] = useState<BookingRow[]>(initialRows.slice(0, MAX_ROWS));

  useRealtimeChannel(
    {
      channelName: `bookings:automation_id=${automationId}`,
      table: "bookings",
      event: "INSERT",
      filter: `automation_id=eq.${automationId}`,
    },
    (raw) => {
      const mapped = mapRawRow(raw);
      if (!mapped) return;
      setRows((prev) => [mapped, ...prev].slice(0, MAX_ROWS));
    },
  );

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header row with Live indicator */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-semibold text-gray-700">Bookings</span>
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-600">
            Live
          </span>
        </span>
      </div>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
              Ref
            </th>
            <th className="px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
              Passenger
            </th>
            <th className="hidden px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
              Pickup
            </th>
            <th className="hidden px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500 md:table-cell">
              Fare
            </th>
            <th className="px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center text-sm text-gray-400"
              >
                No bookings yet — new bookings will appear here in real time.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/40 transition-colors duration-150 hover:bg-blue-50/50"
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {row.dispatchRef ?? row.id.slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {row.passengerName ?? row.customerHandle ?? "—"}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-gray-600 sm:table-cell">
                  {formatDateTime(row.pickupAtUtc, "Europe/London")}
                </td>
                <td className="hidden px-4 py-3 tabular-nums text-gray-700 md:table-cell">
                  {formatCurrency(row.fare, row.currency)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
