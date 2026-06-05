import { requireUser } from "@/lib/auth/session";
import { getOrgSummary, getKpiStrip, getAutomationCards, getOrgKpis } from "@/lib/dashboard/queries";
import { KpiStrip } from "@/components/dashboard/kpi-strip";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ChannelIcon } from "@/components/dashboard/channel-icon";
import { AutomationControls } from "@/app/dashboard/automations/[automationId]/automation-controls";
import { formatDateTime } from "@/lib/dashboard/format";
import Link from "next/link";

const ADAPTER_DISPLAY: Record<string, string> = {
  autocab: "AutoCab",
  icabbi: "iCabbi",
  cordic: "Cordic",
};

function adapterLabel(raw: string | null): string {
  if (!raw) return "";
  return ADAPTER_DISPLAY[raw.toLowerCase()] ?? raw.toUpperCase();
}

const TYPE_TAG_CLASS: Record<string, string> = {
  Booking: "bg-blue-800/10 text-blue-800 border-blue-800/20",
  Support: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  Driver: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  Custom: "bg-amber-500/10 text-amber-700 border-amber-500/20",
};

export default async function DashboardPage() {
  const claims = await requireUser();

  if (!claims.tenant_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-sm text-center">
          <p className="text-sm text-slate-500">
            No organisation found for your account. Please contact{" "}
            <a
              href="mailto:support@bookmycab.com"
              className="text-blue-800 underline underline-offset-2 hover:opacity-80 transition-opacity duration-150"
            >
              BookMyCab support
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const [org, kpis, cards, orgKpis] = await Promise.all([
    getOrgSummary(claims.tenant_id),
    getKpiStrip(claims.tenant_id),
    getAutomationCards(claims.tenant_id),
    getOrgKpis(claims.tenant_id),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {org?.name ?? "Your Organisation"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {org?.planBand && (
                <span className="rounded border border-blue-800/20 bg-blue-800/10 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-blue-800">
                  {org.planBand}
                </span>
              )}
              {org?.contractRenewal && (
                <span className="text-xs text-slate-500">
                  Renews{" "}
                  {formatDateTime(org.contractRenewal, "Europe/London")}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Need help?{" "}
            <Link
              href="/dashboard/support"
              className="text-blue-800 underline underline-offset-2 hover:opacity-80 transition-opacity duration-150"
            >
              BookMyCab support
            </Link>
          </p>
        </div>

        {/* KPI Strip */}
        <div className="mb-8">
          <KpiStrip
            items={[
              { label: "Bookings today", value: kpis.bookingsToday },
              { label: "Bookings (30d)", value: orgKpis.bookings30d },
              { label: "Revenue (30d)", value: `£${orgKpis.revenue30d.toLocaleString()}` },
              { label: "Conversations today", value: kpis.conversationsToday },
              { label: "Live automations", value: kpis.liveAutomations },
            ]}
          />
        </div>

        {/* Automations Grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Your automations</h2>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center shadow-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto mb-3 h-10 w-10 text-slate-300"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .28 2.716-1.072 2.716H3.87c-1.352 0-2.072-1.716-1.072-2.716L4.2 15.3"
              />
            </svg>
            <p className="text-sm font-medium text-slate-700">
              No automations yet — your BookMyCab team is building yours.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              We&apos;ll notify you when your automation is ready.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const adapter = adapterLabel(card.dispatchAdapter);
              const tagClass =
                TYPE_TAG_CLASS[card.type] ??
                "bg-slate-100 text-slate-600 border-slate-300";

              return (
                <div
                  key={card.id}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900">
                        {card.name}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${tagClass}`}
                        >
                          {card.type}
                        </span>
                        {adapter && (
                          <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-slate-600">
                            {adapter}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 pt-0.5">
                      <StatusBadge status={card.status} />
                    </div>
                  </div>

                  {/* Channels */}
                  {card.channels.length > 0 && (
                    <div className="flex items-center gap-2 px-5 pb-3">
                      {card.channels.map((ch, i) => (
                        <ChannelIcon key={i} type={ch.type} health={ch.health} />
                      ))}
                    </div>
                  )}

                  {/* Stat Trio */}
                  <div className="grid grid-cols-3 gap-px border-y border-slate-100 bg-slate-100">
                    <div className="bg-white px-4 py-3 text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                        Bookings
                      </p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                        {card.bookingsToday}
                      </p>
                      <p className="text-[10px] text-slate-400">today</p>
                    </div>
                    <div className="bg-white px-4 py-3 text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                        Convos
                      </p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                        {card.conversationsToday}
                      </p>
                      <p className="text-[10px] text-slate-400">today</p>
                    </div>
                    <div className="bg-white px-4 py-3 text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                        Conv %
                      </p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                        {card.conversionPct}%
                      </p>
                      <p className="text-[10px] text-slate-400">rate</p>
                    </div>
                  </div>

                  {/* Footer: controls + open */}
                  <div className="flex items-center justify-between gap-2 px-5 py-4">
                    <AutomationControls
                      orgId={claims.tenant_id!}
                      automationId={card.id}
                      status={card.status}
                    />
                    <Link
                      href={`/dashboard/automations/${card.id}`}
                      className="cursor-pointer rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-1"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-5 text-center">
          <p className="text-sm text-slate-600">
            Need another automation?{" "}
            <Link
              href="/dashboard/support"
              className="cursor-pointer font-medium text-blue-800 underline underline-offset-2 hover:opacity-80 transition-opacity duration-150"
            >
              Request a new automation
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
