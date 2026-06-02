import type { ReactNode } from "react";
import { Fira_Sans, Fira_Code } from "next/font/google";
import { requireUser } from "@/lib/auth/session";
import { getOrgSummary } from "@/lib/dashboard/queries";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

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
  return (
    <div className={`${firaSans.variable} ${firaCode.variable} font-sans`}>
      <DashboardShell orgName={org?.name ?? "Your organisation"}>{children}</DashboardShell>
    </div>
  );
}
