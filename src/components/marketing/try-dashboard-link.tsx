import { Button } from "@/components/marketing/ui/button";

type TryDashboardLinkProps = {
  size?: "md" | "lg";
  variant?: "secondary" | "ghost";
  className?: string;
};

/**
 * Demo-dashboard CTA. Opens the read-only demo session (/demo signs in the
 * demo user and lands on a live, populated dashboard).
 */
export function TryDashboardLink({
  size = "md",
  variant = "secondary",
  className = "",
}: TryDashboardLinkProps) {
  return (
    <Button href="/demo" variant={variant} size={size} className={className}>
      Try Demo Dashboard
    </Button>
  );
}
