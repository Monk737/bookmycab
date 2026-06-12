import Link from "next/link";
import { VoiceGlyph } from "@/components/marketing/product-marks";

/**
 * Clickable "AI Voice Booking, live" card. Replaces the old muted / coming-soon
 * button: a hard-framed card with a breathing lime ring (live-glow) and a
 * pulsing LIVE dot, so it reads as active and inviting. `tone` adapts it for the
 * ink band (onDark) or a light surface (onLight).
 */
export function VoiceLiveCard({
  href = "/products",
  tone = "onLight",
  label = "AI Voice Booking",
  sub = "Live now, hear it in action",
  className = "",
}: {
  href?: string;
  tone?: "onDark" | "onLight";
  label?: string;
  sub?: string;
  className?: string;
}) {
  const onDark = tone === "onDark";
  return (
    <Link
      href={href}
      className={`live-glow brut-focus group inline-flex items-center gap-4 border-[3px] border-ink px-5 py-3.5 transition-transform duration-150 hover:-translate-y-0.5 ${
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
      <span aria-hidden="true" className="ml-1 shrink-0 text-ink transition-transform duration-150 group-hover:translate-x-1">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
