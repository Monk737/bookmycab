import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getAutomationCards,
  getBookingsPage,
  getConversationsPage,
  getRecentRuns,
} from "@/lib/dashboard/queries";
import { getBookingsTrend, getRevenueSummary, getResponseStats } from "@/lib/dashboard/insights";
import { OverviewTrend } from "./overview-trend";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { DataTable } from "@/components/dashboard/data-table";
import type { Column } from "@/components/dashboard/data-table";
import { DonutChart } from "@/components/dashboard/charts/donut-chart";
import { BarChart } from "@/components/dashboard/charts/bar-chart";
import { AutomationControls } from "@/app/dashboard/automations/[automationId]/automation-controls";
import { LiveFeed } from "@/app/dashboard/automations/[automationId]/live-feed";
import { formatDateTime, formatDurationMs } from "@/lib/dashboard/format";
import type { ConversationRow } from "@/lib/dashboard/types";

const ADAPTER_DISPLAY: Record<string, string> = {
  autocab: "AutoCab",
  icabbi: "iCabbi",
  cordic: "Cordic",
};

function adapterLabel(raw: string | null): string {
  if (!raw) return "";
  return ADAPTER_DISPLAY[raw.toLowerCase()] ?? raw.toUpperCase();
}

type RunRow = {
  id: string;
  status: string;
  startedAt: string;
  durationMs: number | null;
  triggerChannel: string | null;
};

const runsColumns: Column<RunRow>[] = [
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "startedAt",
    header: "Started",
    render: (row) => (
      <span className="whitespace-nowrap">
        {formatDateTime(row.startedAt, "Europe/London")}
      </span>
    ),
  },
  {
    key: "duration",
    header: "Duration",
    render: (row) => (
      <span className="tabular-nums">{formatDurationMs(row.durationMs)}</span>
    ),
  },
  {
    key: "trigger",
    header: "Trigger channel",
    render: (row) => (
      <span className="capitalize">{row.triggerChannel ?? "·"}</span>
    ),
  },
];

const convColumns: Column<ConversationRow>[] = [
  {
    key: "customer",
    header: "Customer",
    render: (row) => (
      <span className="font-medium">{row.customerName ?? row.customerHandle}</span>
    ),
  },
  {
    key: "channel",
    header: "Channel",
    render: (row) => (
      <span className="capitalize">{row.channelId ?? "·"}</span>
    ),
  },
  {
    key: "started",
    header: "Started",
    render: (row) => (
      <span className="whitespace-nowrap">
        {formatDateTime(row.startedAt, "Europe/London")}
      </span>
    ),
  },
  {
    key: "outcome",
    header: "Outcome",
    render: (row) =>
      row.outcome ? <StatusBadge status={row.outcome} /> : <span className="text-gray-400">·</span>,
  },
];

export default async function AutomationOverviewPage({
  params,
}: {
  params: Promise<{ automationId: string }>;
}) {
  const claims = await requireUser();
  const { automationId } = await params;

  if (!claims.tenant_id) notFound();

  const [cards, recentBookings, recentConversations, recentRuns, trend, revenue, response] =
    await Promise.all([
      getAutomationCards(claims.tenant_id),
      getBookingsPage({ automationId, filter: { page: 1, limit: 20 } }),
      getConversationsPage({ automationId, filter: { page: 1, limit: 10 } }),
      getRecentRuns(automationId, 10),
      getBookingsTrend(automationId, {}),
      getRevenueSummary(automationId, {}),
      getResponseStats(automationId, {}),
    ]);

  const card = cards.find((c) => c.id === automationId);
  if (!card) notFound();

  const adapter = adapterLabel(card.dispatchAdapter);
  const lastRun = recentRuns[0] ?? null;
  const isBookingType = card.type === "Booking";

  // Aggregate booking-mode from recent bookings (honest sample)
  const pickupModeMap: Record<string, number> = {};
  for (const b of recentBookings.rows) {
    if (b.pickupTimeMode) {
      pickupModeMap[b.pickupTimeMode] = (pickupModeMap[b.pickupTimeMode] ?? 0) + 1;
    }
  }
  const bookingModeData = Object.entries(pickupModeMap).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {/* Status reads first: the controller's "is it working?" answer. */}
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusBadge status={card.status} />
            {adapter && (
              <span className="border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                {adapter}
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
            {card.name}
          </h1>
          {lastRun && (
            <p className="mt-1 text-xs text-gray-500">
              Last run {formatDateTime(lastRun.startedAt, "Europe/London")}
            </p>
          )}
        </div>
        <AutomationControls
          orgId={claims.tenant_id}
          automationId={automationId}
          status={card.status}
          isDemo={claims.is_demo}
        />
      </div>

      {/* KPI Strip */}
      <KpiStrip
        items={[
          { label: "Bookings today", value: card.bookingsToday },
          { label: "Revenue (30d)", value: `£${revenue.totalFare.toLocaleString()}` },
          { label: "Completion", value: `${revenue.completionPct}%` },
          {
            label: "Avg response",
            value: response.sampleSize ? `${response.avgSeconds}s` : "·",
            sub: response.sampleSize ? `p95 ${response.p95Seconds}s` : "No data yet",
          },
          { label: "Active channels", value: card.channels.length },
        ]}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="border-[3px] border-ink bg-paper p-5 shadow-brut-sm lg:col-span-1">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-bold text-gray-700">Bookings trend</h3>
            <span className="text-[11px] text-gray-400">last 30 days</span>
          </div>
          <OverviewTrend data={trend} />
        </div>

        {isBookingType && (
          <>
            <div className="border-[3px] border-ink bg-paper p-5 shadow-brut-sm">
              <h3 className="mb-1 text-sm font-bold text-gray-700">
                Booking mode
              </h3>
              <p className="mb-3 text-[11px] text-gray-400">
                Based on recent bookings.
              </p>
              <DonutChart data={bookingModeData} />
            </div>
            <div className="border-[3px] border-ink bg-paper p-5 shadow-brut-sm">
              <h3 className="mb-1 text-sm font-bold text-gray-700">Booking status</h3>
              <p className="mb-3 text-[11px] text-gray-400">Last 30 days.</p>
              <BarChart data={revenue.byStatus} />
            </div>
          </>
        )}
      </div>

      {/* Live Feed */}
      <section aria-labelledby="live-feed-heading">
        <h2
          id="live-feed-heading"
          className="mb-3 text-base font-bold text-ink"
        >
          Live bookings feed
        </h2>
        <LiveFeed
          automationId={automationId}
          initialRows={recentBookings.rows}
        />
      </section>

      {/* Recent Conversations */}
      <section aria-labelledby="convos-heading">
        <h2
          id="convos-heading"
          className="mb-3 text-base font-bold text-ink"
        >
          Recent conversations
        </h2>
        <DataTable
          columns={convColumns}
          rows={recentConversations.rows}
          getRowKey={(row) => row.id}
          emptyMessage="No conversations yet."
        />
      </section>

      {/* Recent Runs */}
      <section aria-labelledby="runs-heading">
        <h2
          id="runs-heading"
          className="mb-3 text-base font-bold text-ink"
        >
          Recent runs
        </h2>
        <DataTable
          columns={runsColumns}
          rows={recentRuns}
          getRowKey={(row) => row.id}
          emptyMessage="No runs recorded yet."
        />
      </section>
    </div>
  );
}
