"use client";

import { useEffect, useState } from "react";
import { fmtDateTime, fmtPickup } from "@/lib/voice/format";
import { chatOutcomeLabel, channelLabel, bookingStatusLabel, formatDistance } from "@/lib/dashboard/chat-format";
import type { ChatConversationLogRow, ChatBookingLogRow } from "@/lib/dashboard/chat-log";

const OUTCOME_BADGE: Record<string, string> = {
  booked: "bg-brut-lime",
  quoted: "bg-brut-cyan",
  managed: "bg-brut-violet",
  cancelled: "bg-brut-red",
  failed: "bg-brut-orange",
  abandoned: "bg-brut-orange",
  unknown: "bg-gray-200",
};

const STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-brut-lime",
  modified: "bg-brut-violet",
  dispatched: "bg-brut-cyan",
  completed: "bg-brut-violet",
  cancelled: "bg-brut-red",
  no_show: "bg-brut-orange",
};

export type ChatDrawerItem =
  | { kind: "conversation"; row: ChatConversationLogRow }
  | { kind: "booking"; row: ChatBookingLogRow };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4 border-b-2 border-gray-100 py-2 last:border-0">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] text-gray-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

/** Plain-language summary of what the customer did this journey (emojis + line
 *  breaks preserved). Not a transcript of text messages. */
function SummaryCard({ text }: { text: string }) {
  return (
    <div className="border-[3px] border-ink bg-brut-yellow/20 p-3">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink/70">What the customer did</p>
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink">{text}</pre>
    </div>
  );
}

/** Pulls a signed URL for the conversation's voice note and renders a player. */
function VoiceNotePlayer({ conversationId }: { conversationId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/chat/voice-note/${conversationId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { url: string }) => {
        if (!alive) return;
        setUrl(d.url);
        setState("ready");
      })
      .catch(() => {
        if (alive) setState("error");
      });
    return () => {
      alive = false;
    };
  }, [conversationId]);

  return (
    <div className="border-[3px] border-ink bg-brut-cyan/15 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink/70">Voice note</p>
      {state === "loading" ? (
        <p className="text-sm text-gray-500">Loading the recording…</p>
      ) : state === "error" || !url ? (
        <p className="text-sm text-gray-500">The voice note isn&rsquo;t available.</p>
      ) : (
        <audio controls preload="none" src={url} className="w-full">
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}

/** Right-side drawer showing the full detail of a conversation or a booking. */
export function ChatDetailDrawer({ item, onClose }: { item: ChatDrawerItem | null; onClose: () => void }) {
  useEffect(() => {
    if (!item) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);

  if (!item) return null;

  const isConv = item.kind === "conversation";
  const badge = isConv ? item.row.outcome : item.row.status;
  const badgeCls = isConv ? OUTCOME_BADGE[badge] ?? "bg-gray-200" : STATUS_BADGE[badge] ?? "bg-gray-200";
  const badgeLabel = isConv ? chatOutcomeLabel(badge) : bookingStatusLabel(badge);
  const title = isConv ? item.row.who : item.row.passengerName || item.row.contact || "Booking";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={isConv ? "Conversation detail" : "Booking detail"}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l-[3px] border-ink bg-paper shadow-brut">
        <header className="flex items-start justify-between gap-3 border-b-[3px] border-ink px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${badgeCls}`}>
                {badgeLabel}
              </span>
              <span className="truncate text-sm font-bold text-ink">{title}</span>
              {isConv && item.row.viaVoice ? (
                <span className="inline-flex items-center gap-1 border-2 border-ink bg-brut-cyan px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink">
                  Voice note
                </span>
              ) : null}
            </div>
            <p className="mt-1 font-mono text-xs tabular-nums text-gray-500">
              {isConv ? fmtDateTime(item.row.startedAt) : fmtDateTime(item.row.createdAt)}
              {!isConv && item.row.ref ? <span className="ml-2 font-bold text-ink">#{item.row.ref}</span> : null}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="brut-press brut-focus shrink-0 border-2 border-ink bg-paper px-2.5 py-1.5 text-sm font-bold text-ink">
            &times;
          </button>
        </header>

        <div className="scrollbar-ink flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {isConv ? (
            <>
              <dl>
                <Field label="Outcome" value={chatOutcomeLabel(item.row.outcome)} />
                <Field label="Channel" value={channelLabel(item.row.channel)} />
                <Field label="Customer" value={item.row.name ?? "—"} />
                <Field label="WhatsApp" value={item.row.handle ? <span className="font-mono">{item.row.handle}</span> : "—"} />
                <Field label="Voice note" value={item.row.viaVoice ? "Yes" : "No"} />
                <Field label="Started" value={fmtDateTime(item.row.startedAt)} />
                <Field label="Ended" value={item.row.endedAt ? fmtDateTime(item.row.endedAt) : "—"} />
                <Field label="Booking" value={item.row.bookingRef ? <span className="font-mono font-bold">#{item.row.bookingRef}</span> : "—"} />
              </dl>
              {item.row.summary ? <SummaryCard text={item.row.summary} /> : (
                <p className="py-4 text-center text-sm text-gray-500">No summary captured for this conversation yet.</p>
              )}
              {item.row.hasVoiceNote ? <VoiceNotePlayer conversationId={item.row.id} /> : null}
            </>
          ) : (
            <>
              <dl>
                <Field label="Reference" value={item.row.ref ? <span className="font-mono font-bold">#{item.row.ref}</span> : "—"} />
                <Field label="Status" value={bookingStatusLabel(item.row.status)} />
                <Field label="Passenger" value={item.row.passengerName ?? "—"} />
                <Field label="Contact" value={item.row.contact ? <span className="font-mono">{item.row.contact}</span> : "—"} />
                <Field label="Passengers" value={item.row.passengers != null ? `${item.row.passengers}` : "—"} />
                <Field label="Vehicle" value={item.row.vehicleType ?? "—"} />
                <Field label="Pickup" value={item.row.pickup ?? "—"} />
                <Field label="Destination" value={item.row.destination ?? "—"} />
                <Field label="Distance" value={formatDistance(item.row.distance, item.row.distanceUnit) ?? "—"} />
                <Field
                  label="Pickup time"
                  value={item.row.pickupTimeMode === "asap" ? "ASAP" : item.row.pickupAt ? fmtPickup(item.row.pickupAt) : "—"}
                />
                <Field label="Fare" value={item.row.fare ?? "—"} />
                <Field label="Driver note" value={item.row.driverNote ?? "—"} />
                <Field label="Booked" value={fmtDateTime(item.row.createdAt)} />
                {item.row.updatedAt && item.row.updatedAt !== item.row.createdAt ? (
                  <Field label="Updated" value={fmtDateTime(item.row.updatedAt)} />
                ) : null}
              </dl>
              {item.row.summary ? <SummaryCard text={item.row.summary} /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
