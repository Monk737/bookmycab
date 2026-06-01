import { Button } from "@/components/marketing/ui/button";

type TryDashboardLinkProps = {
  size?: "md" | "lg";
  variant?: "secondary" | "ghost";
  className?: string;
};

/** Secondary CTA linking to the read-only demo dashboard. */
export function TryDashboardLink({
  size = "md",
  variant = "secondary",
  className = "",
}: TryDashboardLinkProps) {
  return (
    <Button href="/demo" variant={variant} size={size} className={className}>
      Try the Dashboard
    </Button>
  );
}
