import type { ReactNode } from "react";
import { Fira_Sans, Fira_Code } from "next/font/google";
import { requireUser } from "@/lib/auth/session";
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
  await requireUser(); // redirects to /login if unauthenticated
  // NOTE: getOrgSummary is wired in Task 3; use a literal for now.
  return (
    <div className={`${firaSans.variable} ${firaCode.variable} font-sans`}>
      <DashboardShell orgName="Your organisation">{children}</DashboardShell>
    </div>
  );
}
