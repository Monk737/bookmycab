import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getChatIntelligence } from "@/lib/dashboard/chat-intelligence";
import { StatTile, StatGrid, Panel, EmptyState } from "@/components/dashboard/ui";

export const metadata = { title: "Chat Intelligence · BookMyCab" };

const ChatIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className="h-6 w-6">
    <path d="M4 5h16v11H7l-3 3z" />
  </svg>
);

/** Horizontal proportion bar row: label · bar · value. */
function BarRow({ label, value, count, max, fill = "bg-ink" }: { label: string; value: string; count: number; max: number; fill?: string }) {
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 first:pt-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{label}</p>
        <span className="mt-1 block h-2.5 border-2 border-ink bg-paper">
          <span className={`block h-full ${fill}`} style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
        </span>
      </div>
      <span className="shrink-0 text-right font-mono text-xs font-bold tabular-nums text-ink">{value}</span>
    </li>
  );
}

export default async function ChatIntelligencePage() {
  const claims = await requireUser();
  if (!claims.tenant_id) {
    return <div className="p-8 text-sm text-gray-700">No organisation linked to your account.</div>;
  }

  const intel = await getChatIntelligence(claims.tenant_id, 30);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Link href="/dashboard/chat" className="brut-focus text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 hover:text-ink">
          &larr; Chat
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">WhatsApp booking intelligence</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">Chat Intelligence</h1>
          </div>
          <p className="text-xs font-medium text-gray-600">Last {intel.rangeDays} days</p>
        </div>
      </header>

      {!intel.hasData ? (
        <EmptyState
          icon={ChatIcon}
          title="No booking data yet"
          body="Once your WhatsApp bot starts taking bookings, route, vehicle, timing and revenue intelligence appears here."
        />
      ) : (
        <>
          {/* Headline booking figures. */}
          <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Conversations" value={intel.totals.conversations.toLocaleString("en-GB")} sub={`${intel.rangeDays}d`} />
            <StatTile label="Booked" value={intel.totals.booked.toLocaleString("en-GB")} sub={`${intel.totals.bookedPct}% of chats`} />
            <StatTile label="Revenue" value={`£${intel.revenue.totalGbp.toLocaleString("en-GB")}`} sub={`${intel.revenue.bookings} bookings`} />
            <StatTile label="Avg fare" value={intel.revenue.avgFareGbp ? `£${intel.revenue.avgFareGbp.toFixed(2)}` : "—"} sub="per booking" />
            <StatTile label="Cancelled" value={intel.totals.cancelled.toLocaleString("en-GB")} sub="in window" />
            <StatTile label="Failed" value={intel.totals.failed.toLocaleString("en-GB")} sub="booking attempts" />
          </StatGrid>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Top routes. */}
            <Panel title="Top routes">
              {intel.topRoutes.length === 0 ? (
                <p className="text-sm text-gray-600">No routes captured yet.</p>
              ) : (
                <ul>
                  {intel.topRoutes.map((r) => (
                    <BarRow
                      key={r.label}
                      label={r.label}
                      value={`${r.count}${r.avgFare ? ` · ${r.avgFare}` : ""}`}
                      count={r.count}
                      max={Math.max(1, ...intel.topRoutes.map((x) => x.count))}
                      fill="bg-brut-cyan"
                    />
                  ))}
                </ul>
              )}
            </Panel>

            {/* Vehicle mix. */}
            <Panel title="Vehicle mix">
              {intel.vehicleMix.length === 0 ? (
                <p className="text-sm text-gray-600">No vehicles captured yet.</p>
              ) : (
                <ul>
                  {intel.vehicleMix.map((v) => (
                    <BarRow
                      key={v.type}
                      label={v.type}
                      value={`${v.count} · ${v.pct}%`}
                      count={v.count}
                      max={Math.max(1, ...intel.vehicleMix.map((x) => x.count))}
                      fill="bg-brut-violet"
                    />
                  ))}
                </ul>
              )}
            </Panel>

            {/* Busiest booking hours. */}
            <Panel title="Busiest hours (UK)">
              {intel.busiestHours.length === 0 ? (
                <p className="text-sm text-gray-600">Not enough bookings yet.</p>
              ) : (
                <ul>
                  {intel.busiestHours.map((h) => (
                    <BarRow
                      key={h.hour}
                      label={h.label}
                      value={`${h.count}`}
                      count={h.count}
                      max={Math.max(1, ...intel.busiestHours.map((x) => x.count))}
                      fill="bg-brut-lime"
                    />
                  ))}
                </ul>
              )}
            </Panel>

            {/* Weekday spread. */}
            <Panel title="By weekday">
              <ul>
                {intel.weekdays.map((d) => (
                  <BarRow
                    key={d.wd}
                    label={d.wd}
                    value={`${d.count}`}
                    count={d.count}
                    max={Math.max(1, ...intel.weekdays.map((x) => x.count))}
                    fill="bg-brut-orange"
                  />
                ))}
              </ul>
            </Panel>
          </div>

          {/* Voice vs text, timing, repeat customers. */}
          <div className="mt-5 grid gap-5 lg:grid-cols-3">
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

            <Panel title="Repeat customers">
              {intel.repeatCustomers.length === 0 ? (
                <p className="text-sm text-gray-600">No repeat bookers in this window yet.</p>
              ) : (
                <ul className="divide-y-2 divide-gray-100">
                  {intel.repeatCustomers.map((c) => (
                    <li key={c.handle} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="truncate font-mono text-sm text-ink">{c.handle}</span>
                      <span className="shrink-0 border-2 border-ink bg-brut-yellow px-2 py-0.5 font-mono text-xs font-bold text-ink">
                        {c.bookings} bookings
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
