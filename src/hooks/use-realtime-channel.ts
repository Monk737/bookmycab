"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";

interface RealtimeChannelLike {
  on: (evt: "postgres_changes", cfg: Record<string, unknown>, cb: (payload: { new: unknown }) => void) => RealtimeChannelLike;
  subscribe: () => RealtimeChannelLike;
}

type SupabaseLike = {
  channel: (name: string) => RealtimeChannelLike;
  removeChannel: (ch: RealtimeChannelLike) => void;
};

export interface RealtimeOptions {
  channelName: string;
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  schema?: string;
}

/**
 * Subscribes to one Realtime channel and tears it down on unmount (PRD §11:
 * one channel per automation view, never org-wide). `onChange` receives
 * `payload.new`. `client` is injectable for tests; defaults to the browser client.
 */
export function useRealtimeChannel(
  options: RealtimeOptions,
  onChange: (row: unknown) => void,
  client?: SupabaseLike,
): void {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    const supabase = client ?? (createClient() as unknown as SupabaseLike);
    const channel = supabase.channel(options.channelName);
    channel
      .on(
        "postgres_changes",
        { event: options.event, schema: options.schema ?? "public", table: options.table, filter: options.filter },
        (payload) => cb.current(payload.new),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.channelName, options.table, options.event, options.filter, options.schema]);
}
