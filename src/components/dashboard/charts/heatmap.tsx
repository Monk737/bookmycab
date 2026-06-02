"use client";

import React from "react";
import type { HeatmapCell } from "@/lib/dashboard/analytics-types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// blue-800 tint for heat cells
const CELL_R = 30;
const CELL_G = 64;
const CELL_B = 175;

const COLOR_MUTED = "#94a3b8"; // slate-400 — axis text
const COLOR_BORDER = "#e2e8f0"; // slate-200 — cell border

function cellBackground(value: number, maxValue: number): string {
  if (maxValue === 0) return `rgba(${CELL_R},${CELL_G},${CELL_B},0.05)`;
  const alpha = 0.08 + 0.82 * (value / maxValue);
  return `rgba(${CELL_R},${CELL_G},${CELL_B},${alpha.toFixed(2)})`;
}

export function Heatmap({ cells }: { cells: HeatmapCell[] }): React.JSX.Element {
  const allZero = cells.every((c) => c.value === 0);

  if (allZero) {
    return (
      <div
        style={{ height: 256 }}
        className="flex items-center justify-center text-sm text-slate-400"
      >
        No data for this period.
      </div>
    );
  }

  const maxValue = Math.max(...cells.map((c) => c.value), 1);

  // Build lookup: day (0-6) × hour (0-23) → value
  const grid: number[][] = Array.from({ length: 7 }, () =>
    new Array<number>(24).fill(0)
  );
  for (const cell of cells) {
    if (cell.day >= 0 && cell.day < 7 && cell.hour >= 0 && cell.hour < 24) {
      grid[cell.day][cell.hour] = cell.value;
    }
  }

  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      <table
        aria-label="Booking volume heatmap by day and hour"
        style={{
          borderCollapse: "collapse",
          fontSize: 11,
          minWidth: "max-content",
          width: "100%",
        }}
      >
        <thead>
          <tr>
            {/* corner cell */}
            <th scope="col" style={{ width: 36, minWidth: 36 }} />
            {HOURS.map((h) => (
              <th
                key={h}
                scope="col"
                style={{
                  color: COLOR_MUTED,
                  fontWeight: 400,
                  textAlign: "center",
                  padding: "0 1px 4px",
                  minWidth: 22,
                  width: 22,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((day, dayIndex) => (
            <tr key={day}>
              <th
                scope="row"
                style={{
                  color: COLOR_MUTED,
                  fontWeight: 400,
                  textAlign: "right",
                  paddingRight: 6,
                  whiteSpace: "nowrap",
                }}
              >
                {day}
              </th>
              {HOURS.map((h) => {
                const val = grid[dayIndex][h];
                return (
                  <td
                    key={h}
                    title={`${day} ${h}:00 — ${val}`}
                    aria-label={`${day} ${h}:00: ${val}`}
                    style={{
                      backgroundColor: cellBackground(val, maxValue),
                      border: `1px solid ${COLOR_BORDER}`,
                      height: 20,
                      width: 22,
                      textAlign: "center",
                      cursor: "default",
                    }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs" style={{ color: COLOR_MUTED }}>
        <span>Low</span>
        <div
          style={{
            display: "flex",
            gap: 2,
          }}
          aria-hidden
        >
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((alpha) => (
            <div
              key={alpha}
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                backgroundColor: `rgba(${CELL_R},${CELL_G},${CELL_B},${alpha})`,
                border: `1px solid ${COLOR_BORDER}`,
              }}
            />
          ))}
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
