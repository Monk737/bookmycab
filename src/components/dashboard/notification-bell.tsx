"use client";

import { useEffect, useRef, useState } from "react";

export type NotifKind =
  | "booking_new"
  | "booking_modified"
  | "call_transferred"
  | "call_new"
  | "tenant_new"
  | "automation_new"
  | "payment_failed"
  | "generic";

export interface NotifItem {
  id: string;
  kind: NotifKind;
  title: string;
  detail?: string;
  /** ISO timestamp. */
  ts: string;
  read: boolean;
}

const KIND_ACCENT: Record<NotifKind, string> = {
  booking_new: "bg-brut-lime",
  booking_modified: "bg-brut-yellow",
  call_transferred: "bg-brut-violet",
  call_new: "bg-brut-cyan",
  tenant_new: "bg-brut-lime",
  automation_new: "bg-brut-cyan",
  payment_failed: "bg-brut-red",
  generic: "bg-gray-300",
};

function KindIcon({ kind }: { kind: NotifKind }) {
  const common = "h-4 w-4";
  switch (kind) {
    case "booking_new":
    case "booking_modified":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className={common} aria-hidden="true"><path d="M5 7h14v13H5zM5 4h14M9 3v3M15 3v3M8 12h8M8 16h5" /></svg>;
    case "call_transferred":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className={common} aria-hidden="true"><path d="M4 5l6 2-1 3 3 3 3-1 2 6-3 2C8 22 2 16 2 8z" /><path d="M16 8h6M19 5l3 3-3 3" /></svg>;
    case "call_new":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className={common} aria-hidden="true"><path d="M4 5l6 2-1 3 3 3 3-1 2 6-3 2C8 22 2 16 2 8z" /></svg>;
    case "tenant_new":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className={common} aria-hidden="true"><path d="M3 21V8l7-4 7 4v13M3 21h18M9 21v-5h4v5" /></svg>;
    case "automation_new":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className={common} aria-hidden="true"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M8 8h8v8H8z" /></svg>;
    case "payment_failed":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className={common} aria-hidden="true"><path d="M3 6h18v12H3zM3 10h18M7 15h3" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className={common} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>;
  }
}

/** Compact relative time ("now", "3m", "2h", "5d"). */
function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "now";
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/**
 * Presentational notification bell + dropdown panel. Brutalist styling; the
 * caller supplies the live `items` (realtime for tenants, polled for admin) and
 * the mark-all-read handler. `onDark` flips the trigger styling for the ink
 * mobile header. Beautiful by default: unread badge with a pulse, accent dots
 * per kind, and a slide-in on the newest entries.
 */
export function NotificationBell({
  items,
  onMarkAllRead,
  onDark = false,
}: {
  items: NotifItem[];
  onMarkAllRead: () => void;
  onDark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => !i.read).length;

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread > 0) onMarkAllRead();
        }}
        className={`relative flex h-9 w-9 cursor-pointer items-center justify-center border-[3px] transition-colors ${
          onDark
            ? "border-paper bg-ink text-paper hover:bg-gray-800"
            : "border-ink bg-paper text-ink shadow-brut-sm hover:bg-canvas"
        } outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className="h-[18px] w-[18px]" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7M10 20a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center border-2 border-ink bg-brut-red px-0.5 text-[10px] font-bold leading-none text-paper">
            <span className="status-pulse absolute inset-0 bg-brut-red" aria-hidden="true" />
            <span className="relative">{unread > 9 ? "9+" : unread}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] border-[3px] border-ink bg-paper text-ink shadow-brut-xl">
          <div className="flex items-center justify-between border-b-[3px] border-ink bg-ink px-4 py-2.5">
            <span className="font-display text-xs font-extrabold uppercase tracking-[0.06em] text-paper">Notifications</span>
            {items.some((i) => !i.read) ? (
              <button type="button" onClick={onMarkAllRead} className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.04em] text-gray-300 underline-offset-2 hover:text-paper hover:underline">
                Mark all read
              </button>
            ) : (
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">All caught up</span>
            )}
          </div>

          <ul className="max-h-[60vh] divide-y-2 divide-gray-100 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-gray-500">
                Nothing yet. New activity shows up here in real time.
              </li>
            ) : (
              items.slice(0, 30).map((it, i) => (
                <li
                  key={it.id}
                  className={`flex gap-3 px-4 py-3 ${i < 2 ? "animate-msg-in" : ""} ${it.read ? "bg-paper" : "bg-canvas"}`}
                >
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border-2 border-ink text-ink ${KIND_ACCENT[it.kind]}`}>
                    <KindIcon kind={it.kind} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-ink">{it.title}</span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-gray-500">{ago(it.ts)}</span>
                    </p>
                    {it.detail && <p className="mt-0.5 truncate text-xs text-gray-600">{it.detail}</p>}
                  </div>
                  {!it.read && <span className="mt-1 h-2 w-2 shrink-0 border border-ink bg-brut-red" aria-label="unread" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
