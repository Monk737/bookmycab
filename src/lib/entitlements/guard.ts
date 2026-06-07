import "server-only";
import { NextResponse } from "next/server";
import type { FeatureKey } from "./catalog";
import { hasFeature } from "./resolve";
import { checkQuota } from "./meter";

/**
 * Returns a 403 NextResponse when the tenant is NOT entitled to `key`, else null.
 * Mirrors blockIfDemo, call at the top of a mutating route/server action:
 *
 *   const block = await requireFeature(claims.tenant_id, "alerting");
 *   if (block) return block;
 */
export async function requireFeature(
  tenantId: string | null,
  key: FeatureKey,
): Promise<NextResponse | null> {
  if (await hasFeature(tenantId, key)) return null;
  return NextResponse.json(
    { error: "This feature is not available on your plan.", feature: key },
    { status: 403 },
  );
}

/**
 * Like requireFeature, but also enforces the metered quota: 403 if the feature
 * is off, 429 if it is on but over quota, null otherwise.
 */
export async function requireQuota(
  tenantId: string | null,
  key: FeatureKey,
): Promise<NextResponse | null> {
  const featureBlock = await requireFeature(tenantId, key);
  if (featureBlock) return featureBlock;
  const { allowed, used, limit } = await checkQuota(tenantId as string, key);
  if (allowed) return null;
  return NextResponse.json(
    { error: "You have reached your plan limit for this feature.", feature: key, used, limit },
    { status: 429 },
  );
}
