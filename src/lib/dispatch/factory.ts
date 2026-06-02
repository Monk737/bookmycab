import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { DispatchAdapter } from "./types";
import { DispatchConfigError } from "./errors";
import { AutoCabAdapter } from "./autocab/adapter";
import { ICabbiAdapter } from "./icabbi/adapter";
import { CordicAdapter } from "./cordic/adapter";

/** Raw per-tenant dispatch settings from the `tenants` row. */
type TenantDispatch = {
  dispatchAdapter: string;
  dispatchCompanyId: string | null;
  dispatchBaseUrl: string | null;
};

/** Injectable data access so the factory is testable without a live DB. */
export interface DispatchDeps {
  loadTenantDispatch(tenantId: string): Promise<TenantDispatch | null>;
  loadAutoCabKey(tenantId: string): Promise<string | null>;
}

/** Resolved, validated config the factory builds adapters from. */
export type DispatchConfig = {
  adapter: string;
  companyId: number;
  autoCab: { baseUrl: string; subscriptionKey: string } | null;
};

/** Service-role read of the tenant's dispatch settings (RLS would block anon). */
async function defaultLoadTenantDispatch(tenantId: string): Promise<TenantDispatch | null> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data } = await supabase
    .from("tenants")
    .select("dispatch_adapter, dispatch_company_id, dispatch_base_url")
    .eq("id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    dispatchAdapter: data.dispatch_adapter,
    dispatchCompanyId: data.dispatch_company_id,
    dispatchBaseUrl: data.dispatch_base_url,
  };
}

/** Decrypts the tenant-scoped AutoCab subscription key from the Epic-3 vault. */
async function defaultLoadAutoCabKey(tenantId: string): Promise<string | null> {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: cred } = await supabase
    .from("channel_credentials")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("credential_type", "autocab_subscription_key")
    .is("channel_id", null)
    .maybeSingle();
  if (!cred) return null;
  const { data: secret, error } = await supabase.rpc("vault_read_credential_rpc", {
    p_id: (cred as { id: string }).id,
    p_accessed_by: null,
    p_key: env.SUPABASE_VAULT_KEY,
  });
  if (error) return null;
  return (secret as string) ?? null;
}

const defaultDeps: DispatchDeps = {
  loadTenantDispatch: defaultLoadTenantDispatch,
  loadAutoCabKey: defaultLoadAutoCabKey,
};

/**
 * Loads + validates a tenant's dispatch config. Throws DispatchConfigError when
 * the tenant is unknown, the company id is missing/non-numeric, or (for AutoCab)
 * the base URL / subscription key is absent.
 */
export async function loadDispatchConfig(
  tenantId: string,
  deps: DispatchDeps = defaultDeps,
): Promise<DispatchConfig> {
  const t = await deps.loadTenantDispatch(tenantId);
  if (!t) {
    throw new DispatchConfigError("No dispatch configuration for this account.");
  }
  const companyId = Number(t.dispatchCompanyId);
  if (!t.dispatchCompanyId || Number.isNaN(companyId)) {
    throw new DispatchConfigError("Dispatch company id is missing or invalid.");
  }

  if (t.dispatchAdapter === "autocab") {
    const baseUrl = (t.dispatchBaseUrl ?? "").replace(/\/$/, "");
    if (!baseUrl) {
      throw new DispatchConfigError("AutoCab base URL is not configured.");
    }
    const subscriptionKey = await deps.loadAutoCabKey(tenantId);
    if (!subscriptionKey) {
      throw new DispatchConfigError("AutoCab subscription key is not configured.");
    }
    return { adapter: "autocab", companyId, autoCab: { baseUrl, subscriptionKey } };
  }

  // Stub adapters need no AutoCab secret.
  return { adapter: t.dispatchAdapter, companyId, autoCab: null };
}

/**
 * Returns the DispatchAdapter for a tenant. AutoCab is fully wired; iCabbi and
 * Cordic return stubs that throw DispatchNotImplementedError on use (PRD §7.6.2/3).
 */
export async function getDispatchAdapter(
  tenantId: string,
  deps: DispatchDeps = defaultDeps,
): Promise<DispatchAdapter> {
  const config = await loadDispatchConfig(tenantId, deps);
  switch (config.adapter) {
    case "autocab": {
      if (!config.autoCab) {
        throw new DispatchConfigError("AutoCab config missing.");
      }
      return new AutoCabAdapter(config.autoCab);
    }
    case "icabbi":
      return new ICabbiAdapter();
    case "cordic":
      return new CordicAdapter();
    default:
      throw new DispatchConfigError("Unknown dispatch adapter for this account.");
  }
}
