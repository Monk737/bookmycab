import type React from "react";

/**
 * Brutalist status pill, rectangular, 2px ink frame, flat semantic fill,
 * INK text, plus a dot. Covers automation statuses, booking statuses, and
 * conversation outcomes. Status is carried by fill + label + dot, never by
 * color alone (color-blind safe).
 */

type Tone = "lime" | "blue" | "violet" | "yellow" | "red" | "orange" | "gray";

const TONE_CLASSES: Record<Tone, string> = {
  lime: "bg-brut-lime text-ink",
  blue: "bg-brut-blue text-paper",
  violet: "bg-brut-violet text-ink",
  yellow: "bg-brut-yellow text-ink",
  red: "bg-brut-red text-ink",
  orange: "bg-brut-orange text-ink",
  gray: "bg-gray-200 text-ink",
};

const STATUS_TONE: Record<string, Tone> = {
  // automation statuses
  live: "lime",
  building: "orange",
  uat: "yellow",
  stopped: "gray",
  error: "red",
  // booking statuses
  confirmed: "blue",
  dispatched: "violet",
  completed: "lime",
  cancelled: "gray",
  no_show: "red",
  // conversation outcomes
  booked: "lime",
  quoted: "blue",
  abandoned: "yellow",
  managed: "violet",
  unknown: "gray",
};

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const tone = STATUS_TONE[status.toLowerCase()] ?? "gray";
  return (
    <span
      className={`inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${TONE_CLASSES[tone]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 flex-shrink-0 bg-current"
      />
      {status}
    </span>
  );
}
