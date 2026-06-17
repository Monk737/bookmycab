import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getChatIntelligence, resolveIntelWindow } from "@/lib/dashboard/chat-intelligence";
import { StatTile, StatGrid, Panel, EmptyState } from "@/components/dashboard/ui";
import { IntelRangePicker } from "@/components/dashboard/chat/intel-range-picker";
import { BarList } from "@/components/dashboard/chat/intel-bits";
import { TopRoutesList, RepeatCustomersList } from "@/components/dashboard/chat/intel-lists";

export const metadata = { title: "Chat Intelligence · BookMyCab" };

const ChatIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className="h-6 w-6">
    <path d="M4 5h16v11H7l-3 3z" />
  </svg>
);

/** Section divider: a display heading on a hard rule, like the rest of the dashboard. */
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b-[3px] border-ink pb-2">
      <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">{title}</h2>
      {sub ? <p className="text-xs font-medium text-gray-500">{sub}</p> : null}
    </div>
  );
}

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
          {/* Performance — the window at a glance. */}
          <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Conversations" value={intel.totals.conversations.toLocaleString("en-GB")} sub="in window" />
            <StatTile label="Booked" value={intel.totals.booked.toLocaleString("en-GB")} sub={`${intel.totals.bookedPct}% of chats`} />
            <StatTile label="Revenue" value={`£${intel.revenue.totalGbp.toLocaleString("en-GB")}`} sub={`${intel.revenue.bookings} bookings`} />
            <StatTile label="Avg fare" value={intel.revenue.avgFareGbp ? `£${intel.revenue.avgFareGbp.toFixed(2)}` : "—"} sub="per booking" />
            <StatTile label="Cancelled" value={intel.totals.cancelled.toLocaleString("en-GB")} sub="bot cancels" />
            <StatTile label="Failed" value={intel.totals.failed.toLocaleString("en-GB")} sub="booking attempts" />
          </StatGrid>

          {/* Where & what. */}
          <SectionHead title="Where & what" sub="Demand by route and vehicle" />
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <TopRoutesList items={intel.topRoutes} rangeLabel={intel.rangeLabel} />
            <Panel title="Vehicle mix">
              <BarList
                rows={intel.vehicleMix.map((v) => ({ key: v.type, label: v.type, value: `${v.count} · ${v.pct}%`, count: v.count }))}
                fill="bg-brut-violet"
                emptyLabel="No vehicles captured yet."
              />
            </Panel>
          </div>

          {/* When. */}
          <SectionHead title="When they book" sub="UK local time" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Busiest hours">
              <BarList
                rows={intel.busiestHours.map((h) => ({ key: String(h.hour), label: h.label, value: `${h.count}`, count: h.count }))}
                fill="bg-brut-lime"
                emptyLabel="Not enough bookings yet."
              />
            </Panel>
            <Panel title="By weekday">
              <BarList
                rows={intel.weekdays.map((d) => ({ key: d.wd, label: d.wd, value: `${d.count}`, count: d.count }))}
                fill="bg-brut-orange"
                emptyLabel="Not enough bookings yet."
              />
            </Panel>
          </div>

          {/* Who & how. */}
          <SectionHead title="Who & how" sub="Channel mix, timing and loyalty" />
          <div className="grid items-start gap-5 lg:grid-cols-3">
            <Panel title="Voice note vs text">
              <div className="space-y-3">
                <div className="border-2 border-ink p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Voice-note share</p>
                  <p className="mt-0.5 font-mono text-2xl font-extrabold tabular-nums text-ink">{intel.voiceSplit.voiceShare}%</p>
                  <p className="text-xs text-gray-600">{intel.voiceSplit.voiceCount.toLocaleString("en-GB")} chats used a voice note</p>
                </div>
                <div className="grid grid-cols-2 gap-[3px] border-2 border-ink bg-ink">
                  <div className="bg-brut-cyan/40 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/60">Voice booked</p>
                    <p className="mt-0.5 font-mono text-base font-extrabold tabular-nums text-ink">{intel.voiceSplit.voiceBookedPct}%</p>
                  </div>
                  <div className="bg-paper px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/60">Text booked</p>
                    <p className="mt-0.5 font-mono text-base font-extrabold tabular-nums text-ink">{intel.voiceSplit.textBookedPct}%</p>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Booking timing">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-[3px] border-2 border-ink bg-ink">
                  <div className="bg-paper px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/60">ASAP</p>
                    <p className="mt-0.5 font-mono text-base font-extrabold tabular-nums text-ink">{intel.timing.asap}</p>
                  </div>
                  <div className="bg-paper px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink/60">Scheduled</p>
                    <p className="mt-0.5 font-mono text-base font-extrabold tabular-nums text-ink">{intel.timing.scheduled}</p>
                  </div>
                </div>
                <div className="border-2 border-ink p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Avg lead time (scheduled)</p>
                  <p className="mt-0.5 font-mono text-2xl font-extrabold tabular-nums text-ink">
                    {intel.timing.avgLeadHours != null ? `${intel.timing.avgLeadHours}h` : "—"}
                  </p>
                  <p className="text-xs text-gray-600">booked ahead of pickup</p>
                </div>
              </div>
            </Panel>

            <RepeatCustomersList items={intel.repeatCustomers} />
          </div>
        </>
      )}
    </div>
  );
}
