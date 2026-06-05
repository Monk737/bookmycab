import Link from "next/link";
import type React from "react";

/**
 * Persistent demo-mode signal. Read-only is a STATUS, so the band is ink
 * (unmistakable, like a test-mode banner) and reserves Dispatch Amber for the
 * single action it offers: booking a call. Shown on every demo route.
 */
export function DemoBanner(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-ink px-4 py-2.5 text-sm text-paper"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-600 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-paper">
        <EyeIcon />
        Read-only demo
      </span>
      <span className="text-gray-300">
        This is a real dashboard on sample data. Click anything; nothing is
        saved, and it resets every 24 hours.
      </span>
      <Link
        href="/contact"
        className="rounded-full bg-accent px-3.5 py-1 text-xs font-semibold text-accent-ink transition-colors duration-150 hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      >
        Book a call
      </Link>
    </div>
  );
}

function EyeIcon(): React.JSX.Element {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
