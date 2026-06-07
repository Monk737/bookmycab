"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const SEEN_KEY = "bmc-demo-welcome-seen";

/**
 * One-time welcome for the read-only demo. Orients a guarded prospect: this is
 * the real product on sample data, safe to explore. Dismissible (button or
 * Escape), never a hard gate, and remembered in localStorage so it shows once.
 * Renders nothing until mount, so SSR never flashes the overlay.
 */
export function DemoWelcome() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seen = false;
    }
    if (!seen) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    dismissRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-welcome-title"
        className="animate-msg-in w-full max-w-md border-[3px] border-ink bg-paper p-7 shadow-brut-xl sm:p-8"
      >
        <span className="inline-flex items-center gap-1.5 border-2 border-ink bg-brut-pink px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-ink">
          Read-only demo
        </span>
        <h2
          id="demo-welcome-title"
          className="mt-4 font-display text-2xl font-extrabold uppercase tracking-tight text-ink"
        >
          Have a look around
        </h2>
        <p className="mt-3 text-base leading-relaxed text-gray-700">
          This is a real BookMyCab dashboard running on sample data for a
          fictional cab firm. Open bookings, read conversations, check the
          analytics. Click anything you like: nothing you do is saved, and the
          data resets every 24 hours.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            ref={dismissRef}
            type="button"
            onClick={close}
            className="brut-press brut-focus inline-flex h-11 items-center justify-center border-[3px] border-ink bg-brut-yellow px-6 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut"
          >
            Start exploring
          </button>
          <Link
            href="/contact"
            onClick={close}
            className="brut-press brut-focus inline-flex h-11 items-center justify-center border-[3px] border-ink bg-paper px-6 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut"
          >
            Book a call
          </Link>
        </div>
      </div>
    </div>
  );
}
