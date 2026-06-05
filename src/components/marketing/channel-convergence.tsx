/**
 * Convergence visual for the Channels page: five inbound channels funnel into
 * one automation and one customer record. Distinct from the linear runtime
 * flow on How It Works (this one is many-to-one). Fully static and legible by
 * default; the only motion is the amber hub pulse, which prefers-reduced-motion
 * disables. SVG funnel lines use a non-scaling stroke so they stay crisp at any
 * width, and are hidden on mobile in favour of a stacked layout.
 */

const CHANNELS = ["WhatsApp", "Telegram", "Messenger", "Instagram", "Web widget"];

export function ChannelConvergence() {
  return (
    <div
      role="img"
      aria-label="Five channels (WhatsApp, Telegram, Messenger, Instagram and a web widget) all funnel into one automation, which keeps one customer record. A customer who messages on Instagram one week and WhatsApp the next is the same customer to you."
      className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] lg:gap-0"
    >
      {/* Channels */}
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        {CHANNELS.map((c) => (
          <li
            key={c}
            className="rounded-xl border border-gray-200 bg-paper px-4 py-3 font-display text-lg font-semibold text-ink shadow-[0_1px_2px_rgba(10,10,10,0.05)]"
          >
            {c}
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
            stroke="var(--color-gray-300)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <circle cx="100" cy="50" r="2.5" fill="var(--color-accent)" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* Convergence arrow (mobile) */}
      <div aria-hidden="true" className="flex justify-center lg:hidden">
        <span className="flow-line-y h-8 w-0.5 rounded-full" />
      </div>

      {/* Hub */}
      <div className="rounded-3xl border border-ink bg-paper p-7 shadow-[0_30px_60px_-30px_rgba(10,10,10,0.3)] sm:p-8">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
          <span className="status-pulse inline-block h-2 w-2 rounded-full bg-accent" />
          One automation
        </p>
        <p className="mt-4 font-display text-2xl font-semibold leading-snug tracking-tight text-ink">
          One customer record, however they reach you.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-gray-600">
          A customer who sends an Instagram DM this week and a WhatsApp voice
          note the next is the same person to you, with one history, not two
          conversations to stitch together.
        </p>
      </div>
    </div>
  );
}
