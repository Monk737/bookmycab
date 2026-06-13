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

/* Shared geometry for the AI-voice mark (64x64 space): a right-facing head
   profile, a neural-network "brain" node graph, and voice waves at the mouth. */
const HEAD_PROFILE =
  "M21 58 C18 49 15.5 41 15.5 32 C15.5 21 21 12.5 31 11.3 C39 10.4 45.5 13.6 47.5 20.5 L47.5 24 L55 30 L47.5 32.6 L50.2 37 L45 39 L45 45 L40 48 L33.5 48 L33.5 58";
// Neural-net nodes (cx,cy) and the edges (index pairs) that mesh them.
const BRAIN_NODES: Array<[number, number]> = [
  [28, 19], [21, 25], [35, 24], [24.5, 32], [33, 32], [28, 26.5],
];
const BRAIN_EDGES: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 5], [1, 3], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5], [4, 5], [1, 4], [2, 3],
];
const VOICE_WAVES = ["M55 32a8 8 0 0 1 0 11", "M59.5 29.5a13 13 0 0 1 0 16"];

const CYAN = "#5fd9e8";
const PINK = "#ec38a6";
const PINK_SOFT = "#ff7ac0";

/** Inner artwork (head + brain mesh + waves) drawn in the 64x64 space. */
function VoiceArt({ mono = false }: { mono?: boolean }) {
  const head = mono ? "currentColor" : CYAN;
  const node = mono ? "currentColor" : PINK;
  const wave = mono ? "currentColor" : CYAN;
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* head profile */}
      <path d={HEAD_PROFILE} stroke={head} strokeWidth={3.4} />
      {/* neural-net glow ring */}
      {!mono && <circle cx="28" cy="26" r="11" fill={PINK_SOFT} opacity="0.22" />}
      <circle cx="28" cy="26" r="11" stroke={node} strokeWidth={mono ? 2 : 2.6} />
      {/* edges */}
      {BRAIN_EDGES.map(([a, b], i) => (
        <line key={i} x1={BRAIN_NODES[a][0]} y1={BRAIN_NODES[a][1]} x2={BRAIN_NODES[b][0]} y2={BRAIN_NODES[b][1]} stroke={node} strokeWidth={mono ? 1.4 : 1.8} opacity={mono ? 0.7 : 0.9} />
      ))}
      {/* nodes */}
      {BRAIN_NODES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === 5 ? 2.4 : 1.9} fill={node} stroke="none" />
      ))}
      {/* voice waves */}
      {VOICE_WAVES.map((d, i) => (
        <path key={i} d={d} stroke={wave} strokeWidth={3.2} />
      ))}
    </g>
  );
}

/**
 * AI Voice app-icon mark: a profile head with a neural-network brain and voice
 * waves (cyan + magenta), framed as a brutalist app icon to sit beside the
 * WhatsApp mark. Reads as "an AI that speaks". Replaces the old phone/headset.
 */
export function VoiceGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="AI Voice agent">
      <rect x="2" y="2" width="60" height="60" rx="2" fill="#ffffff" stroke="#0a0a0a" strokeWidth="3.5" />
      <VoiceArt />
    </svg>
  );
}

/**
 * Monochrome line version (inherits currentColor) for nav rails, section
 * headers and small/ink contexts where the colour icon would be too busy.
 */
export function VoiceMarkLine({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" className={className} role="img" aria-label="AI Voice agent">
      <VoiceArt mono />
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
