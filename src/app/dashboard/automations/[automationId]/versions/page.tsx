import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/resolve";
import { listVersions } from "@/lib/config/versions";
import { VersionsClient } from "./versions-client";

export const metadata = { title: "Config versions, BookMyCab" };

export default async function VersionsPage({ params }: { params: Promise<{ automationId: string }> }) {
  const { automationId } = await params;
  const claims = await requireUser();
  if (!claims.tenant_id) redirect("/dashboard");
  if (!(await hasFeature(claims.tenant_id, "config_versioning"))) redirect(`/dashboard/automations/${automationId}`);
  const versions = await listVersions(automationId);
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-bold text-ink">Config versions</h1>
      <p className="mb-4 text-sm text-gray-500">Snapshot the live config, publish changes, or roll back.</p>
      <VersionsClient orgId={claims.tenant_id} automationId={automationId} versions={versions} isDemo={claims.is_demo} />
    </div>
  );
}
