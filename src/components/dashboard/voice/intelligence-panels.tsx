import type { HeatCell, FunnelData, RouteItem, AirportItem, VehicleItem } from "@/lib/voice/intelligence";
import { RouteList, AirportList } from "./route-search";

/* ---------------------------------------------------------------- Demand heatmap */

const WD_LABEL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0]; // display order -> wd index (0=Sun)

function hourLabel(h: number): string {
  const ap = h < 12 ? "am" : "pm";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${ap}`;
}

// Single-hue lightness ramp (color-blind safe) topped with orange/ink for peaks.
function cellClass(n: number, max: number): string {
  if (n === 0 || max === 0) return "bg-gray-50";
  const r = n / max;
  if (r > 0.8) return "bg-ink";
  if (r > 0.6) return "bg-brut-orange";
  if (r > 0.4) return "bg-brut-yellow";
  if (r > 0.2) return "bg-brut-yellow/60";
  return "bg-brut-yellow/30";
}

export function DemandHeatmap({
  cells,
  max,
  peak,
  rangeDays,
}: {
  cells: HeatCell[];
  max: number;
  peak: { wd: number; hr: number; count: number } | null;
  rangeDays: number;
}) {
  const lookup = new Map(cells.map((c) => [`${c.wd}-${c.hr}`, c.count]));
  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <section className="flex flex-col border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-ink px-5 py-3.5">
        <div>
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Demand heatmap</h2>
          <p className="text-xs text-gray-600">When calls land · UK time · last {rangeDays} days</p>
        </div>
        {peak ? (
          <p className="border-2 border-ink bg-brut-yellow px-2.5 py-1 text-xs font-bold text-ink">
            Busiest: {WD_LABEL[WD_ORDER.indexOf(peak.wd)]} {hourLabel(peak.hr)} · {peak.count}
          </p>
        ) : null}
      </header>

      <div className="overflow-x-auto p-4">
        <div className="min-w-[620px]">
          <div className="mb-1 grid grid-cols-[2.5rem_repeat(24,1fr)] gap-px">
            <div />
            {hours.map((h) => (
              <div key={h} className="text-center text-[9px] font-bold tabular-nums text-gray-400">
                {h % 6 === 0 ? h : ""}
              </div>
            ))}
          </div>
          {WD_ORDER.map((wd, i) => (
            <div key={wd} className="mb-px grid grid-cols-[2.5rem_repeat(24,1fr)] gap-px">
              <div className="flex items-center text-[10px] font-bold uppercase tracking-wide text-gray-600">{WD_LABEL[i]}</div>
              {hours.map((h) => {
                const n = lookup.get(`${wd}-${h}`) ?? 0;
                return (
                  <div
                    key={h}
                    title={`${WD_LABEL[i]} ${hourLabel(h)} — ${n} call${n === 1 ? "" : "s"}`}
                    className={`aspect-square border border-ink/15 ${cellClass(n, max)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t-2 border-gray-100 px-5 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Quiet</span>
        <span className="h-3 w-4 border border-ink/20 bg-brut-yellow/30" />
        <span className="h-3 w-4 border border-ink/20 bg-brut-yellow/60" />
        <span className="h-3 w-4 border border-ink/20 bg-brut-yellow" />
        <span className="h-3 w-4 border border-ink/20 bg-brut-orange" />
        <span className="h-3 w-4 border border-ink/20 bg-ink" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Busy</span>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Booking funnel */

export function BookingFunnel({ f }: { f: FunnelData }) {
  const pct = (n: number) => (f.total > 0 ? Math.round((n / f.total) * 100) : 0);
  const stages = [
    { label: "Calls", value: f.total, pct: 100, fill: "bg-ink", text: "text-paper" },
    { label: "Reached a quote", value: f.engaged, pct: pct(f.engaged), fill: "bg-brut-blue", text: "text-paper" },
    { label: "Booked", value: f.booked, pct: pct(f.booked), fill: "bg-brut-lime", text: "text-ink" },
  ];
  return (
    <section className="flex flex-col border-[3px] border-ink bg-paper shadow-brut">
      <header className="border-b-[3px] border-ink px-5 py-3.5">
        <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Booking funnel</h2>
        <p className="text-xs text-gray-600">Where bookings convert and where they leak</p>
      </header>
      <div className="flex-1 space-y-3 p-5">
        {stages.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.04em] text-ink">{s.label}</span>
              <span className="font-mono text-xs font-bold tabular-nums text-gray-600">{s.value} · {s.pct}%</span>
            </div>
            <div className="h-7 border-2 border-ink bg-paper">
              <div className={`flex h-full items-center ${s.fill}`} style={{ width: `${Math.max(5, s.pct)}%` }}>
                <span className={`px-2 font-mono text-xs font-bold tabular-nums ${s.text}`}>{s.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-[3px] border-t-[3px] border-ink bg-ink">
        <div className="bg-brut-lime px-4 py-3">
          <p className="font-mono text-2xl font-extrabold tabular-nums text-ink">{f.quoteToBookPct}%</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-ink/70">Quote &rarr; book</p>
        </div>
        <div className="bg-brut-orange px-4 py-3">
          <p className="font-mono text-2xl font-extrabold tabular-nums text-ink">{f.abandonmentPct}%</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-ink/70">Abandoned</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------- Routes / airports / vehicles */

const VEH_FILL = ["bg-brut-yellow", "bg-brut-lime", "bg-brut-cyan", "bg-brut-violet", "bg-brut-pink"];

export function RouteIntelligence({
  top,
  airports,
  vehicles,
}: {
  top: RouteItem[];
  airports: AirportItem[];
  vehicles: VehicleItem[];
}) {
  const vMax = Math.max(1, ...vehicles.map((v) => v.count));
  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className="border-b-[3px] border-ink px-5 py-3.5">
        <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Routes, airports &amp; vehicles</h2>
        <p className="text-xs text-gray-600">What your callers are actually booking</p>
      </header>
      <div className="grid gap-[3px] bg-ink md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="bg-paper p-5">
          <RouteList routes={top} />
        </div>
        <div className="bg-paper p-5">
          <AirportList airports={airports} />
        </div>
        <div className="bg-paper p-5">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Vehicle mix</p>
          {vehicles.length === 0 ? (
            <p className="text-sm text-gray-500">None yet.</p>
          ) : (
            <ul className="space-y-3">
              {vehicles.map((v, i) => (
                <li key={v.type}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-xs font-bold text-ink">{v.type}</span>
                    <span className="font-mono text-xs font-bold tabular-nums text-gray-600">{v.count}</span>
                  </div>
                  <div className="h-3 border-2 border-ink bg-paper">
                    <div className={`h-full ${VEH_FILL[i % VEH_FILL.length]}`} style={{ width: `${Math.max(6, (v.count / vMax) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
