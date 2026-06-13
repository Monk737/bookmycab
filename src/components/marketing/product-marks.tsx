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

/* AI-voice mark (64x64 space): a standard phone handset with an "AI" text badge
   pinned to the top-right corner. */
const PHONE_HANDSET =
  "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z";
const BADGE_FONT = "Arial,Helvetica,sans-serif";

/**
 * AI Voice app-icon mark on the taxi-yellow brutalist chip: the standard phone
 * handset with a pink "AI" badge attached top-right. Reads instantly as an
 * AI-handled phone call. Sits beside the WhatsApp mark with app-icon weight.
 */
export function VoiceGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="AI Voice agent">
      <rect x="2" y="2" width="60" height="60" rx="2" fill="#ffd400" stroke="#0a0a0a" strokeWidth="3.5" />
      <g transform="translate(0 18) scale(1.45)" fill="#ffffff" stroke="#0a0a0a" strokeWidth="2.1" strokeLinejoin="round">
        <path d={PHONE_HANDSET} />
      </g>
      <rect x="33" y="4" width="27" height="19" rx="4" fill="#ff7ac0" stroke="#0a0a0a" strokeWidth="2.6" />
      <text x="46.5" y="18.4" fontFamily={BADGE_FONT} fontWeight="900" fontSize="13.5" letterSpacing="0.5" fill="#0a0a0a" textAnchor="middle">AI</text>
    </svg>
  );
}

/**
 * Monochrome line version (inherits currentColor) for nav rails, section
 * headers and small/ink contexts. Phone outline + "AI" badge outline.
 */
export function VoiceMarkLine({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" className={className} role="img" aria-label="AI Voice agent">
      <g transform="translate(0 18) scale(1.45)" strokeWidth="2.1" strokeLinejoin="round">
        <path d={PHONE_HANDSET} />
      </g>
      <rect x="33" y="4" width="27" height="19" rx="4" strokeWidth="2.6" />
      <text x="46.5" y="18.4" fontFamily={BADGE_FONT} fontWeight="900" fontSize="13.5" letterSpacing="0.5" fill="currentColor" stroke="none" textAnchor="middle">AI</text>
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
