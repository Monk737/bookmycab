type CostRow = {
  /** What the line item is. */
  item: string;
  /** Who it is paid to. */
  paidTo: string;
  /** Cadence / nature of the charge. */
  cadence: string;
};

// §6.4 — external pass-through costs vs what is paid to CabbyBot.
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

const TO_CABBYBOT: CostRow[] = [
  {
    item: "CabbyBot subscription",
    paidTo: "CabbyBot",
    cadence: "Monthly",
  },
  {
    item: "CabbyBot setup fee",
    paidTo: "CabbyBot",
    cadence: "One-time",
  },
];

function CostList({ title, rows }: { title: string; rows: CostRow[] }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-paper p-7 sm:p-8">
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      <ul className="mt-5">
        {rows.map((row) => (
          <li
            key={row.item}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-gray-200 py-4 first:border-t-0 first:pt-0"
          >
            <span className="font-medium text-ink">{row.item}</span>
            <span className="text-sm text-gray-500">
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
};

/**
 * "What you pay externally" — §6.4 cost transparency.
 *
 * Standalone Server Component so Home and Channels can reuse it. Splits costs
 * into pass-through usage (paid to your own providers) and what is paid to
 * CabbyBot, so there are no hidden margins.
 */
export function TransparencySection({
  heading = "What you pay externally",
  className = "",
}: TransparencySectionProps) {
  return (
    <div className={className}>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        {heading}
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
        No hidden margins. Channel and AI usage is billed by your own providers
        at cost — you only pay CabbyBot for the automation itself.
      </p>
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <CostList title="Paid to your own providers" rows={PASS_THROUGH} />
        <CostList title="Paid to CabbyBot" rows={TO_CABBYBOT} />
      </div>
    </div>
  );
}
