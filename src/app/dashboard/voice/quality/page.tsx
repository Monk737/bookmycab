import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getVoiceQuality } from "@/lib/voice/quality";
import { EmptyState } from "@/components/dashboard/ui";
import { IntelligenceTabs } from "@/components/dashboard/voice/intelligence-tabs";
import { PerformanceKpis, HandleTrendPanel, OperationalHealth, SentimentPanel, LoyaltyPanel } from "@/components/dashboard/voice/quality-panels";
import { CallsToReview, RecentCalls } from "@/components/dashboard/voice/quality-call-lists";
import { VoiceMarkLine } from "@/components/marketing/product-marks";

export const metadata = { title: "Agent quality · BookMyCab" };

const RANGE_DAYS = 30;

export default async function VoiceQualityPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) {
    return <div className="p-8 text-sm text-gray-700">No organisation linked to your account.</div>;
  }

  const data = await getVoiceQuality(claims.tenant_id, RANGE_DAYS);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Link href="/dashboard/voice" className="brut-focus text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 hover:text-ink">
          &larr; AI Voice
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">Agent quality</h1>
          <p className="text-xs font-medium text-gray-600">Last {RANGE_DAYS} days · {data.performance.totalCalls} calls</p>
        </div>
        <div className="mt-4">
          <IntelligenceTabs active="quality" />
        </div>
      </header>

      {data.performance.totalCalls === 0 ? (
        <EmptyState
          icon={<VoiceMarkLine className="h-9 w-9" />}
          title="No calls to grade yet"
          body="Once your AI Voice agent starts answering, its containment, success rate, caller sentiment and the calls worth reviewing all land here."
        />
      ) : (
        <div className="space-y-8">
          <section className="space-y-5">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-ink">Agent performance</h2>
            <PerformanceKpis p={data.performance} />
            <div className="grid items-start gap-5 lg:grid-cols-3">
              <HandleTrendPanel p={data.performance} />
              <OperationalHealth p={data.performance} />
            </div>
          </section>

          <CallsToReview items={data.review} />

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <SentimentPanel s={data.sentiment} />
            <LoyaltyPanel l={data.loyalty} />
          </div>

          <RecentCalls items={data.recent} />
        </div>
      )}
    </div>
  );
}
