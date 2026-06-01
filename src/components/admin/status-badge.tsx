/**
 * Small colored pill for a status string. Maps known tenant statuses
 * (onboarding/active/suspended/churned), automation runtime statuses
 * (building/uat/live/stopped/error), and build-pipeline stages
 * (Requested/Scoped/Building/UAT/Live) to sensible colors; unknown values fall
 * back to a neutral zinc pill. Color is paired with the visible label text so
 * status is never conveyed by color alone.
 */

type Tone = "emerald" | "amber" | "red" | "blue" | "zinc";

const TONE_CLASSES: Record<Tone, string> = {
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  red: "border-red-500/40 bg-red-500/10 text-red-700",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-700",
  zinc: "border-zinc-300 bg-zinc-100 text-zinc-600",
};

const STATUS_TONE: Record<string, Tone> = {
  // tenant.status
  onboarding: "blue",
  active: "emerald",
  suspended: "amber",
  churned: "zinc",
  // automations.status
  building: "blue",
  uat: "amber",
  live: "emerald",
  stopped: "zinc",
  error: "red",
  // automations.build_stage (lowercased keys; building/uat/live overlap above)
  requested: "zinc",
  scoped: "blue",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status.toLowerCase()] ?? "zinc";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider ${TONE_CLASSES[tone]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current opacity-70"
      />
      {status}
    </span>
  );
}
