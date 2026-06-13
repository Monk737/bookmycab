import Image from "next/image";

/**
 * The two BookMyCab products, voice first. Shared single source of truth for the
 * marketing diagrams (product tiles, the runtime flow, the convergence visual)
 * so the channel pivot stays consistent everywhere.
 *
 * WhatsApp ships as its real app icon (colourful PNG). The AI Voice agent has no
 * logo, so it renders as a crafted brutalist headset-agent avatar (a person
 * wearing a headset with a mic boom) on a taxi-yellow chip, which gives it the
 * same app-icon weight beside the WhatsApp mark.
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

/**
 * Crafted brutalist headset-agent avatar on a taxi-yellow chip (the AI Voice
 * icon). A person wearing a headset with a mic boom, the agent that answers the
 * phone. Replaces the old microphone mark everywhere AI Voice is represented.
 */
export function VoiceGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="AI Voice agent">
      <rect x="1.5" y="1.5" width="45" height="45" fill="#ffd400" stroke="#0a0a0a" strokeWidth="3" />
      {/* shoulders / bust */}
      <path d="M11 42a13 13 0 0 1 26 0" fill="#ffffff" stroke="#0a0a0a" strokeWidth="3" strokeLinejoin="miter" />
      {/* head */}
      <circle cx="24" cy="20" r="6.5" fill="#ffffff" stroke="#0a0a0a" strokeWidth="3" />
      {/* headband over the head */}
      <path d="M12 21a12 12 0 0 1 24 0" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="square" />
      {/* ear cups */}
      <rect x="9.5" y="20" width="5" height="8" rx="1.5" fill="#0a0a0a" />
      <rect x="33.5" y="20" width="5" height="8" rx="1.5" fill="#0a0a0a" />
      {/* mic boom curving to the mouth */}
      <path d="M34 28v2a5 5 0 0 1-5 5h-3" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="square" />
      <circle cx="24" cy="35" r="1.6" fill="#0a0a0a" />
    </svg>
  );
}

/**
 * Line-weight version of the headset-agent avatar (inherits currentColor). Used
 * in nav rails, section headers and anywhere a stroked icon is wanted in place
 * of the old microphone/waveform glyph.
 */
export function VoiceMarkLine({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      className={className}
      role="img"
      aria-label="AI Voice agent"
    >
      {/* headband */}
      <path d="M5 12a7 7 0 0 1 14 0" />
      {/* ear cups */}
      <path d="M4 12.5h2.2v4H4zM17.8 12.5H20v4h-2.2z" />
      {/* head */}
      <circle cx="12" cy="10.5" r="3.2" />
      {/* shoulders */}
      <path d="M6 21a6 6 0 0 1 12 0" />
      {/* mic boom to the mouth */}
      <path d="M18.5 16.5v.8a3 3 0 0 1-3 3H13" />
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
