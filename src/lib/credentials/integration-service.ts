import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import type { CredProduct } from "./integration-fields";

function svc() {
  return createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface CredValue {
  id: string;
  fieldKey: string;
  value: string | null;
}

export interface CredInstance {
  product: CredProduct;
  label: string;
  values: CredValue[];
}

/**
 * All integration credentials for a tenant, grouped into instances
 * (product + instance_label). Each instance holds the individual field values,
 * so a field can appear more than once (e.g. several AutoCab API URLs).
 */
export async function listTenantCredentials(tenantId: string): Promise<CredInstance[]> {
  const { data } = await svc()
    .from("integration_credentials")
    .select("id, product, instance_label, field_key, field_value")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as Array<{
    id: string;
    product: string;
    instance_label: string;
    field_key: string;
    field_value: string | null;
  }>;

  const map = new Map<string, CredInstance>();
  for (const r of rows) {
    if (r.product !== "whatsapp" && r.product !== "voice") continue;
    const key = `${r.product}::${r.instance_label}`;
    let inst = map.get(key);
    if (!inst) {
      inst = { product: r.product, label: r.instance_label, values: [] };
      map.set(key, inst);
    }
    inst.values.push({ id: r.id, fieldKey: r.field_key, value: r.field_value });
  }
  // Voice first, then by label, mirroring the product order in the console.
  return [...map.values()].sort((a, b) => {
    if (a.product !== b.product) return a.product === "voice" ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

/** Tenants for the console selector. */
export async function listTenantsForSelect(): Promise<{ id: string; name: string }[]> {
  const { data } = await svc().from("tenants").select("id, name").order("name");
  return (data ?? []) as { id: string; name: string }[];
}
