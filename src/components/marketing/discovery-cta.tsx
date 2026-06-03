"use client";

import { useEffect } from "react";
import { getCalApi } from "@calcom/embed-react";
import { clientEnv } from "@/env.client";
import { Button } from "@/components/marketing/ui/button";

type DiscoveryCtaProps = {
  size?: "md" | "lg";
  className?: string;
  label?: string;
};

/**
 * Primary CTA that opens the Cal.com booking popup for a discovery call.
 * Bound to NEXT_PUBLIC_CAL_LINK so the destination is configurable per env.
 */
export function DiscoveryCta({
  size = "md",
  className = "",
  label = "Book a Discovery Call",
}: DiscoveryCtaProps) {
  useEffect(() => {
    (async () => {
      const cal = await getCalApi();
      cal("ui", { hideEventTypeDetails: false, layout: "month_view" });
    })();
  }, []);

  return (
    <Button
      type="button"
      variant="primary"
      size={size}
      className={className}
      data-cal-link={clientEnv.NEXT_PUBLIC_CAL_LINK}
      data-cal-config='{"layout":"month_view"}'
    >
      {label}
    </Button>
  );
}
