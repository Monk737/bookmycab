import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { getOrgSummary } from "@/lib/dashboard/queries";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { DemoWelcome } from "@/components/dashboard/demo-welcome";
import { TenantNotifications } from "@/components/dashboard/tenant-notifications";
import { getRecentNotifications } from "@/lib/dashboard/notifications";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const claims = await requireUser();
  const org = claims.tenant_id ? await getOrgSummary(claims.tenant_id) : null;
  const recent = claims.tenant_id ? await getRecentNotifications(claims.tenant_id) : [];
  return (
    <div className="font-sans flex h-screen flex-col overflow-hidden">
      {claims.is_demo && <DemoBanner />}
      {claims.is_demo && <DemoWelcome />}
      <DashboardShell
        orgName={org?.name ?? "Your organisation"}
        notifications={
          claims.tenant_id ? (
            <TenantNotifications tenantId={claims.tenant_id} initialItems={recent} />
          ) : undefined
        }
      >
        {children}
      </DashboardShell>
    </div>
  );
}
