import "server-only";
import { NextResponse } from "next/server";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import type { NotifItem } from "@/components/dashboard/notification-bell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recent platform activity for the admin notification bell. Staff-gated and read
 * via the service-role client (admin spans every tenant; RLS would otherwise
 * hide cross-tenant rows, and browser Realtime can't see them under a staff
 * JWT). Polled by the client every ~30s. Returns the newest provisioning events
 * (new tenants, new automations) merged and sorted, capped at 30.
 */
export async function GET() {
  await requireStaff();
  const db = createSupabaseJS(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const [{ data: tenants }, { data: autos }, { data: prompts }] = await Promise.all([
    db.from("tenants").select("id, name, created_at").order("created_at", { ascending: false }).limit(15),
    db.from("automations").select("id, name, type, created_at").order("created_at", { ascending: false }).limit(15),
    db
      .from("prompt_suggestions")
      .select("id, reason, requested_at, tenants(name), voice_agents(display_name)")
      .eq("status", "requested")
      .order("requested_at", { ascending: false })
      .limit(15),
  ]);

  const items: NotifItem[] = [
    ...((tenants ?? []) as Array<{ id: string; name: string; created_at: string | null }>).map((t) => ({
      id: `tenant-${t.id}`,
      kind: "tenant_new" as const,
      title: "New tenant provisioned",
      detail: t.name,
      ts: t.created_at ?? new Date().toISOString(),
      read: false,
    })),
    ...((autos ?? []) as Array<{ id: string; name: string; type: string | null; created_at: string | null }>).map((a) => ({
      id: `auto-${a.id}`,
      kind: "automation_new" as const,
      title: "New automation added",
      detail: [a.name, a.type].filter(Boolean).join(" · "),
      ts: a.created_at ?? new Date().toISOString(),
      read: false,
    })),
    ...((prompts ?? []) as unknown as Array<{ id: string; reason: string; requested_at: string | null; tenants?: { name: string } | null; voice_agents?: { display_name: string } | null }>).map((p) => ({
      id: `prompt-${p.id}`,
      kind: "prompt_request" as const,
      title: "Prompt-tuning request",
      detail: [p.tenants?.name, p.voice_agents?.display_name, p.reason].filter(Boolean).join(" · "),
      ts: p.requested_at ?? new Date().toISOString(),
      read: false,
    })),
  ]
    .sort((x, y) => (x.ts < y.ts ? 1 : -1))
    .slice(0, 30);

  return NextResponse.json({ items });
}
