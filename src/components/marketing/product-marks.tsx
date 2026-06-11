import Image from "next/image";

/**
 * The two BookMyCab products, voice first. Shared single source of truth for the
 * marketing diagrams (product tiles, the runtime flow, the convergence visual)
 * so the channel pivot stays consistent everywhere.
 *
 * WhatsApp ships as its real app icon (colourful PNG). The AI Voice agent has no
 * logo, so it renders as a crafted brutalist microphone glyph on a taxi-yellow
 * chip, which gives it the same app-icon weight beside the WhatsApp mark.
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

/** Crafted brutalist microphone mark on a taxi-yellow chip (the AI Voice icon). */
export function VoiceGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="AI Voice">
      <rect x="1.5" y="1.5" width="45" height="45" fill="#ffd400" stroke="#0a0a0a" strokeWidth="3" />
      {/* mic capsule */}
      <rect x="19" y="11" width="10" height="17" rx="5" fill="#ffffff" stroke="#0a0a0a" strokeWidth="3" />
      {/* cradle */}
      <path d="M14 23a10 10 0 0 0 20 0" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="square" />
      {/* stem + base */}
      <path d="M24 33v5M19 38h10" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="square" />
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
