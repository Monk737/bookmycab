"use client";

import { useState } from "react";
import { LogShell } from "@/components/dashboard/voice/log-shell";
import { localDateKey, fmtDateTime, fmtPickup } from "@/lib/voice/format";
import { chatOutcomeLabel, channelLabel, bookingStatusLabel, formatDistance } from "@/lib/dashboard/chat-format";
import { ChatDetailDrawer, type ChatDrawerItem } from "./chat-detail-drawer";
import type { ChatConversationLogRow, ChatBookingLogRow } from "@/lib/dashboard/chat-log";

const OUTCOME_FILL: Record<string, string> = {
  booked: "bg-brut-lime",
  quoted: "bg-brut-cyan",
  managed: "bg-brut-violet",
  cancelled: "bg-brut-red",
  failed: "bg-brut-orange",
  abandoned: "bg-brut-orange",
  unknown: "bg-gray-300",
};

const STATUS_FILL: Record<string, string> = {
  confirmed: "bg-brut-lime",
  modified: "bg-brut-violet",
  dispatched: "bg-brut-cyan",
  completed: "bg-brut-violet",
  cancelled: "bg-brut-red",
  no_show: "bg-brut-orange",
};

/** One-line digest from the bot's card text: first content line, de-marked. */
function digest(summary: string | null): string | null {
  if (!summary) return null;
  const line = summary
    .split("\n")
    .map((l) => l.replace(/[*_`]/g, "").trim())
    .find((l) => l && !/^[━–—-]+$/.test(l));
  if (!line) return null;
  return line.length > 90 ? `${line.slice(0, 88)}…` : line;
}

/* ------------------------------- Conversations ---------------------------- */

function ConversationBody(c: ChatConversationLogRow) {
  const d = digest(c.summary);
  // `who` is name-or-handle; only show the number separately when a name exists,
  // so we never print the handle twice.
  const number = c.name && c.handle ? c.handle : null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className={`h-3 w-3 shrink-0 border-2 border-ink ${OUTCOME_FILL[c.outcome] ?? "bg-gray-300"}`} aria-hidden="true" />
        <span className="text-sm font-bold text-ink">{c.who}</span>
        {number ? <span className="font-mono text-[11px] tabular-nums text-gray-500">{number}</span> : null}
        <span className="border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink">
          {chatOutcomeLabel(c.outcome)}
        </span>
        <span className="font-mono text-[11px] text-gray-500">{channelLabel(c.channel)}</span>
        {c.viaVoice ? (
          <span className="inline-flex items-center border-2 border-ink bg-brut-cyan px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink">
            Voice note
          </span>
        ) : null}
        {c.bookingRef ? <span className="font-mono text-[11px] font-bold text-ink">#{c.bookingRef}</span> : null}
        <span className="ml-auto font-mono text-[11px] tabular-nums text-gray-500">{fmtDateTime(c.startedAt)}</span>
      </div>
      {d ? (
        <p className="truncate text-sm text-gray-600">{d}</p>
      ) : (
        <p className="text-sm text-gray-400">Summary pending, open to view the journey.</p>
      )}
    </div>
  );
}

/** Recent conversations — interaction-centric: every chat journey + its outcome. */
export function ConversationsLog({ items }: { items: ChatConversationLogRow[] }) {
  const [active, setActive] = useState<ChatDrawerItem | null>(null);
  return (
    <>
      <LogShell
        title="Conversations"
        accent="bg-brut-cyan"
        items={items}
        getKey={(c) => c.id}
        getDate={(c) => localDateKey(c.startedAt)}
        getSearchText={(c) =>
          [c.who, c.handle, chatOutcomeLabel(c.outcome), c.channel, c.bookingRef, c.summary].filter(Boolean).join(" ")
        }
        renderItem={(c) => (
          <button
            type="button"
            onClick={() => setActive({ kind: "conversation", row: c })}
            className="brut-focus block w-full text-left transition-colors hover:bg-brut-yellow/15"
          >
            <ConversationBody {...c} />
          </button>
        )}
        searchPlaceholder="Search name, number, outcome…"
        emptyLabel="No conversations on this day."
        noneLabel="No conversations yet. Each WhatsApp chat your bot handles, typed or by voice note, lands here."
      />
      <ChatDetailDrawer item={active} onClose={() => setActive(null)} />
    </>
  );
}

/* --------------------------------- Bookings ------------------------------- */

function BookingBody(b: ChatBookingLogRow) {
  const distanceLine = formatDistance(b.distance, b.distanceUnit);
  const bookingDigest = digest(b.summary);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className={`h-3 w-3 shrink-0 border-2 border-ink ${STATUS_FILL[b.status] ?? "bg-gray-300"}`} aria-hidden="true" />
        {b.ref ? <span className="font-mono text-xs font-bold tabular-nums text-ink">#{b.ref}</span> : null}
        <span className="border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink">
          {bookingStatusLabel(b.status)}
        </span>
        {b.passengerName ? <span className="text-sm font-bold text-ink">{b.passengerName}</span> : null}
        {b.fare ? <span className="font-mono text-xs font-bold tabular-nums text-ink">{b.fare}</span> : null}
        <span className="ml-auto font-mono text-[11px] tabular-nums text-gray-500">{fmtDateTime(b.createdAt)}</span>
      </div>
      <p className="truncate text-sm text-gray-600">
        {b.pickup ?? "—"} <span className="text-gray-400">&rarr;</span> {b.destination ?? "—"}
        {b.passengers != null ? <span className="text-gray-500"> &middot; {b.passengers} pax</span> : null}
        {b.vehicleType ? <span className="text-gray-500"> &middot; {b.vehicleType}</span> : null}
        {distanceLine ? <span className="text-gray-500"> &middot; {distanceLine}</span> : null}
        <span className="text-gray-500"> &middot; {b.pickupTimeMode === "asap" ? "ASAP" : b.pickupAt ? fmtPickup(b.pickupAt) : "time TBC"}</span>
      </p>
      {bookingDigest ? <p className="truncate text-sm text-gray-500">{bookingDigest}</p> : null}
    </div>
  );
}

/** Recent bookings — dispatch-centric: the rides the bot placed, with full detail. */
export function BookingsLog({ items }: { items: ChatBookingLogRow[] }) {
  const [active, setActive] = useState<ChatDrawerItem | null>(null);
  return (
    <>
      <LogShell
        title="Bookings"
        accent="bg-brut-lime"
        items={items}
        getKey={(b) => b.id}
        getDate={(b) => localDateKey(b.createdAt)}
        getSearchText={(b) =>
          [b.ref, b.status, b.passengerName, b.contact, b.pickup, b.destination, b.vehicleType, b.fare, b.summary]
            .filter(Boolean)
            .join(" ")
        }
        renderItem={(b) => (
          <button
            type="button"
            onClick={() => setActive({ kind: "booking", row: b })}
            className="brut-focus block w-full text-left transition-colors hover:bg-brut-yellow/15"
          >
            <BookingBody {...b} />
          </button>
        )}
        searchPlaceholder="Search ref, passenger, address…"
        emptyLabel="No bookings on this day."
        noneLabel="No bookings yet. Every ride your WhatsApp bot confirms, modifies or cancels lands here."
      />
      <ChatDetailDrawer item={active} onClose={() => setActive(null)} />
    </>
  );
}
