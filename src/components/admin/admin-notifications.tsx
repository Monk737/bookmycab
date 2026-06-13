"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationBell, type NotifItem } from "@/components/dashboard/notification-bell";

/**
 * Admin notification bell. Polls /admin/api/notifications (~30s) for recent
 * platform activity (new tenants, new automations) since browser Realtime can't
 * read cross-tenant rows under a staff JWT. The first load is marked read so the
 * operator isn't flooded with history; anything new that appears afterwards
 * arrives unread.
 */
export function AdminNotifications() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/admin/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: NotifItem[] };
      setItems((prev) => {
        const readById = new Map(prev.map((p) => [p.id, p.read]));
        const next = data.items.map((it) => {
          const known = seen.current.has(it.id);
          // Existing item keeps its read flag; brand-new items are unread,
          // except on the very first load where all history starts read.
          const read = known ? (readById.get(it.id) ?? true) : firstLoad.current ? true : false;
          return { ...it, read };
        });
        for (const it of data.items) seen.current.add(it.id);
        firstLoad.current = false;
        return next;
      });
    } catch {
      // best-effort; a failed poll just keeps the current list
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const markAllRead = useCallback(() => setItems((prev) => prev.map((i) => ({ ...i, read: true }))), []);

  return <NotificationBell items={items} onMarkAllRead={markAllRead} />;
}
