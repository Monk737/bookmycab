// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";

function fakeSupabase() {
  const handlers: Array<(p: unknown) => void> = [];
  const channelObj = {
    on: vi.fn(function (this: unknown, _evt: string, _cfg: unknown, cb: (p: unknown) => void) {
      handlers.push(cb);
      return channelObj;
    }),
    subscribe: vi.fn(() => channelObj),
  };
  const supabase = { channel: vi.fn(() => channelObj), removeChannel: vi.fn() };
  return { supabase, channelObj, handlers };
}

describe("useRealtimeChannel", () => {
  it("subscribes on mount and removes the channel on unmount", () => {
    const { supabase, channelObj } = fakeSupabase();
    const { unmount } = renderHook(() =>
      useRealtimeChannel(
        { channelName: "bookings:automation_id=a1", table: "bookings", event: "INSERT", filter: "automation_id=eq.a1" },
        () => {},
        supabase as never,
      ),
    );
    expect(supabase.channel).toHaveBeenCalledWith("bookings:automation_id=a1");
    expect(channelObj.subscribe).toHaveBeenCalledTimes(1);
    unmount();
    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("invokes the callback with payload.new when a change arrives", () => {
    const { supabase, handlers } = fakeSupabase();
    const onChange = vi.fn();
    renderHook(() =>
      useRealtimeChannel(
        { channelName: "c", table: "bookings", event: "INSERT", filter: "automation_id=eq.a1" },
        onChange,
        supabase as never,
      ),
    );
    handlers[0]?.({ new: { id: "b1" } });
    expect(onChange).toHaveBeenCalledWith({ id: "b1" });
  });
});
