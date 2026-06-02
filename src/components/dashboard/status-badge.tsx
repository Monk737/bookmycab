import type React from "react";

/**
 * Colored pill for a status string. Covers automation statuses,
 * booking statuses, and conversation outcomes. Color is always
 * paired with visible text so status is never conveyed by color alone.
 */

type Tone = "green" | "blue" | "indigo" | "amber" | "red" | "slate";

const TONE_CLASSES: Record<Tone, string> = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-700",
  indigo: "border-blue-600/40 bg-blue-600/10 text-blue-600",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  red: "border-red-500/40 bg-red-500/10 text-red-700",
  slate: "border-slate-300 bg-slate-100 text-slate-600",
};

const STATUS_TONE: Record<string, Tone> = {
  // automation statuses
  live: "green",
  building: "blue",
  uat: "amber",
  stopped: "slate",
  error: "red",
  // booking statuses
  confirmed: "blue",
  dispatched: "indigo",
  completed: "green",
  cancelled: "slate",
  no_show: "red",
  // conversation outcomes
  booked: "green",
  quoted: "blue",
  abandoned: "amber",
  managed: "indigo",
  unknown: "slate",
};

export function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const tone = STATUS_TONE[status.toLowerCase()] ?? "slate";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${TONE_CLASSES[tone]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-70"
      />
      {status}
    </span>
  );
}
