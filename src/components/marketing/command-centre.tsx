// A faux dashboard "command centre", drawn in the brutalist system, that stands
// in for a real screenshot. Representative figures, not live data: it shows a
// prospect what lands on their screen once the agent is running — headline
// stats, the Monday briefing, the busiest-hours heatmap and the fares the agent
// chased back. Server component; no interactivity, no live fetch.

const STATS = [
  { label: "Calls answered", value: "1,284", sub: "last 30 days", accent: false },
  { label: "Booked", value: "71%", sub: "904 jobs", accent: false },
  { label: "Fares won back", value: "£2,310", sub: "by the agent", accent: true },
] as const;

// Busiest hours: four time bands across the week, intensity 0–4. Friday and
// Saturday late carry the peak, as they do for most firms.
const BANDS = ["Morn", "Day", "Eve", "Late"] as const;
const DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const HEAT: number[][] = [
  [1, 1, 1, 2, 2, 3, 2],
  [2, 2, 2, 2, 3, 3, 2],
  [2, 2, 3, 3, 4, 4, 3],
  [1, 1, 1, 2, 3, 4, 4],
];

// Yellow fill ramps with demand; 0 stays paper. Paired with the figure in the
// caption so it never relies on colour alone.
const HEAT_FILL = ["bg-paper", "bg-brut-yellow/25", "bg-brut-yellow/50", "bg-brut-yellow/75", "bg-brut-yellow"];

const RECOVERED = [
  { when: "Sat 01:12", route: "Rank → LHR T5", amount: "£58" },
  { when: "Fri 23:40", route: "High St → Gatwick", amount: "£72" },
  { when: "Thu 02:05", route: "Station → Watford", amount: "£24" },
];

export function CommandCentre({ className = "" }: { className?: string }) {
  return (
    <figure
      role="img"
      aria-label="The BookMyCab dashboard: 1,284 calls answered, 71% booked, £2,310 in fares won back, a plain-English Monday briefing, and a heatmap of the firm's busiest hours."
      className={`border-[3px] border-ink bg-canvas p-3 shadow-brut-xl sm:p-4 ${className}`}
    >
      {/* Faux title bar. */}
      <div className="flex items-center justify-between border-[3px] border-ink bg-ink px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="status-pulse inline-block h-2.5 w-2.5 border border-paper bg-brut-lime" aria-hidden="true" />
          <span className="font-display text-xs font-extrabold uppercase tracking-[0.06em] text-paper">
            BookMyCab · Dashboard
          </span>
        </div>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">Live</span>
      </div>

      <div className="mt-3 space-y-3" aria-hidden="true">
        {/* Headline stats. */}
        <div className="grid grid-cols-3 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className={`border-[3px] border-ink p-2.5 shadow-brut-sm sm:p-3 ${s.accent ? "bg-brut-yellow" : "bg-paper"}`}
            >
              <p className="text-[9px] font-bold uppercase leading-tight tracking-[0.06em] text-gray-600">{s.label}</p>
              <p className="mt-1 font-mono text-lg font-bold tabular-nums leading-none text-ink sm:text-xl">{s.value}</p>
              <p className="mt-1 text-[9px] font-medium text-gray-600">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* The Monday briefing — the hero element of the board. */}
        <div className="border-[3px] border-ink bg-paper p-3 shadow-brut-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="border-2 border-ink bg-brut-yellow px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-ink">
              Weekly briefing · Monday
            </span>
            <span className="font-mono text-[9px] font-bold tabular-nums text-gray-500">9–15 Jun</span>
          </div>
          <h4 className="mt-2 font-display text-sm font-extrabold uppercase leading-tight tracking-tight text-ink">
            Friday night carried the week. Three airport runs slipped at the quote.
          </h4>
          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-700">
            Bookings held at 71%. Voice notes from the rank did the heavy lifting after midnight. The drop-offs were all
            long Gatwick runs where callers hesitated on price.
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink">
            <span className="mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center border-2 border-ink bg-brut-lime text-[9px] font-bold">
              ✓
            </span>
            <span>
              <span className="font-display font-extrabold uppercase tracking-tight">One fix to try.</span> Quote a fixed
              airport fare before they ask for it.
            </span>
          </p>
        </div>

        {/* Heatmap + fares won back. */}
        <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
          <div className="border-[3px] border-ink bg-paper p-3 shadow-brut-sm">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-gray-600">Busiest hours</p>
            <div className="mt-2 flex gap-2">
              <div className="flex flex-col justify-between py-[18px]">
                {BANDS.map((b) => (
                  <span key={b} className="font-mono text-[8px] font-bold uppercase tracking-wide text-gray-500">
                    {b}
                  </span>
                ))}
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-7 gap-[2px] border-2 border-ink bg-ink">
                  {HEAT.flatMap((row, r) =>
                    row.map((v, c) => (
                      <span
                        key={`${r}-${c}`}
                        className={`aspect-square ${HEAT_FILL[v]}`}
                      />
                    )),
                  )}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-[2px]">
                  {DAYS.map((d, i) => (
                    <span key={i} className="text-center font-mono text-[8px] font-bold uppercase text-gray-500">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-2 font-mono text-[9px] font-bold tabular-nums text-ink">
              Peak: Fri &amp; Sat, after 11pm
            </p>
          </div>

          <div className="border-[3px] border-ink bg-paper p-3 shadow-brut-sm">
            <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-gray-600">Won back this week</p>
            <ul className="mt-2 space-y-1.5">
              {RECOVERED.map((r) => (
                <li key={r.when} className="flex items-baseline justify-between gap-2 border-b-2 border-gray-100 pb-1.5 last:border-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block font-mono text-[9px] font-bold tabular-nums text-gray-500">{r.when}</span>
                    <span className="block truncate text-[10px] font-semibold text-ink">{r.route}</span>
                  </span>
                  <span className="shrink-0 border-2 border-ink bg-brut-lime px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-ink">
                    {r.amount}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </figure>
  );
}
