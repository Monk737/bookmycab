"use client";

import { LogShell } from "./log-shell";
import { fmtDateTime, fmtPickup, localDateKey } from "@/lib/voice/format";
import type { VoiceBookingEventRow } from "@/lib/voice/booking-events";

const ACTION_STYLE: Record<string, string> = {
  confirmed: "bg-brut-lime",
  modified: "bg-brut-cyan",
  cancelled: "bg-brut-pink",
  completed: "bg-brut-lime",
  no_show: "bg-gray-100",
};

const ACTION_LABEL: Record<string, string> = {
  confirmed: "Booked",
  modified: "Modified",
  cancelled: "Cancelled",
  completed: "Completed",
  no_show: "No show",
};

function BookingRow(b: VoiceBookingEventRow) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs tabular-nums text-gray-500">{fmtDateTime(b.occurred_at)}</span>
        <span className="font-mono text-xs font-bold tabular-nums text-ink">#{b.booking_ref}</span>
        <span
          className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${
            ACTION_STYLE[b.action] ?? "bg-gray-100"
          }`}
        >
          {ACTION_LABEL[b.action] ?? b.action}
        </span>
        <span className="font-mono text-xs tabular-nums text-gray-500">{fmtPickup(b.pickup_time)}</span>
        {b.fare ? <span className="font-mono text-xs font-bold tabular-nums text-ink">{b.fare}</span> : null}
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-gray-700">
        {b.pickup ?? "—"} <span className="text-gray-400">&rarr;</span> {b.destination ?? "—"}
        {b.passenger_name ? <span className="text-gray-500"> &middot; {b.passenger_name}</span> : null}
        {b.passengers != null ? <span className="text-gray-500"> &middot; {b.passengers} pax</span> : null}
        {b.bags != null ? <span className="text-gray-500"> &middot; {b.bags} bags</span> : null}
        {b.vehicle_type ? <span className="text-gray-500"> &middot; {b.vehicle_type}</span> : null}
      </p>
    </div>
  );
}

export function BookingsLog({ events }: { events: VoiceBookingEventRow[] }) {
  return (
    <LogShell
      title="Bookings"
      items={events}
      getKey={(b) => b.id}
      getDate={(b) => localDateKey(b.occurred_at)}
      renderItem={BookingRow}
      emptyLabel="No booking activity on this day."
      noneLabel="No bookings yet. Each booking your agent confirms, modifies or cancels lands here."
    />
  );
}
