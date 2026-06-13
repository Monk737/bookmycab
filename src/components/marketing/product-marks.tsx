import Image from "next/image";

/**
 * The two BookMyCab products, voice first. Shared single source of truth for the
 * marketing diagrams (product tiles, the runtime flow, the convergence visual)
 * so the channel pivot stays consistent everywhere.
 *
 * WhatsApp ships as its real app icon (colourful PNG). The AI Voice agent has no
 * logo, so it renders as a crafted brutalist phone-call mark (a handset with
 * voice waves) on a taxi-yellow chip, which reads unambiguously as a spoken
 * booking call and gives it the same app-icon weight beside the WhatsApp mark.
 */
export type ProductMark = {
  name: string;
  short: string;
  kind: "voice" | "image";
  src?: string;
  blurb: string;
};

export const PRODUCTS: ProductMark[] = [
  {
    name: "AI Voice Booking Agent",
    short: "AI Voice",
    kind: "voice",
    blurb: "Answers the phone, takes the booking by voice, quotes the fare.",
  },
  {
    name: "WhatsApp Chat Bot",
    short: "WhatsApp",
    kind: "image",
    src: "/social/whatsapp.png",
    blurb: "Takes bookings on WhatsApp by text or voice note.",
  },
];

/* Shared voice-call paths (24x24 space): a phone handset + two voice waves. */
const VOICE_HANDSET =
  "M15.7 13.5a8.5 8.5 0 0 1-3.2-3.2l1.4-1.4a1.1 1.1 0 0 0 .2-1.2L12.6 4.2a1.1 1.1 0 0 0-1.2-.6l-2.8.5A1.3 1.3 0 0 0 7.6 5.7 13.6 13.6 0 0 0 18.3 16.4a1.3 1.3 0 0 0 1.4-1l.5-2.8a1.1 1.1 0 0 0-.6-1.2l-3.5-1.3a1.1 1.1 0 0 0-1.2.2z";
const VOICE_WAVE_OUTER = "M16.3 2.6a6.2 6.2 0 0 1 5 5.1";
const VOICE_WAVE_INNER = "M15.4 6.4a2.7 2.7 0 0 1 2.2 2.4";

/**
 * Crafted brutalist phone-call mark on a taxi-yellow chip (the AI Voice icon).
 * A handset with voice waves, reads as a spoken booking call. Replaces the old
 * microphone/headset marks everywhere AI Voice is represented.
 */
export function VoiceGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="AI Voice agent">
      <rect x="1.5" y="1.5" width="45" height="45" fill="#ffd400" stroke="#0a0a0a" strokeWidth="3" />
      <g transform="translate(8.5 8.5) scale(1.3)" fill="none" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={VOICE_HANDSET} fill="#ffffff" />
        <path d={VOICE_WAVE_OUTER} />
        <path d={VOICE_WAVE_INNER} />
      </g>
    </svg>
  );
}

/**
 * Line-weight phone-call mark (inherits currentColor). Used in nav rails,
 * section headers and anywhere a stroked AI Voice icon is wanted.
 */
export function VoiceMarkLine({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="AI Voice agent"
    >
      <path d={VOICE_HANDSET} />
      <path d={VOICE_WAVE_OUTER} />
      <path d={VOICE_WAVE_INNER} />
    </svg>
  );
}

/** Renders a product's app-icon-weight mark: WhatsApp PNG or the voice glyph. */
export function ProductIcon({ mark, className = "h-14 w-14" }: { mark: ProductMark; className?: string }) {
  if (mark.kind === "voice") return <VoiceGlyph className={className} />;
  return (
    <Image src={mark.src as string} alt={mark.name} width={512} height={512} className={`${className} object-contain`} />
  );
}
