import { Button } from "@/components/marketing/ui/button";

type TryDashboardLinkProps = {
  size?: "md" | "lg";
  variant?: "secondary" | "ghost";
  className?: string;
  label?: string;
};

/**
 * Demo-dashboard CTA. Opens the read-only demo session (/demo signs in the
 * demo user and lands on a live, populated dashboard).
 */
export function TryDashboardLink({
  size = "md",
  variant = "secondary",
  className = "",
  label = "Try Demo Dashboard",
}: TryDashboardLinkProps) {
  return (
    <Button href="/demo" variant={variant} size={size} className={className}>
      {label}
    </Button>
  );
}
