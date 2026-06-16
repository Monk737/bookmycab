import type { Briefing } from "@/lib/voice/briefing";

const dmon = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function periodLabel(startYmd: string, endYmd: string): string {
  const s = new Date(`${startYmd}T00:00:00Z`);
  const e = new Date(`${endYmd}T00:00:00Z`);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  const sDay = s.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" });
  return sameMonth ? `${sDay}–${dmon(endYmd)}` : `${dmon(startYmd)} – ${dmon(endYmd)}`;
}

/** Small yellow spark — the one mark that says "this is the AI layer". */
function Spark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-brut-yellow">
      <path d="M12 2l2.4 7.1L22 12l-7.6 2.9L12 22l-2.4-7.1L2 12l7.6-2.9z" fill="currentColor" stroke="#0a0a0a" strokeWidth={1.5} strokeLinejoin="miter" />
    </svg>
  );
}

function Chip({ label, value, delta, tone }: { label: string; value: string; delta?: number; tone?: "good" | "bad" | "neutral" }) {
  const d = delta;
  const dColor = tone === "good" ? "text-ink" : tone === "bad" ? "text-ink" : "text-gray-500";
  const fill =
    tone === "good" && (d ?? 0) >= 0 ? "bg-brut-lime"
    : tone === "bad" && (d ?? 0) > 0 ? "bg-brut-red"
    : "bg-paper";
  return (
    <div className={`min-w-0 px-3 py-2 ${fill}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/60">{label}</p>
      <p className="mt-0.5 font-mono text-base font-extrabold tabular-nums leading-none text-ink">{value}</p>
      {d != null && d !== 0 ? (
        <p className={`mt-0.5 font-mono text-[10px] font-bold tabular-nums ${dColor}`}>{d > 0 ? `+${d}` : d} vs last wk</p>
      ) : null}
    </div>
  );
}

/**
 * Weekly AI briefing — an LLM-written narrative over the week's voice data. The
 * prose is generated; the chips are deterministic figures from the same data, so
 * the numbers on screen are real even though the sentences are model-written.
 */
export function WeeklyBriefing({ briefing }: { briefing: Briefing | null }) {
  if (!briefing) {
    return (
      <section className="border-[3px] border-ink bg-paper shadow-brut">
        <header className="flex items-center gap-2.5 border-b-[3px] border-ink bg-ink px-5 py-3">
          <Spark />
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-paper">Weekly AI briefing</h2>
        </header>
        <p className="px-5 py-8 text-sm text-gray-600">
          Your first briefing writes itself once a full week of calls is in. It reads the week, spots what cost you bookings, and recommends one fix.
        </p>
      </section>
    );
  }

  const m = briefing.metrics;
  const bookedDelta = m.bookedPct - m.prevBookedPct;
  const callsDelta = m.totalCalls - m.prevTotalCalls;

  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut-lg">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b-[3px] border-ink bg-ink px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Spark />
          <h2 className="font-display text-base font-extrabold uppercase tracking-tight text-paper">Weekly AI briefing</h2>
        </div>
        <p className="font-mono text-[11px] font-bold tabular-nums text-paper/70">
          {periodLabel(briefing.periodStart, briefing.periodEnd)} · generated {dmon(briefing.createdAt.slice(0, 10))}
        </p>
      </header>

      <div className="p-5 sm:p-6">
        <h3 className="text-balance font-display text-2xl font-extrabold uppercase leading-[1.04] tracking-[-0.02em] text-ink sm:text-3xl">
          {briefing.headline}
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-[3px] border-2 border-ink bg-ink sm:grid-cols-4">
          <Chip label="Calls" value={m.totalCalls.toLocaleString("en-GB")} delta={callsDelta} tone="neutral" />
          <Chip label="Booked" value={`${m.bookedPct}%`} delta={bookedDelta} tone="good" />
          {m.busiest ? <Chip label="Busiest" value={m.busiest.label} /> : <Chip label="Avg handle" value={`${Math.floor(m.avgHandleS / 60)}:${String(m.avgHandleS % 60).padStart(2, "0")}`} />}
          {m.addressConfusionLost > 0 ? (
            <Chip label="Lost to address" value={String(m.addressConfusionLost)} />
          ) : m.failed > 0 ? (
            <Chip label="Failed" value={String(m.failed)} delta={m.failed} tone="bad" />
          ) : (
            <Chip label="Failed" value="0" />
          )}
        </div>

        <p className="mt-4 max-w-prose text-pretty text-[15px] leading-relaxed text-gray-700">{briefing.narrative}</p>

        {briefing.recommendation ? (
          <div className="mt-5 border-[3px] border-ink bg-brut-yellow px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink/70">Recommended this week</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">{briefing.recommendation}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
