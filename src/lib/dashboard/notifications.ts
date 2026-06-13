import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NotifItem } from "@/components/dashboard/notification-bell";

/**
 * Recent activity to seed the tenant notification bell on load, so it isn't
 * empty before the next realtime event arrives. Read via the RLS-scoped server
 * client (the tenant only ever sees its own rows). Backfilled items are marked
 * read; only live realtime events afterwards show as unread.
 */
export async function getRecentNotifications(tenantId: string): Promise<NotifItem[]> {
  const sb = await createClient();
  const [{ data: bookings }, { data: calls }] = await Promise.all([
    sb.from("bookings").select("id, status, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(8),
    sb.from("calls").select("id, outcome, caller_number, started_at").eq("tenant_id", tenantId).order("started_at", { ascending: false }).limit(8),
  ]);

  const items: NotifItem[] = [
    ...((bookings ?? []) as Array<{ id: string; status: string | null; created_at: string | null }>).map((b) => ({
      id: `b-${b.id}`,
      kind: "booking_new" as const,
      title: "Booking",
      detail: b.status ? `Status: ${b.status}` : "Confirmed to dispatch",
      ts: b.created_at ?? new Date().toISOString(),
      read: true,
    })),
    ...((calls ?? []) as Array<{ id: string; outcome: string | null; caller_number: string | null; started_at: string | null }>).map((c) => {
      const o = (c.outcome ?? "").toLowerCase();
      const transferred = o === "transferred";
      return {
        id: `c-${c.id}`,
        kind: (transferred ? "call_transferred" : "call_new") as NotifItem["kind"],
        title: transferred ? "Call transferred" : "Call handled",
        detail: [c.caller_number, o ? `outcome: ${o}` : null].filter(Boolean).join(" · ") || "Voice call",
        ts: c.started_at ?? new Date().toISOString(),
        read: true,
      };
    }),
  ]
    .sort((x, y) => (x.ts < y.ts ? 1 : -1))
    .slice(0, 12);

  return items;
}
