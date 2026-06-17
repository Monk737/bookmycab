"use client";

import { useRef, useState } from "react";
import { FailureClusters } from "./failure-clusters";
import { CallInspector } from "./call-inspector";
import type { FailureSummary, RecentCallMeta } from "@/lib/voice/quality";

/**
 * Agent-quality cockpit: the failure-reason clusters drive the Call Inspector
 * beneath them. Clicking a reason filters the inspector to exactly those calls
 * and scrolls to it — the rising-problem → the-calls → fix loop in one move.
 */
export function AgentQualityBoard({
  failures,
  recent,
  windowLabel,
}: {
  failures: FailureSummary;
  recent: RecentCallMeta[];
  windowLabel: string;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);

  const select = (r: string) => {
    setReason((cur) => {
      const next = cur === r ? null : r;
      if (next) requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <FailureClusters
        clusters={failures.clusters}
        totalFlagged={failures.totalFlagged}
        risingCount={failures.risingCount}
        windowLabel={windowLabel}
        activeReason={reason}
        onSelectReason={select}
      />
      <div ref={inspectorRef} className="scroll-mt-4">
        <CallInspector items={recent} windowLabel={windowLabel} reasonFilter={reason} onClearReason={() => setReason(null)} />
      </div>
    </div>
  );
}
