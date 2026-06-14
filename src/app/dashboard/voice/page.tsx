import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getVoiceAnalytics, formatDuration } from "@/lib/dashboard/product-overview";
import { StatTile, StatGrid, Panel, StatusPill, UsageMeter, EmptyState } from "@/components/dashboard/ui";
import { CallsTrend } from "@/components/dashboard/voice/calls-trend";
import { OutcomeBars, CreditSplit, MiniStats } from "@/components/dashboard/voice/voice-blocks";
import { CallsLog } from "@/components/dashboard/voice/calls-log";
import { BookingsLog } from "@/components/dashboard/voice/bookings-log";
import { getVoiceCallLog } from "@/lib/voice/call-log";
import { getVoiceBookingEvents } from "@/lib/voice/booking-events";
import { VoiceMarkLine } from "@/components/marketing/product-marks";

export const metadata = { title: "AI Voice · BookMyCab" };

const VoiceIcon = <VoiceMarkLine className="h-9 w-9" />;

export default async function VoicePage() {
  const claims = await requireUser();
  if (!claims.tenant_id) {
    return <div className="p-8 text-sm text-gray-700">No organisation linked to your account.</div>;
  }

  const v = await getVoiceAnalytics(claims.tenant_id, 30);

  // No AI Voice product on this account.
  if (!v.hasVoice) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-6 font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink">AI Voice</h1>
        <EmptyState
          icon={VoiceIcon}
          title="No voice agent yet"
          body="This account runs Chat only. Add an AI Voice agent to answer the phone, take bookings and free your dispatch line. Your build team sets it up."
          action={
            <Link href="/dashboard/support" className="brut-press inline-flex h-11 items-center border-[3px] border-ink bg-brut-yellow px-5 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut">
              Ask about AI Voice
            </Link>
          }
        />
      </div>
    );
  }

  const [callLog, bookingEvents] = await Promise.all([
    getVoiceCallLog(claims.tenant_id, 90),
    getVoiceBookingEvents(claims.tenant_id, 90),
  ]);
  const hasCalls = v.aggregate.totalCalls > 0;
  const multiAgent = v.perAgent.length > 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">AI Voice analytics</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">Voice</h1>
        </div>
        <p className="text-xs font-medium text-gray-600">Last {v.rangeDays} days · {v.perAgent.length} agent{v.perAgent.length === 1 ? "" : "s"}</p>
      </header>

      {/* Headline figures. */}
      <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Calls (30d)" value={v.aggregate.totalCalls.toLocaleString("en-GB")} />
        <StatTile label="Booked rate" value={`${v.aggregate.bookedPct}%`} sub={`${v.aggregate.booked.toLocaleString("en-GB")} booked`} />
        <StatTile label="Avg length" value={formatDuration(v.aggregate.avgDurationS)} sub="per call" />
        <StatTile label="Plan used" value={v.used.toLocaleString("en-GB")} sub="this month" />
        <StatTile label="Plan remaining" value={v.remaining.toLocaleString("en-GB")} sub={`of ${v.allowance.toLocaleString("en-GB")}`} />
        <StatTile label="Credit balance" value={v.creditBalance.toLocaleString("en-GB")} sub="top-up calls" />
      </StatGrid>

      {/* Plan pool meter. */}
      <div className="mt-5 border-[3px] border-ink bg-paper px-5 py-4 shadow-brut">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-600">This month&rsquo;s call pool</p>
          <p className="font-mono text-xs font-bold tabular-nums text-ink">
            {v.used.toLocaleString("en-GB")} used · {v.remaining.toLocaleString("en-GB")} left
          </p>
        </div>
        <UsageMeter used={v.used} total={v.allowance} segments={40} />
        <p className="mt-2 text-xs text-gray-600">
          Plan calls reset each billing month and don&rsquo;t carry over. Once the pool is empty, calls draw from your top-up credit.{" "}
          <Link href="/dashboard/billing" className="font-bold text-ink underline decoration-2 underline-offset-2 hover:bg-brut-yellow">Top up credit</Link>
        </p>
      </div>

      {/* Main analytics — all agents combined. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title={multiAgent ? "All agents" : "Activity"} className="lg:col-span-2">
          {hasCalls ? (
            <CallsTrend data={v.trend} />
          ) : (
            <div className="flex h-56 flex-col items-center justify-center border-[3px] border-dashed border-gray-300 bg-gray-50 text-center">
              <p className="font-display text-base font-extrabold uppercase tracking-tight text-ink">No calls recorded yet</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-gray-600">When your AI Voice agent answers a call, daily volume, outcomes and credit usage land here.</p>
            </div>
          )}
        </Panel>

        <div className="grid gap-5">
          <Panel title="Outcomes">
            <OutcomeBars block={v.aggregate} />
          </Panel>
          <Panel title="Credit source">
            <CreditSplit block={v.aggregate} />
          </Panel>
        </div>
      </div>

      {/* Day-filtered logs: calls (left) + bookings (right) on desktop, stacked on mobile.
          Each keeps its full history; the calendar picks a day and the list scrolls. */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <CallsLog calls={callLog} />
        <BookingsLog events={bookingEvents} />
      </div>

      {/* Per-agent split (only when more than one agent). */}
      {multiAgent ? (
        <div className="mt-8">
          <h2 className="mb-4 font-display text-xl font-extrabold uppercase tracking-tight text-ink">By agent</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {v.perAgent.map((a) => (
              <section key={a.agentId} className="flex flex-col border-[3px] border-ink bg-paper shadow-brut">
                <header className="flex items-center justify-between gap-3 border-b-[3px] border-ink px-5 py-3.5">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-extrabold uppercase tracking-tight text-ink">{a.name}</h3>
                    {a.phone ? <p className="font-mono text-xs text-gray-500">{a.phone}</p> : null}
                  </div>
                  <StatusPill status={a.status} />
                </header>
                <div className="space-y-4 p-5">
                  <MiniStats block={a} />
                  <OutcomeBars block={a} />
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
