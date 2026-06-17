import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getChatIntelligence, resolveIntelWindow } from "@/lib/dashboard/chat-intelligence";
import { StatTile, StatGrid, Panel, EmptyState } from "@/components/dashboard/ui";
import { IntelRangePicker } from "@/components/dashboard/chat/intel-range-picker";
import { SectionHead, ColumnChart, SegmentBar, SplitStat, MetricBlock } from "@/components/dashboard/chat/intel-bits";
import { TopRoutesList, RepeatCustomersList } from "@/components/dashboard/chat/intel-lists";

export const metadata = { title: "Chat Intelligence · BookMyCab" };

const ChatIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className="h-6 w-6">
    <path d="M4 5h16v11H7l-3 3z" />
  </svg>
);

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ChatIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; from?: string; to?: string }>;
}) {
  const claims = await requireUser();
  if (!claims.tenant_id) {
    return <div className="p-8 text-sm text-gray-700">No organisation linked to your account.</div>;
  }

  const win = resolveIntelWindow(await searchParams);
  const intel = await getChatIntelligence(claims.tenant_id, win);

  // Order weekdays Mon→Sun for a working-week read.
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdayBars = weekOrder.map((i) => ({ label: WD[i], value: intel.weekdays[i]?.count ?? 0 }));
  const hourBars = intel.hourly.map((h) => ({ label: String(h.hour).padStart(2, "0"), value: h.count }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Link href="/dashboard/chat" className="brut-focus text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 hover:text-ink">
          &larr; Chat
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">WhatsApp booking intelligence</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">Chat Intelligence</h1>
          </div>
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <IntelRangePicker preset={win.preset} from={win.from} to={win.to} />
            <p className="font-mono text-[11px] font-medium tabular-nums text-gray-500">{intel.rangeLabel}</p>
          </div>
        </div>
      </header>

      {!intel.hasData ? (
        <EmptyState
          icon={ChatIcon}
          title="No booking data in this window"
          body="Once your WhatsApp bot takes bookings in the selected range, route, vehicle, timing and revenue intelligence appears here. Try a wider date range."
        />
      ) : (
        <>
          {/* Performance — the window at a glance. Restrained: one ink anchor
              (Conversations) + one taxi-yellow accent on the revenue headline;
              every other tile stays paper, so the strip reads calm, not rainbow. */}
          <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Conversations" value={intel.totals.conversations.toLocaleString("en-GB")} sub="in window" color="ink" />
            <StatTile label="Booked" value={intel.totals.booked.toLocaleString("en-GB")} sub={`${intel.totals.bookedPct}% of chats`} color="paper" />
            <StatTile label="Revenue" value={`£${intel.revenue.totalGbp.toLocaleString("en-GB")}`} sub={`${intel.revenue.bookings} bookings`} color="yellow" />
            <StatTile label="Avg fare" value={intel.revenue.avgFareGbp ? `£${intel.revenue.avgFareGbp.toFixed(2)}` : "—"} sub="per booking" color="paper" />
            <StatTile label="Cancelled" value={intel.totals.cancelled.toLocaleString("en-GB")} sub="bot cancels" color="paper" />
            <StatTile label="Failed" value={intel.totals.failed.toLocaleString("en-GB")} sub="booking attempts" color="paper" />
          </StatGrid>

          {/* When — one card, two column charts. */}
          <SectionHead title="When they book" sub="UK local time" />
          <Panel title="Activity by time">
            <div className="grid gap-x-8 gap-y-7 lg:grid-cols-[2fr_1fr]">
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">By hour of day</p>
                <ColumnChart bars={hourBars} tickEvery={3} />
              </div>
              <div>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">By weekday</p>
                <ColumnChart bars={weekdayBars} showValues tickEvery={1} />
              </div>
            </div>
          </Panel>

          {/* Behaviour — channel, timing, loyalty. */}
          <SectionHead title="Behaviour" sub="Channel, timing and loyalty" />
          <div className="grid items-start gap-5 lg:grid-cols-3">
            <Panel title="Voice note vs text">
              <div className="space-y-3">
                <MetricBlock
                  label="Voice-note share"
                  value={`${intel.voiceSplit.voiceShare}%`}
                  sub={`${intel.voiceSplit.voiceCount.toLocaleString("en-GB")} chats used a voice note`}
                />
                <SplitStat
                  a={{ label: "Voice booked", value: `${intel.voiceSplit.voiceBookedPct}%` }}
                  b={{ label: "Text booked", value: `${intel.voiceSplit.textBookedPct}%` }}
                />
              </div>
            </Panel>

            <Panel title="Booking timing">
              <div className="space-y-3">
                <SplitStat
                  a={{ label: "ASAP", value: intel.timing.asap }}
                  b={{ label: "Scheduled", value: intel.timing.scheduled }}
                />
                <MetricBlock
                  label="Avg lead time (scheduled)"
                  value={intel.timing.avgLeadHours != null ? `${intel.timing.avgLeadHours}h` : "—"}
                  sub="booked ahead of pickup"
                />
              </div>
            </Panel>

            <RepeatCustomersList items={intel.repeatCustomers} />
          </div>

          {/* Demand — routes lead, vehicle composition alongside. */}
          <SectionHead title="Demand" sub="Where people travel and in what" />
          <div className="grid items-start gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TopRoutesList items={intel.topRoutes} rangeLabel={intel.rangeLabel} />
            </div>
            <Panel title="Vehicle mix">
              <SegmentBar
                rows={intel.vehicleMix.map((v) => ({ label: v.type, count: v.count, pct: v.pct }))}
                emptyLabel="No vehicles captured yet."
              />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
