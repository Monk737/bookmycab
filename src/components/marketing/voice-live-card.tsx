import { VoiceGlyph } from "@/components/marketing/product-marks";

/**
 * "AI Voice Booking, live" showcase card. Static (not a link): a hard-framed
 * card with a breathing lime ring (live-glow), a pulsing LIVE dot, and an
 * "On Request" ribbon — the agent is demonstrated on a discovery call rather
 * than self-served. `tone` adapts it for the ink band (onDark) or a light
 * surface (onLight).
 */
export function VoiceLiveCard({
  tone = "onLight",
  label = "AI Voice Booking",
  sub = "Live now, hear it in action",
  className = "",
}: {
  tone?: "onDark" | "onLight";
  label?: string;
  sub?: string;
  className?: string;
}) {
  const onDark = tone === "onDark";
  return (
    <span
      className={`live-glow relative inline-flex items-center gap-4 border-[3px] border-ink px-5 py-3.5 ${
        onDark ? "bg-paper" : "bg-brut-yellow"
      } ${className}`}
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
        <VoiceGlyph className="h-11 w-11" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="status-pulse inline-block h-2 w-2 border border-ink bg-brut-lime" aria-hidden="true" />
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink">Live now</span>
        </span>
        <span className="mt-0.5 block font-display text-lg font-extrabold uppercase leading-none tracking-tight text-ink">
          {label}
        </span>
        <span className="mt-1 block text-xs font-medium text-ink/70">{sub}</span>
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-2.5 -top-2.5 z-10 rotate-3 border-2 border-ink bg-brut-pink px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink shadow-brut-sm"
      >
        On Request
      </span>
    </span>
  );
}
