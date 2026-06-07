import Image from "next/image";

/**
 * Convergence visual for the Channels page: five inbound channels funnel into
 * one automation and one customer record. Distinct from the linear runtime
 * flow on How It Works (this one is many-to-one). Fully static and legible by
 * default; the only motion is the amber hub pulse, which prefers-reduced-motion
 * disables. SVG funnel lines use a non-scaling stroke so they stay crisp at any
 * width, and are hidden on mobile in favour of a stacked layout.
 *
 * The channels are shown as their real app icons. The icons are colourful and
 * self-contained, so each sits on a light paper tile with its name beside it.
 */

const CHANNELS = [
  { name: "WhatsApp", src: "/social/whatsapp.png" },
  { name: "Telegram", src: "/social/telegram.png" },
  { name: "Messenger", src: "/social/messenger.png" },
  { name: "Instagram", src: "/social/instagram.png" },
  { name: "Web chat widget", src: "/social/web-widget.png" },
];

export function ChannelConvergence() {
  return (
    <div
      role="img"
      aria-label="Five channels (WhatsApp, Telegram, Messenger, Instagram and a web chat widget) all funnel into one automation, which keeps one customer record. A customer who messages on Instagram one week and WhatsApp the next is the same customer to you."
      className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] lg:gap-0"
    >
      {/* Channels */}
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {CHANNELS.map((c) => (
          <li
            key={c.name}
            className="brut-hover-lift flex h-20 items-center gap-4 border-[3px] border-ink bg-paper px-4 shadow-brut-sm"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center">
              <Image
                src={c.src}
                alt={c.name}
                width={512}
                height={512}
                className="h-14 w-14 object-contain"
              />
            </span>
            <span className="font-display text-base font-extrabold uppercase tracking-tight text-ink">
              {c.name}
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
        {[10, 30, 50, 70, 90].map((y) => (
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
          A customer who sends an Instagram DM this week and a WhatsApp voice
          note the next is the same person to you, with one history, not two
          conversations to stitch together.
        </p>
      </div>
    </div>
  );
}
