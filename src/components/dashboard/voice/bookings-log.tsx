"use client";

import { useState } from "react";
import { LogShell } from "./log-shell";
import { TranscriptDrawer, type DrawerCall } from "./transcript-drawer";
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

// The drawer badge keys off call outcomes; map the booking action onto one.
const ACTION_OUTCOME: Record<string, string> = {
  confirmed: "booked",
  modified: "modified",
  cancelled: "cancelled",
  completed: "booked",
  no_show: "abandoned",
};

function BookingBody(b: VoiceBookingEventRow) {
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
        {b.callId ? (
          <span className="inline-flex shrink-0 items-center gap-1 border-2 border-ink bg-brut-cyan px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />Call
          </span>
        ) : null}
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

/**
 * Bookings — every create / modify / cancel the AI Voice agent made. Like Recent
 * calls, clicking a booking that came from a call opens that call's summary,
 * transcript and recording. Bookings with no linked call stay read-only.
 */
export function BookingsLog({ events }: { events: VoiceBookingEventRow[] }) {
  const [active, setActive] = useState<DrawerCall | null>(null);

  const open = (b: VoiceBookingEventRow) => {
    if (!b.callId) return;
    setActive({
      id: b.callId,
      caller: b.caller_number,
      callerName: b.passenger_name,
      outcome: ACTION_OUTCOME[b.action] ?? b.action,
      startedAt: b.callStartedAt ?? b.occurred_at,
    });
  };

  return (
    <>
      <LogShell
        title="Bookings"
        items={events}
        getKey={(b) => b.id}
        getDate={(b) => localDateKey(b.occurred_at)}
        getSearchText={(b) =>
          [b.booking_ref, ACTION_LABEL[b.action] ?? b.action, b.pickup, b.destination, b.passenger_name, b.vehicle_type, b.fare]
            .filter(Boolean)
            .join(" ")
        }
        renderItem={(b) =>
          b.callId ? (
            <button
              type="button"
              onClick={() => open(b)}
              className="brut-focus block w-full text-left transition-colors hover:bg-brut-yellow/15"
            >
              <BookingBody {...b} />
            </button>
          ) : (
            <BookingBody {...b} />
          )
        }
        searchPlaceholder="Search ref, address, passenger…"
        emptyLabel="No booking activity on this day."
        noneLabel="No bookings yet. Each booking your agent confirms, modifies or cancels lands here."
      />
      <TranscriptDrawer call={active} onClose={() => setActive(null)} />
    </>
  );
}
