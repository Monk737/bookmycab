import { Button } from "@/components/marketing/ui/button";

type TryDashboardLinkProps = {
  size?: "md" | "lg";
  variant?: "secondary" | "ghost";
  className?: string;
};

/**
 * Demo-dashboard CTA. The live demo isn't available yet, so this renders as a
 * disabled (non-clickable) button with a "Coming Soon" ribbon, not a link.
 */
export function TryDashboardLink({
  size = "md",
  variant = "secondary",
  className = "",
}: TryDashboardLinkProps) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <Button
        variant={variant}
        size={size}
        disabled
        aria-disabled="true"
        title="Coming soon"
        className="pointer-events-none"
      >
        Try the Dashboard
      </Button>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-2.5 -top-2.5 z-10 rotate-3 border-2 border-ink bg-brut-pink px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink shadow-brut-sm"
      >
        Coming Soon
      </span>
    </span>
  );
}
