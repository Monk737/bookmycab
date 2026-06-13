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

/* Shared geometry for the AI-voice-call mark (64x64 space): a phone handset
   (the call), a voice waveform (the spoken booking) and a 4-point AI sparkle. */
const PHONE_HANDSET =
  "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z";
const VOICE_BARS = "M40 30v8M46 24v20M52 28v12";
// 4-point sparkle (the "AI" cue) centred at 50,13 r6.5.
const AI_SPARKLE =
  "M50 6.5C52.08 10.92 52.08 10.92 56.5 13C52.08 15.08 52.08 15.08 50 19.5C47.92 15.08 47.92 15.08 43.5 13C47.92 10.92 47.92 10.92 50 6.5Z";
const PINK = "#ff7ac0";

/**
 * AI Voice app-icon mark on the taxi-yellow brutalist chip: a phone handset,
 * a voice waveform and an AI sparkle, reads unmistakably as a spoken booking
 * call handled by AI. Sits beside the WhatsApp mark with equal app-icon weight.
 */
export function VoiceGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="AI Voice agent">
      <rect x="2" y="2" width="60" height="60" rx="2" fill="#ffd400" stroke="#0a0a0a" strokeWidth="3.5" />
      <g transform="translate(2 16) scale(1.5)" fill="#ffffff" stroke="#0a0a0a" strokeWidth="2.1" strokeLinejoin="round">
        <path d={PHONE_HANDSET} />
      </g>
      <path d={VOICE_BARS} fill="none" stroke="#0a0a0a" strokeWidth="3.6" strokeLinecap="round" />
      <path d={AI_SPARKLE} fill={PINK} stroke="#0a0a0a" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Monochrome line version (inherits currentColor) for nav rails, section
 * headers and small/ink contexts. Same phone + waveform + sparkle composition.
 */
export function VoiceMarkLine({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" className={className} role="img" aria-label="AI Voice agent">
      <g transform="translate(2 16) scale(1.5)" strokeWidth="2.1" strokeLinejoin="round">
        <path d={PHONE_HANDSET} />
      </g>
      <path d={VOICE_BARS} strokeWidth="3.6" strokeLinecap="round" />
      <path d={AI_SPARKLE} fill="currentColor" strokeWidth="0" />
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
