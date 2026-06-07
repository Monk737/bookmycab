import type { ReactNode } from "react";
import Image from "next/image";

/**
 * The runtime story as a diagram: a customer message enters on any channel,
 * the automation reads it (voice included), quotes and confirms, and the job
 * lands in the firm's dispatch system. Fully static and legible by default;
 * the amber sweep on the connectors conveys flow and is suppressed under
 * prefers-reduced-motion. No JS, no reveal gating.
 */

// Channel app icons. Colourful and self-contained, so each sits on a light
// paper tile with its name beside it.
const CHANNELS = [
  { name: "WhatsApp", src: "/social/whatsapp.png" },
  { name: "Telegram", src: "/social/telegram.png" },
  { name: "Messenger", src: "/social/messenger.png" },
  { name: "Instagram", src: "/social/instagram.png" },
  { name: "Web chat widget", src: "/social/web-widget.png" },
];

const AUTOMATION_STEPS = [
  "Reads what the customer wants",
  "Transcribes voice notes",
  "Quotes the fare, picks the vehicle",
  "Confirms the booking",
];

// Dispatch wordmark logos. Dark marks on transparent, so each sits on paper.
const DISPATCH = [
  { name: "AutoCab", src: "/dispatch/autocab.png", live: true },
  { name: "iCabbi", src: "/dispatch/icabbi.png", live: true },
  { name: "Cordic", src: "/dispatch/cordic.png", live: true },
];

export function ChannelFlow() {
  return (
    <div
      role="img"
      aria-label="A customer message arrives on WhatsApp, Telegram, Messenger, Instagram or a web widget. The automation reads the request, transcribes voice notes, quotes the fare, picks the vehicle and confirms the booking. The confirmed job is written into the firm's dispatch system: AutoCab, iCabbi or Cordic, all supported."
      className="flex flex-col items-stretch lg:flex-row lg:items-stretch"
    >
      {/* Stage 1, Channels */}
      <Stage label="Customer messages on" className="lg:flex-1">
        <ul className="space-y-3">
          {CHANNELS.map((c) => (
            <li
              key={c.name}
              className="brut-hover-lift flex h-16 items-center gap-3.5 border-[3px] border-ink bg-paper px-4 shadow-brut-sm"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                <Image
                  src={c.src}
                  alt={c.name}
                  width={512}
                  height={512}
                  className="h-11 w-11 object-contain"
                />
              </span>
              <span className="truncate font-display text-lg font-extrabold uppercase tracking-tight text-ink">
                {c.name}
              </span>
            </li>
          ))}
        </ul>
      </Stage>

      <Connector />

      {/* Stage 2, Automation */}
      <Stage label="Your automation" featured className="lg:flex-[1.1]">
        <ol className="space-y-4">
          {AUTOMATION_STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-brut-yellow text-sm font-bold tabular-nums text-ink">
                {i + 1}
              </span>
              <span className="text-base font-medium leading-snug text-ink sm:text-lg">{step}</span>
            </li>
          ))}
        </ol>
      </Stage>

      <Connector />

      {/* Stage 3, Dispatch */}
      <Stage label="Lands in your dispatch" className="lg:flex-1">
        <ul className="space-y-3">
          {DISPATCH.map((d) => (
            <li
              key={d.name}
              className="flex items-center justify-between gap-3 border-2 border-ink bg-paper px-4 py-4"
            >
              <Image
                src={d.src}
                alt={d.name}
                width={767}
                height={325}
                className="h-12 w-auto max-w-[62%] object-contain object-left"
              />
              {d.live ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 border-2 border-ink bg-brut-lime px-2.5 py-1 text-xs font-bold uppercase text-ink">
                  <CheckIcon />
                  Live
                </span>
              ) : (
                <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-gray-600">
                  Soon
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-5 flex items-center gap-2 text-base font-bold text-ink">
          <span className="status-pulse inline-block h-2.5 w-2.5 border border-ink bg-brut-violet" />
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
        "border-[3px] border-ink bg-paper p-7 sm:p-8 " +
        (featured ? "shadow-brut-lg" : "shadow-brut") +
        " " +
        className
      }
    >
      <p className="mb-5 text-sm font-bold uppercase tracking-[0.08em] text-gray-600">
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
      <span className="flow-line-y h-9 w-1 lg:hidden" />
      <span className="flow-line-x hidden h-1 w-full lg:block" />
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
