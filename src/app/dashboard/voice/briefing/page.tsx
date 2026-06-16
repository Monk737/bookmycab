import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getLatestBriefing, getRecentBriefings, type Briefing } from "@/lib/voice/briefing";
import { WeeklyBriefing } from "@/components/dashboard/voice/weekly-briefing";

export const metadata = { title: "AI Weekly Briefing · BookMyCab" };

const dmon = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function periodLabel(startYmd: string, endYmd: string): string {
  const s = new Date(`${startYmd}T00:00:00Z`);
  const e = new Date(`${endYmd}T00:00:00Z`);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  const sDay = s.toLocaleDateString("en-GB", { day: "numeric", timeZone: "UTC" });
  return sameMonth ? `${sDay}–${dmon(endYmd)}` : `${dmon(startYmd)} – ${dmon(endYmd)}`;
}

/* A compact card for a previous week's briefing, stacked under the latest. */
function ArchiveCard({ b }: { b: Briefing }) {
  return (
    <article className="border-[3px] border-ink bg-paper p-4 shadow-brut">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] tabular-nums text-gray-500">
          {periodLabel(b.periodStart, b.periodEnd)}
        </p>
        <p className="font-mono text-[11px] font-bold tabular-nums text-ink">
          {b.metrics.totalCalls.toLocaleString("en-GB")} calls · {b.metrics.bookedPct}% booked
        </p>
      </div>
      <h3 className="mt-1.5 font-display text-base font-extrabold uppercase leading-tight tracking-tight text-ink">
        {b.headline}
      </h3>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-gray-700">{b.narrative}</p>
    </article>
  );
}

export default async function VoiceBriefingPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) {
    return <div className="p-8 text-sm text-gray-700">No organisation linked to your account.</div>;
  }

  const [latest, history] = await Promise.all([
    getLatestBriefing(claims.tenant_id),
    getRecentBriefings(claims.tenant_id, 9),
  ]);
  // Latest is rendered in full above; the archive shows the weeks before it.
  const earlier = history.filter((b) => b.periodStart !== latest?.periodStart);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Link
          href="/dashboard/voice"
          className="brut-focus text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 hover:text-ink"
        >
          &larr; AI Voice
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
            AI Weekly Briefing
          </h1>
          <span className="border-2 border-ink bg-brut-yellow px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink shadow-brut-sm">
            Every Monday morning
          </span>
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-gray-600">
          A plain-language read of your AI Voice week — what changed, what cost you bookings, and one fix to try.
          Written fresh every Monday over the previous seven days of calls.
        </p>
      </header>

      <WeeklyBriefing briefing={latest} />

      {earlier.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-extrabold uppercase tracking-tight text-ink">Earlier weeks</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {earlier.map((b) => (
              <ArchiveCard key={b.periodStart} b={b} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
