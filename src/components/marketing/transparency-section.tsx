type CostRow = {
  /** What the line item is. */
  item: string;
  /** Who it is paid to. */
  paidTo: string;
  /** Cadence / nature of the charge. */
  cadence: string;
};

type Tone = "light" | "dark";

// §6.4, external pass-through costs vs what is paid to BookMyCab.
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
    item: "AI / chat & voice processing",
    paidTo: "Your AI provider",
    cadence: "Your own key",
  },
  {
    item: "AutoCab, iCabbi or Cordic API",
    paidTo: "Your dispatch provider",
    cadence: "Your contract",
  },
];

const TO_BOOKMYCAB: CostRow[] = [
  {
    item: "Your monthly automation",
    paidTo: "BookMyCab",
    cadence: "Monthly",
  },
  {
    item: "One-time build & setup",
    paidTo: "BookMyCab",
    cadence: "Once",
  },
];

/** A grouped, column-aligned ledger of who gets paid for what. */
function Ledger({
  groupLabel,
  groupTone,
  rows,
  dark,
}: {
  groupLabel: string;
  /** "neutral" pass-through band vs "brand" BookMyCab band. */
  groupTone: "neutral" | "brand";
  rows: CostRow[];
  dark: boolean;
}) {
  const bandClass =
    groupTone === "brand"
      ? "bg-brut-yellow text-ink"
      : dark
        ? "bg-gray-800 text-paper"
        : "bg-ink text-paper";
  const rowBg = dark ? "bg-gray-900" : "bg-paper";
  const rowText = dark ? "text-paper" : "text-ink";
  const metaText = dark ? "text-gray-300" : "text-gray-600";
  const divide = dark ? "divide-gray-700" : "divide-gray-200";

  return (
    <div>
      {/* Group band */}
      <div className={`flex items-center justify-between gap-3 px-5 py-2.5 ${bandClass}`}>
        <span className="text-xs font-bold uppercase tracking-[0.1em]">{groupLabel}</span>
      </div>
      {/* Column header */}
      <div
        className={`hidden grid-cols-[minmax(0,1fr)_9rem_8rem] gap-4 border-b-2 px-5 py-2 sm:grid ${
          dark ? "border-gray-700" : "border-ink"
        }`}
      >
        {["Item", "Paid to", "When"].map((h) => (
          <span key={h} className={`text-[11px] font-bold uppercase tracking-[0.1em] ${metaText}`}>
            {h}
          </span>
        ))}
      </div>
      {/* Rows */}
      <ul className={`divide-y-2 ${divide}`}>
        {rows.map((row) => (
          <li
            key={row.item}
            className={`grid grid-cols-1 gap-x-4 gap-y-1 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_9rem_8rem] sm:items-baseline ${rowBg}`}
          >
            <span className={`font-bold ${rowText}`}>{row.item}</span>
            <span className={`text-sm font-medium ${metaText}`}>{row.paidTo}</span>
            <span className={`text-sm font-medium ${metaText}`}>{row.cadence}</span>
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
 * "What you pay externally", §6.4 cost transparency, rebuilt as one aligned
 * ledger: a neutral band for pass-through costs paid to your own providers,
 * then a yellow band for what is paid to BookMyCab. Columns line up so the
 * whole thing reads at a glance. `tone="dark"` adapts it for an ink section.
 */
export function TransparencySection({
  heading = "What you pay, and who you pay it to",
  className = "",
  tone = "light",
}: TransparencySectionProps) {
  const dark = tone === "dark";

  return (
    <div className={className}>
      <h2
        className={
          "font-display text-3xl font-extrabold uppercase tracking-[-0.02em] sm:text-4xl " +
          (dark ? "text-paper" : "text-ink")
        }
      >
        {heading}
      </h2>
      <p
        className={
          "mt-4 max-w-2xl text-lg leading-relaxed " +
          (dark ? "text-gray-300" : "text-gray-700")
        }
      >
        No middleman markup on usage. Channel and AI costs are billed straight to
        you by your own providers, at their price. We charge for the automation,
        full stop.
      </p>

      <div
        className={
          "mt-8 overflow-hidden border-[3px] shadow-brut " +
          (dark ? "border-paper" : "border-ink")
        }
      >
        <Ledger
          groupLabel="Paid to your own providers"
          groupTone="neutral"
          rows={PASS_THROUGH}
          dark={dark}
        />
        <div className={dark ? "h-[3px] bg-paper" : "h-[3px] bg-ink"} />
        <Ledger
          groupLabel="Paid to BookMyCab"
          groupTone="brand"
          rows={TO_BOOKMYCAB}
          dark={dark}
        />
      </div>

      <p
        className={
          "mt-8 font-display text-xl font-extrabold uppercase tracking-tight sm:text-2xl " +
          (dark ? "text-paper" : "text-ink")
        }
      >
        Your numbers stay yours. Your customers stay yours.
      </p>
    </div>
  );
}
