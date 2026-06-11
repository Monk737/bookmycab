import { PRODUCTS, ProductIcon } from "@/components/marketing/product-marks";

/**
 * The two BookMyCab products as app-icon tiles, voice first: the AI Voice
 * Booking Agent and the WhatsApp Chat Bot. Each mark sits on a light paper tile
 * with the product name beside it, so it reads at a glance on any background.
 *
 * `variant` only tunes the tile framing for the surface it sits on:
 *   - "onDark"  for an ink section (no card, white labels).
 *   - "onLight" for the paper/canvas page (standard brutalist tile).
 */
export function ChannelLogos({
  variant = "onLight",
  className = "",
}: {
  variant?: "onDark" | "onLight";
  className?: string;
}) {
  const onDark = variant === "onDark";
  const tile = onDark
    ? "px-1"
    : "brut-hover-lift border-[3px] border-ink bg-paper px-4 shadow-brut-sm";
  const label = onDark ? "text-paper" : "text-ink";

  return (
    <ul className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${className}`}>
      {PRODUCTS.map((p) => (
        <li key={p.name}>
          <div className={`flex h-20 items-center gap-4 ${tile}`}>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center">
              <ProductIcon mark={p} />
            </span>
            <span className={`font-display text-base font-extrabold uppercase leading-tight tracking-tight ${label}`}>
              {p.name}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
