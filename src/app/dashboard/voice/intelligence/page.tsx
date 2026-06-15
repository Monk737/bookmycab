import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getVoiceIntelligence } from "@/lib/voice/intelligence";
import { RecoveryBoard } from "@/components/dashboard/voice/recovery-board";
import { DemandHeatmap, BookingFunnel, RouteIntelligence } from "@/components/dashboard/voice/intelligence-panels";
import { IntelligenceTabs } from "@/components/dashboard/voice/intelligence-tabs";

export const metadata = { title: "Booking intelligence · BookMyCab" };

const RANGE_DAYS = 30;

export default async function VoiceIntelligencePage() {
  const claims = await requireUser();
  if (!claims.tenant_id) {
    return <div className="p-8 text-sm text-gray-700">No organisation linked to your account.</div>;
  }

  const data = await getVoiceIntelligence(claims.tenant_id, RANGE_DAYS);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Link
          href="/dashboard/voice"
          className="brut-focus text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 hover:text-ink"
        >
          &larr; AI Voice
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
            Booking intelligence
          </h1>
          <p className="text-xs font-medium text-gray-600">Last {RANGE_DAYS} days · {data.heatmap.total} calls</p>
        </div>
        <div className="mt-4">
          <IntelligenceTabs active="bookings" />
        </div>
      </header>

      <div className="space-y-5">
        <RecoveryBoard
          items={data.recovery.items}
          recoverable={data.recovery.recoverable}
          recoveredValue={data.recovery.recoveredValue}
          recoveredCount={data.recovery.recoveredCount}
        />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <DemandHeatmap cells={data.heatmap.cells} max={data.heatmap.max} peak={data.heatmap.peak} rangeDays={RANGE_DAYS} />
          </div>
          <BookingFunnel f={data.funnel} />
        </div>

        <RouteIntelligence top={data.routes.top} airports={data.routes.airports} vehicles={data.routes.vehicles} />
      </div>
    </div>
  );
}
