"use client";

import type React from "react";

/**
 * Sticky top banner shown during demo sessions.
 * Amber palette — visually distinct from the blue dashboard chrome.
 */
export function DemoBanner(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm"
    >
      <span aria-hidden="true">👁</span>
      Demo — read only. Changes are disabled and data resets every 24 hours.
    </div>
  );
}
