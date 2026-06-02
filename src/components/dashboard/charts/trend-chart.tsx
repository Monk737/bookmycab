"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Data palette: current = blue-800 (#1e40af), previous = slate-400 (#94a3b8)
const COLOR_CURRENT = "#1e40af";
const COLOR_PREVIOUS = "#94a3b8";
const COLOR_GRID = "#94a3b8";

export function TrendChart({
  data,
}: {
  data: { label: string; current: number; previous: number }[];
}): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div
        style={{ height: 256 }}
        className="flex items-center justify-center text-sm text-slate-400"
      >
        No data for this period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLOR_GRID} opacity={0.3} />
        <XAxis
          dataKey="label"
          tick={{ fill: COLOR_GRID, fontSize: 12 }}
          axisLine={{ stroke: COLOR_GRID, opacity: 0.4 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: COLOR_GRID, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: 8,
            color: "#f1f5f9",
            fontSize: 12,
          }}
          cursor={{ stroke: COLOR_GRID, strokeWidth: 1 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: COLOR_GRID }}
        />
        <Line
          type="monotone"
          dataKey="current"
          stroke={COLOR_CURRENT}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          name="Current"
        />
        <Line
          type="monotone"
          dataKey="previous"
          stroke={COLOR_PREVIOUS}
          strokeWidth={2}
          strokeDasharray="5 3"
          dot={false}
          activeDot={{ r: 4 }}
          name="Previous"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
