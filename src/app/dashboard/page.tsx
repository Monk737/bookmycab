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
  Booking: "bg-brut-blue text-paper",
  Support: "bg-brut-violet text-ink",
  Driver: "bg-brut-lime text-ink",
  Custom: "bg-brut-yellow text-ink",
};

export default async function DashboardPage() {
  const claims = await requireUser();

  if (!claims.tenant_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md border-[3px] border-ink bg-paper px-8 py-10 text-center shadow-brut">
          <p className="text-sm font-medium text-gray-700">
            No organisation found for your account. Please contact{" "}
            <a
              href="mailto:support@bookmycab.com"
              className="font-bold text-ink underline underline-offset-2 hover:bg-brut-yellow"
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
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-ink">
              {org?.name ?? "Your Organisation"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {org?.planBand && (
                <span className="border-2 border-ink bg-brut-cyan px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                  {org.planBand}
                </span>
              )}
              {org?.contractRenewal && (
                <span className="text-xs font-medium text-gray-600">
                  Renews{" "}
                  {formatDateTime(org.contractRenewal, "Europe/London")}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm font-medium text-gray-600">
            Need help?{" "}
            <Link
              href="/dashboard/support"
              className="font-bold text-ink underline underline-offset-2 hover:bg-brut-yellow"
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
          <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">
            Your automations
          </h2>
        </div>

        {cards.length === 0 ? (
          <div className="border-[3px] border-dashed border-ink bg-paper px-8 py-16 text-center">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto mb-3 h-10 w-10 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .28 2.716-1.072 2.716H3.87c-1.352 0-2.072-1.716-1.072-2.716L4.2 15.3"
              />
            </svg>
            <p className="text-sm font-bold text-ink">
              No automations yet, your BookMyCab team is building yours.
            </p>
            <p className="mt-1 text-xs font-medium text-gray-600">
              We&apos;ll notify you when your automation is ready.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const adapter = adapterLabel(card.dispatchAdapter);
              const tagClass =
                TYPE_TAG_CLASS[card.type] ?? "bg-gray-200 text-ink";

              return (
                <div
                  key={card.id}
                  className="brut-press flex flex-col border-[3px] border-ink bg-paper shadow-brut"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-extrabold uppercase tracking-tight text-ink">
                        {card.name}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`border-2 border-ink px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${tagClass}`}
                        >
                          {card.type}
                        </span>
                        {adapter && (
                          <span className="border-2 border-ink bg-paper px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">
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
                  <div className="grid grid-cols-3 gap-[3px] border-y-[3px] border-ink bg-ink">
                    <div className="bg-paper px-4 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        Bookings
                      </p>
                      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-ink">
                        {card.bookingsToday}
                      </p>
                      <p className="text-[10px] font-medium text-gray-500">today</p>
                    </div>
                    <div className="bg-paper px-4 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        Convos
                      </p>
                      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-ink">
                        {card.conversationsToday}
                      </p>
                      <p className="text-[10px] font-medium text-gray-500">today</p>
                    </div>
                    <div className="bg-paper px-4 py-3 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        Conv %
                      </p>
                      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-ink">
                        {card.conversionPct}%
                      </p>
                      <p className="text-[10px] font-medium text-gray-500">rate</p>
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
                      className="brut-press brut-focus cursor-pointer border-[3px] border-ink bg-brut-yellow px-4 py-1.5 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut-sm"
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
        <div className="mt-8 border-[3px] border-dashed border-ink bg-paper px-6 py-5 text-center">
          <p className="text-sm font-medium text-gray-700">
            Need another automation?{" "}
            <Link
              href="/dashboard/support"
              className="cursor-pointer font-bold text-ink underline underline-offset-2 hover:bg-brut-yellow"
            >
              Request a new automation
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
