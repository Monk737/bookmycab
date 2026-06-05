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
  const showCustomers = claims.tenant_id ? await hasFeature(claims.tenant_id, "crm") : false;
  const showLiveops = claims.tenant_id ? await hasFeature(claims.tenant_id, "live_takeover") : false;
  const showDispatch = claims.tenant_id ? await hasFeature(claims.tenant_id, "dispatch_retry") : false;
  const showIntel = claims.tenant_id ? await hasFeature(claims.tenant_id, "conversation_intelligence") : false;
  const showInvoicing = claims.tenant_id ? await hasFeature(claims.tenant_id, "account_invoicing") : false;
  const showReports = claims.tenant_id ? await hasFeature(claims.tenant_id, "scheduled_reports") : false;
  const showConnect = claims.tenant_id ? await hasFeature(claims.tenant_id, "self_serve_channels") : false;
  const showIntegrations = claims.tenant_id ? await hasFeature(claims.tenant_id, "api_access") : false;
  const showCopilot = claims.tenant_id ? await hasFeature(claims.tenant_id, "ai_copilot") : false;
  return (
    <div className={`${firaSans.variable} ${firaCode.variable} font-sans`}>
      {claims.is_demo && <DemoBanner />}
      <DashboardShell orgName={org?.name ?? "Your organisation"} showAlerts={showAlerts} showCustomers={showCustomers} showLiveops={showLiveops} showDispatch={showDispatch} showIntel={showIntel} showInvoicing={showInvoicing} showReports={showReports} showConnect={showConnect} showIntegrations={showIntegrations} showCopilot={showCopilot}>{children}</DashboardShell>
    </div>
  );
}
