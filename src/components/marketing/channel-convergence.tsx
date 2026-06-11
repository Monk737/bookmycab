import { PRODUCTS, ProductIcon } from "@/components/marketing/product-marks";

/**
 * Convergence visual for the Products page: both products, the AI Voice Booking
 * Agent and the WhatsApp Chat Bot, funnel into one automation that keeps one
 * customer record. Distinct from the linear runtime flow on How It Works (this
 * one is two-into-one). Fully static and legible by default; the only motion is
 * the amber hub pulse, which prefers-reduced-motion disables. SVG funnel lines
 * use a non-scaling stroke so they stay crisp at any width.
 */
export function ChannelConvergence() {
  return (
    <div
      role="img"
      aria-label="Both products, the AI Voice Booking Agent and the WhatsApp Chat Bot, funnel into one automation, which keeps one customer record. A caller who phones one week and messages on WhatsApp the next is the same customer to you."
      className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] lg:gap-0"
    >
      {/* Products */}
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {PRODUCTS.map((p) => (
          <li
            key={p.name}
            className="brut-hover-lift flex h-20 items-center gap-4 border-[3px] border-ink bg-paper px-4 shadow-brut-sm"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center">
              <ProductIcon mark={p} />
            </span>
            <span className="font-display text-base font-extrabold uppercase leading-tight tracking-tight text-ink">
              {p.name}
            </span>
          </li>
        ))}
      </ul>

      {/* Funnel (desktop) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="hidden h-44 w-full lg:block"
      >
        {[28, 72].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2="50"
            stroke="var(--color-ink)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle cx="100" cy="50" r="3" fill="var(--color-brut-yellow)" stroke="var(--color-ink)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* Convergence arrow (mobile) */}
      <div aria-hidden="true" className="flex justify-center lg:hidden">
        <span className="flow-line-y h-8 w-1" />
      </div>

      {/* Hub */}
      <div className="border-[3px] border-ink bg-paper p-7 shadow-brut-xl sm:p-8">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-gray-600">
          <span className="status-pulse inline-block h-2.5 w-2.5 border border-ink bg-brut-yellow" />
          One automation
        </p>
        <p className="mt-4 font-display text-2xl font-extrabold uppercase leading-snug tracking-tight text-ink">
          One customer record, however they reach you.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">
          A caller who phones the booking line this week and sends a WhatsApp
          voice note the next is the same person to you, with one history, not
          two conversations to stitch together.
        </p>
      </div>
    </div>
  );
}
