type CostRow = {
  /** What the line item is. */
  item: string;
  /** Who it is paid to. */
  paidTo: string;
  /** Cadence / nature of the charge. */
  cadence: string;
};

type Tone = "light" | "dark";

// §6.4 — external pass-through costs vs what is paid to BookMyCab.
const PASS_THROUGH: CostRow[] = [
  {
    item: "WhatsApp conversation fees",
    paidTo: "Your provider",
    cadence: "Per conversation",
  },
  {
    item: "Telegram, Messenger & Instagram volume",
    paidTo: "Your provider",
    cadence: "Per usage",
  },
  {
    item: "AI / LLM token usage",
    paidTo: "Your AI provider",
    cadence: "You bring your own key",
  },
  {
    item: "AutoCab, iCabbi or Cordic API subscription",
    paidTo: "Your dispatch provider",
    cadence: "Per your contract",
  },
];

const TO_BOOKMYCAB: CostRow[] = [
  {
    item: "BookMyCab subscription",
    paidTo: "BookMyCab",
    cadence: "Monthly",
  },
  {
    item: "BookMyCab setup fee",
    paidTo: "BookMyCab",
    cadence: "One-time",
  },
];

function CostList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: CostRow[];
  tone: Tone;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={
        "rounded-3xl border p-7 sm:p-8 " +
        (dark ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-paper")
      }
    >
      <h3
        className={
          "font-display text-xl font-semibold " +
          (dark ? "text-paper" : "text-ink")
        }
      >
        {title}
      </h3>
      <ul className="mt-5">
        {rows.map((row) => (
          <li
            key={row.item}
            className={
              "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t py-4 first:border-t-0 first:pt-0 " +
              (dark ? "border-gray-800" : "border-gray-200")
            }
          >
            <span
              className={"font-medium " + (dark ? "text-paper" : "text-ink")}
            >
              {row.item}
            </span>
            <span
              className={"text-sm " + (dark ? "text-gray-400" : "text-gray-500")}
            >
              {row.paidTo} · {row.cadence}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type TransparencySectionProps = {
  heading?: string;
  className?: string;
  /** "dark" renders the block for placement on an ink background. */
  tone?: Tone;
};

/**
 * "What you pay externally" — §6.4 cost transparency.
 *
 * Standalone Server Component so Home, Pricing and Channels can reuse it.
 * Splits costs into pass-through usage (paid to your own providers) and what
 * is paid to BookMyCab, so there are no hidden margins. `tone="dark"` adapts
 * the colours for an ink-background section.
 */
export function TransparencySection({
  heading = "What you pay externally",
  className = "",
  tone = "light",
}: TransparencySectionProps) {
  const dark = tone === "dark";
  return (
    <div className={className}>
      <h2
        className={
          "font-display text-3xl font-semibold tracking-tight sm:text-4xl " +
          (dark ? "text-paper" : "text-ink")
        }
      >
        {heading}
      </h2>
      <p
        className={
          "mt-4 max-w-2xl text-lg leading-relaxed " +
          (dark ? "text-gray-300" : "text-gray-600")
        }
      >
        No hidden margins. Channel and AI usage is billed by your own providers
        at cost. You only pay BookMyCab for the automation itself.
      </p>
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <CostList title="Paid to your own providers" rows={PASS_THROUGH} tone={tone} />
        <CostList title="Paid to BookMyCab" rows={TO_BOOKMYCAB} tone={tone} />
      </div>
      <p
        className={
          "mt-8 font-display text-xl font-semibold tracking-tight sm:text-2xl " +
          (dark ? "text-paper" : "text-ink")
        }
      >
        You bring your numbers. You own your customer base.
      </p>
    </div>
  );
}
