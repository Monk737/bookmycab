import type { ReactNode } from "react";

/**
 * The runtime story as a diagram: a customer message enters on any channel,
 * the automation reads it (voice included), quotes and confirms, and the job
 * lands in the firm's dispatch system. Fully static and legible by default;
 * the amber sweep on the connectors conveys flow and is suppressed under
 * prefers-reduced-motion. No JS, no reveal gating.
 */

const CHANNELS = ["WhatsApp", "Telegram", "Messenger", "Instagram", "Web widget"];

const AUTOMATION_STEPS = [
  "Reads what the customer wants",
  "Transcribes voice notes",
  "Quotes the fare, picks the vehicle",
  "Confirms the booking",
];

const DISPATCH = [
  { name: "AutoCab", live: true },
  { name: "iCabbi", live: false },
  { name: "Cordic", live: false },
];

export function ChannelFlow() {
  return (
    <div
      role="img"
      aria-label="A customer message arrives on WhatsApp, Telegram, Messenger, Instagram or a web widget. The automation reads the request, transcribes voice notes, quotes the fare, picks the vehicle and confirms the booking. The confirmed job is written into the firm's dispatch system: AutoCab, with iCabbi and Cordic coming soon."
      className="flex flex-col items-stretch lg:flex-row lg:items-stretch"
    >
      {/* Stage 1 — Channels */}
      <Stage label="Customer messages on" className="lg:flex-1">
        <ul className="space-y-2">
          {CHANNELS.map((c) => (
            <li
              key={c}
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 font-medium text-ink"
            >
              {c}
            </li>
          ))}
        </ul>
      </Stage>

      <Connector />

      {/* Stage 2 — Automation */}
      <Stage label="Your automation" featured className="lg:flex-[1.1]">
        <ol className="space-y-3">
          {AUTOMATION_STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold tabular-nums text-accent-ink">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-ink">{step}</span>
            </li>
          ))}
        </ol>
      </Stage>

      <Connector />

      {/* Stage 3 — Dispatch */}
      <Stage label="Lands in your dispatch" className="lg:flex-1">
        <ul className="space-y-2">
          {DISPATCH.map((d) => (
            <li
              key={d.name}
              className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5"
            >
              <span className="font-medium text-ink">{d.name}</span>
              {d.live ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                  <CheckIcon />
                  Live
                </span>
              ) : (
                <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  Soon
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-ink">
          <span className="status-pulse inline-block h-2 w-2 rounded-full bg-accent" />
          Job dispatched
        </p>
      </Stage>
    </div>
  );
}

function Stage({
  label,
  children,
  featured = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  featured?: boolean;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-3xl border p-6 sm:p-7 " +
        (featured
          ? "border-ink bg-paper shadow-[0_30px_60px_-30px_rgba(10,10,10,0.3)]"
          : "border-gray-200 bg-paper") +
        " " +
        className
      }
    >
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center py-1.5 lg:w-14 lg:py-0"
    >
      {/* vertical on mobile, horizontal on desktop */}
      <span className="flow-line-y h-9 w-0.5 rounded-full lg:hidden" />
      <span className="flow-line-x hidden h-0.5 w-full rounded-full lg:block" />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
