"use client";

import { useCallback, useState } from "react";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { NotificationBell, type NotifItem, type NotifKind } from "./notification-bell";

function rowStr(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

/**
 * Live tenant notifications. Subscribes to this tenant's bookings and calls via
 * Supabase Realtime and surfaces new bookings, booking changes and transferred
 * calls in the notification bell. Read-only and self-tearing-down (one channel
 * per stream, scoped to the tenant by an RLS-safe filter).
 */
export function TenantNotifications({ tenantId, onDark = false }: { tenantId: string; onDark?: boolean }) {
  const [items, setItems] = useState<NotifItem[]>([]);

  const push = useCallback((it: Omit<NotifItem, "read">) => {
    setItems((prev) => [{ ...it, read: false }, ...prev].slice(0, 40));
  }, []);

  const filter = `tenant_id=eq.${tenantId}`;

  // New booking.
  useRealtimeChannel(
    { channelName: `notif-bookings-new-${tenantId}`, table: "bookings", event: "INSERT", filter },
    useCallback((row: unknown) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const route = [rowStr(r, ["pickup_text", "pickup_address", "pickup"]), rowStr(r, ["dropoff_text", "dropoff_address", "destination"])].filter(Boolean).join(" → ");
      push({
        id: `b-${String(r.id ?? Date.now())}`,
        kind: "booking_new",
        title: "New booking",
        detail: route || rowStr(r, ["passenger_name", "customer_name", "dispatch_ref"]) || "A new booking just came in.",
        ts: rowStr(r, ["created_at", "pickup_at"]) ?? new Date().toISOString(),
      });
    }, [push]),
  );

  // Booking modified (status / details changed).
  useRealtimeChannel(
    { channelName: `notif-bookings-upd-${tenantId}`, table: "bookings", event: "UPDATE", filter },
    useCallback((row: unknown) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const status = rowStr(r, ["status"]);
      push({
        id: `bu-${String(r.id ?? Date.now())}-${Date.now()}`,
        kind: "booking_modified",
        title: "Booking updated",
        detail: status ? `Status is now ${status}.` : "A booking was modified.",
        ts: rowStr(r, ["updated_at", "created_at"]) ?? new Date().toISOString(),
      });
    }, [push]),
  );

  // New / transferred call.
  useRealtimeChannel(
    { channelName: `notif-calls-new-${tenantId}`, table: "calls", event: "INSERT", filter },
    useCallback((row: unknown) => {
      const r = (row ?? {}) as Record<string, unknown>;
      const outcome = (rowStr(r, ["outcome"]) ?? "").toLowerCase();
      const transferred = outcome === "transferred";
      const caller = rowStr(r, ["caller_number"]);
      const kind: NotifKind = transferred ? "call_transferred" : "call_new";
      push({
        id: `c-${String(r.id ?? Date.now())}`,
        kind,
        title: transferred ? "Call transferred" : "Call handled",
        detail: [caller, outcome ? `outcome: ${outcome}` : null].filter(Boolean).join(" · ") || "Your AI Voice agent took a call.",
        ts: rowStr(r, ["started_at", "created_at"]) ?? new Date().toISOString(),
      });
    }, [push]),
  );

  const markAllRead = useCallback(() => setItems((prev) => prev.map((i) => ({ ...i, read: true }))), []);

  return <NotificationBell items={items} onMarkAllRead={markAllRead} onDark={onDark} />;
}
