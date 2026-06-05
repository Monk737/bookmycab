"use client";

import React from "react";

// palette: blue-800 primary, gray-400 muted, gray-600 text
const COLOR_BAR = "#0a0a0a"; // blue-800
const COLOR_MUTED = "#6f6f6b"; // gray-400
const COLOR_TEXT = "#4f4f4c"; // gray-600

export function FunnelChart({
  data,
}: {
  data: { stage: string; count: number; pct: number }[];
}): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div
        style={{ height: 256 }}
        className="flex items-center justify-center text-sm text-gray-400"
      >
        No data for this period.
      </div>
    );
  }

  const maxCount = data[0]?.count ?? 1;

  return (
    <div
      role="list"
      aria-label="Funnel stages"
      className="flex flex-col gap-2 py-2"
    >
      {data.map((row, i) => {
        const widthPct = maxCount > 0 ? Math.round((row.count / maxCount) * 100) : 0;
        const isFirst = i === 0;
        const dropOff = isFirst ? null : row.pct;

        return (
          <div key={row.stage} role="listitem" className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span
                className="font-medium"
                style={{ color: COLOR_TEXT }}
              >
                {row.stage}
              </span>
              <span style={{ color: COLOR_MUTED }}>
                {row.count.toLocaleString()}
                {dropOff !== null && (
                  <span className="ml-2" style={{ color: "#6f6f6b" }}>
                    {dropOff}%
                  </span>
                )}
              </span>
            </div>
            <div
              className="rounded"
              style={{
                height: 16,
                width: "100%",
                backgroundColor: "#dcdcda",
                position: "relative",
                overflow: "hidden",
              }}
              aria-label={`${row.stage}: ${row.count}`}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${widthPct}%`,
                  backgroundColor: COLOR_BAR,
                  opacity: isFirst ? 1 : 0.55 + 0.45 * (widthPct / 100),
                  borderRadius: 4,
                  transition: "width 300ms ease",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
