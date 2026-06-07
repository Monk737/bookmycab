"use client";

import { useEffect } from "react";

/**
 * Layout-level marketing client effects, mounted once (the marketing layout
 * persists across route changes):
 *   1. Console easter egg for the curious dev who opens the inspector.
 *   2. Once-per-session gate for the hero load entrance, so the first page in a
 *      session gets the choreography and later navigations feel instant.
 */
export function ConsoleEgg() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __bmcEgg?: boolean };
    if (w.__bmcEgg) return;
    w.__bmcEgg = true;

    const yellow = "background:#ffd400;color:#0a0a0a;font-weight:800;padding:2px 8px";
    const ink = "color:#0a0a0a;font-weight:600";
    /* eslint-disable no-console */
    console.log("%cBookMyCab", yellow);
    console.log(
      "%cReading the source? Good instinct. We build booking bots for cab firms, and we hire people who open the console.\nhello@bookmycab.com",
      ink,
    );
    /* eslint-enable no-console */
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let seen = false;
    try {
      seen = window.sessionStorage.getItem("bmc-entered") === "1";
    } catch {
      seen = false;
    }
    // Already entered this session: suppress hero entrances immediately.
    if (seen) {
      document.documentElement.classList.add("no-hero-rise");
      return;
    }
    // First page this session: let it play, then gate every later navigation.
    const t = window.setTimeout(() => {
      document.documentElement.classList.add("no-hero-rise");
      try {
        window.sessionStorage.setItem("bmc-entered", "1");
      } catch {
        /* ignore */
      }
    }, 1100);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
