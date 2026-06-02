import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { AutomationSubnav } from "@/components/dashboard/automation-subnav";

export default async function AutomationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ automationId: string }>;
}) {
  const claims = await requireUser();
  const { automationId } = await params;
  const restricted = claims.automation_restrictions ?? [];
  if (restricted.length > 0 && !restricted.includes(automationId)) notFound();
  return (
    <div>
      <AutomationSubnav automationId={automationId} />
      <div className="mt-4">{children}</div>
    </div>
  );
}
