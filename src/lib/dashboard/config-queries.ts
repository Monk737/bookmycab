import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseLike } from "@/lib/dashboard/queries";
import type { AutomationConfig, AutomationConfigInput } from "@/lib/dashboard/config-types";

export async function getAutomationConfig(automationId: string, client?: SupabaseLike): Promise<AutomationConfig> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from("automation_config")
    .select("automation_id, welcome_messages, vehicle_types, service_area, opening_hours, brand_colours, languages, ask_driver_note, updated_at")
    .eq("automation_id", automationId)
    .maybeSingle();

  if (!data) {
    return {
      automationId,
      welcome_messages: {},
      vehicle_types: [],
      service_area: null,
      opening_hours: {},
      brand_colours: {},
      languages: ["en"],
      ask_driver_note: false,
      updatedAt: null,
    };
  }

  const r = data as Record<string, unknown>;
  return {
    automationId: r.automation_id as string,
    welcome_messages: (r.welcome_messages as Record<string, string>) ?? {},
    vehicle_types: (r.vehicle_types as string[]) ?? [],
    service_area: (r.service_area as string | null) ?? null,
    opening_hours: (r.opening_hours as Record<string, [string, string][]>) ?? {},
    brand_colours: (r.brand_colours as { primary?: string; secondary?: string }) ?? {},
    languages: (r.languages as string[]) ?? ["en"],
    ask_driver_note: (r.ask_driver_note as boolean) ?? false,
    updatedAt: (r.updated_at as string | null) ?? null,
  };
}

export async function upsertAutomationConfig(
  automationId: string,
  tenantId: string,
  patch: AutomationConfigInput,
  userId: string | null,
  client?: SupabaseLike,
): Promise<boolean> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase
    .from("automation_config")
    .upsert(
      {
        automation_id: automationId,
        tenant_id: tenantId,
        ...patch,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "automation_id" },
    );
  return !error;
}
