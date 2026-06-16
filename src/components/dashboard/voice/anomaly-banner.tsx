import type { Anomaly } from "@/lib/voice/anomalies";

const FILL: Record<Anomaly["severity"], string> = {
  high: "bg-brut-red",
  medium: "bg-brut-orange",
};

/** Top-of-page alert bands. Renders nothing when nothing is anomalous. */
export function AnomalyBanner({ anomalies }: { anomalies: Anomaly[] }) {
  if (anomalies.length === 0) return null;
  return (
    <div className="space-y-2.5" role="alert" aria-label="Anomaly alerts">
      {anomalies.map((a) => (
        <div key={a.kind} className={`flex items-start gap-3 border-[3px] border-ink px-4 py-3 shadow-brut ${FILL[a.severity]}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="square" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-ink">
            <path d="M12 3 1.5 21h21z" />
            <path d="M12 10v5" />
            <path d="M12 17.5v.5" />
          </svg>
          <div className="min-w-0">
            <p className="font-display text-sm font-extrabold uppercase tracking-tight text-ink">{a.headline}</p>
            <p className="mt-0.5 text-sm leading-snug text-ink/80">{a.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
