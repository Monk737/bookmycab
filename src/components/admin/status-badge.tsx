/**
 * Brutalist status pill for admin surfaces, rectangular, 2px ink frame, flat
 * semantic fill, INK text, plus a dot. Maps tenant statuses, automation runtime
 * statuses, build-pipeline stages and credential expiry to sensible colors;
 * unknown values fall back to a neutral gray pill. Status is carried by
 * fill + label + dot, never by color alone.
 */

type Tone = "lime" | "yellow" | "red" | "blue" | "orange" | "gray";

const TONE_CLASSES: Record<Tone, string> = {
  lime: "bg-brut-lime text-ink",
  yellow: "bg-brut-yellow text-ink",
  red: "bg-brut-red text-ink",
  blue: "bg-brut-blue text-paper",
  orange: "bg-brut-orange text-ink",
  gray: "bg-gray-200 text-ink",
};

const STATUS_TONE: Record<string, Tone> = {
  // tenant.status
  onboarding: "blue",
  active: "lime",
  suspended: "yellow",
  churned: "gray",
  // automations.status
  building: "orange",
  uat: "yellow",
  live: "lime",
  stopped: "gray",
  error: "red",
  // automations.build_stage (lowercased keys; building/uat/live overlap above)
  requested: "gray",
  scoped: "blue",
  // channel token expiry (credentials vault)
  expiring: "yellow",
  expired: "red",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status.toLowerCase()] ?? "gray";
  return (
    <span
      className={`inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${TONE_CLASSES[tone]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 bg-current" />
      {status}
    </span>
  );
}
