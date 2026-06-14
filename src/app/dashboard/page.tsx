import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getKpiStrip } from "@/lib/dashboard/queries";
import { getProductOverview } from "@/lib/dashboard/product-overview";
import { getTenantAutomations } from "@/lib/dashboard/automations";
import { AutomationCard } from "@/components/dashboard/automation-card";
import { StatTile, StatGrid, EmptyState } from "@/components/dashboard/ui";

const AUTOMATION_WINDOW_DAYS = 30;

export default async function DashboardPage() {
  const claims = await requireUser();

  if (!claims.tenant_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-md border-[3px] border-ink bg-paper px-8 py-10 text-center shadow-brut">
          <p className="text-sm font-medium text-gray-700">
            No organisation is linked to your account. Contact{" "}
            <a href="mailto:support@bookmycab.com" className="font-bold text-ink underline underline-offset-2 hover:bg-brut-yellow">
              support@bookmycab.com
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const [kpi, overview, automations] = await Promise.all([
    getKpiStrip(claims.tenant_id),
    getProductOverview(claims.tenant_id),
    getTenantAutomations(claims.tenant_id, AUTOMATION_WINDOW_DAYS),
  ]);

  const chatLive = overview.chat ? overview.chat.channels.filter((c) => c.health !== "disconnected").length : 0;
  const voiceLive = overview.voice ? overview.voice.agents.filter((a) => a.status === "live" || a.status === "uat").length : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">Overview</h1>
        <p className="text-xs font-medium text-gray-600">Calls this billing month · live to the minute</p>
      </header>

      {/* Operational stat band — six glanceable numbers on one ink bed. */}
      <StatGrid cols="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Chat channels" value={overview.chat ? overview.chat.channels.length : 0} sub={overview.chat ? `${chatLive} connected` : "Not provisioned"} />
        <StatTile label="Voice agents" value={overview.voice ? overview.voice.agents.length : 0} sub={overview.voice ? `${voiceLive} live` : "Not provisioned"} />
        <StatTile label="Phone numbers" value={overview.phoneNumbers.length} sub="In use across products" />
        <StatTile label="Calls this month" value={overview.voice ? overview.voice.used.toLocaleString("en-GB") : "—"} sub={overview.voice ? `of ${overview.voice.allowance.toLocaleString("en-GB")} included` : "No voice plan"} />
        <StatTile label="Remaining calls" value={overview.voice ? overview.voice.remaining.toLocaleString("en-GB") : "—"} sub={overview.voice ? "Resets next billing month" : "No voice plan"} />
        <StatTile label="Credit balance" value={overview.voice ? overview.voice.creditBalance.toLocaleString("en-GB") : "—"} sub={overview.voice ? "Top-up calls (carry over)" : "—"} />
      </StatGrid>

      {automations.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className="h-6 w-6"><path d="M4 5h16v11H7l-3 3z" /></svg>}
            title="Your automation is being built"
            body="BookMyCab provisions every account by hand. Once your Chat bot or AI Voice agent is live, your channels, calls and analytics appear here."
            action={
              <Link href="/dashboard/support" className="brut-press inline-flex h-11 items-center border-[3px] border-ink bg-brut-yellow px-5 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut">
                Contact your build team
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6">
          <h2 className="mb-4 font-display text-xl font-extrabold uppercase tracking-tight text-ink">
            {automations.length === 1 ? "Your automation" : "Your automations"}
          </h2>
          <div className={automations.length === 1 ? "grid gap-5" : "grid gap-5 lg:grid-cols-2"}>
            {automations.map((a) => (
              <AutomationCard key={a.id} a={a} windowDays={AUTOMATION_WINDOW_DAYS} />
            ))}
          </div>
        </div>
      )}

      {/* Today's activity — real figures from the live feed. */}
      <div className="mt-5 grid grid-cols-3 gap-[3px] border-[3px] border-ink bg-ink shadow-brut">
        <StatTile label="Bookings today" value={kpi.bookingsToday} sub="Confirmed to dispatch" />
        <StatTile label="Conversations today" value={kpi.conversationsToday} sub="Across all channels" />
        <StatTile label="Live automations" value={kpi.liveAutomations} sub="Chat + voice, running now" />
      </div>
    </div>
  );
}
