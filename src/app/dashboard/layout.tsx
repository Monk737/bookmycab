import type { ReactNode } from "react";
import { Fira_Sans, Fira_Code } from "next/font/google";
import { requireUser } from "@/lib/auth/session";
import { getOrgSummary } from "@/lib/dashboard/queries";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { hasFeature } from "@/lib/entitlements/resolve";

const firaSans = Fira_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-code",
  display: "swap",
});

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const claims = await requireUser();
  const org = claims.tenant_id ? await getOrgSummary(claims.tenant_id) : null;
  const showAlerts = claims.tenant_id ? await hasFeature(claims.tenant_id, "alerting") : false;
  return (
    <div className={`${firaSans.variable} ${firaCode.variable} font-sans`}>
      {claims.is_demo && <DemoBanner />}
      <DashboardShell orgName={org?.name ?? "Your organisation"} showAlerts={showAlerts}>{children}</DashboardShell>
    </div>
  );
}
