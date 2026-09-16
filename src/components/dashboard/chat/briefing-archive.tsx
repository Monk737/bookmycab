"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import type { ChatBriefing } from "@/lib/chat/briefing";
import { ChatWeeklyBriefing } from "@/components/dashboard/chat/weekly-briefing";

const dmon = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function periodLabel(startYmd: string, endYmd: string): string {
  const s = new Date(`${startYmd}T00:00:00Z`);
  const e = new Date(`${endYmd}T00:00:00Z`);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  const sDay = s.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" });
  return sameMonth ? `${sDay}–${dmon(endYmd)}` : `${dmon(startYmd)} – ${dmon(endYmd)}`;
}

function ArchiveCard({ b, onOpen }: { b: ChatBriefing; onOpen: (trigger: HTMLButtonElement) => void }) {
  return (
    <article className="flex flex-col border-[3px] border-ink bg-paper p-4 shadow-brut">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] tabular-nums text-gray-500">
          {periodLabel(b.periodStart, b.periodEnd)}
        </p>
        <p className="font-mono text-[11px] font-bold tabular-nums text-ink">
          {b.metrics.totalConversations.toLocaleString("en-GB")} chats · {b.metrics.bookedPct}% booked
        </p>
      </div>
      <h3 className="mt-1.5 font-display text-base font-extrabold uppercase leading-tight tracking-tight text-ink">
        {b.headline}
      </h3>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-gray-700">{b.narrative}</p>
      <button
        type="button"
        onClick={(e) => onOpen(e.currentTarget)}
        aria-haspopup="dialog"
        className="brut-press brut-focus mt-4 inline-flex h-9 items-center justify-center self-start border-2 border-ink bg-brut-yellow px-4 text-xs font-bold uppercase tracking-[0.06em] text-ink shadow-brut-sm"
      >
        Read full briefing
      </button>
    </article>
  );
}

/**
 * "Earlier weeks" on the Chat briefing page. Each past week opens in a modal that
 * renders the same briefing card as the current week, so nothing is lost once a
 * newer briefing replaces it at the top.
 */
export function ChatBriefingArchive({ briefings }: { briefings: ChatBriefing[] }): React.JSX.Element {
  const [open, setOpen] = useState<ChatBriefing | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {briefings.map((b) => (
          <ArchiveCard
            key={b.periodStart}
            b={b}
            onOpen={(trigger) => {
              triggerRef.current = trigger;
              setOpen(b);
            }}
          />
        ))}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/60 p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Weekly AI Chat briefing, ${periodLabel(open.periodStart, open.periodEnd)}`}
            className="animate-msg-in w-full max-w-3xl"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="border-2 border-ink bg-paper px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] tabular-nums text-ink shadow-brut-sm">
                Earlier week · {periodLabel(open.periodStart, open.periodEnd)}
              </span>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(null)}
                aria-label="Close briefing"
                className="brut-press brut-focus inline-flex h-9 w-9 items-center justify-center border-2 border-ink bg-paper text-ink shadow-brut-sm hover:bg-ink hover:text-paper"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-4 w-4">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <ChatWeeklyBriefing briefing={open} />
          </div>
        </div>
      ) : null}
    </>
  );
}
