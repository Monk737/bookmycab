import Image from "next/image";

/**
 * The five inbound channels as their real app icons. The icons are colourful
 * and self-contained, so each sits on a light paper tile (never a dark tile)
 * with the channel name beside it, so it reads at a glance on any background.
 *
 * `variant` only tunes the tile framing for the surface it sits on:
 *   - "onDark"  for an ink section (heavier shadow so the paper tile pops).
 *   - "onLight" for the paper/canvas page (standard brutalist tile).
 */
const CHANNELS = [
  { name: "WhatsApp", src: "/social/whatsapp.png" },
  { name: "Telegram", src: "/social/telegram.png" },
  { name: "Messenger", src: "/social/messenger.png" },
  { name: "Instagram", src: "/social/instagram.png" },
  { name: "Web chat widget", src: "/social/web-widget.png" },
];

export function ChannelLogos({
  variant = "onLight",
  className = "",
}: {
  variant?: "onDark" | "onLight";
  className?: string;
}) {
  const onDark = variant === "onDark";
  // onDark: no card — transparent, white labels (sits on an ink section).
  // onLight: brutalist paper tile with ink labels.
  const tile = onDark
    ? "px-1"
    : "brut-hover-lift border-[3px] border-ink bg-paper px-4 shadow-brut-sm";
  const label = onDark ? "text-paper" : "text-ink";

  return (
    <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`}>
      {CHANNELS.map((c) => (
        <li key={c.name}>
          <div className={`flex h-20 items-center gap-4 ${tile}`}>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center">
              <Image
                src={c.src}
                alt={c.name}
                width={512}
                height={512}
                className="h-14 w-14 object-contain"
              />
            </span>
            <span className={`font-display text-base font-extrabold uppercase tracking-tight ${label}`}>
              {c.name}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
