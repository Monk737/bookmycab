"use client";

import React from "react";
import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Data palette: bar fill = blue-600
const COLOR_BAR = "#2563eb"; // blue-600
const COLOR_GRID = "#94a3b8"; // slate-400

export function BarChart({
  data,
}: {
  data: { name: string; value: number }[];
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
      <RBarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={COLOR_GRID}
          opacity={0.3}
          vertical={false}
        />
        <XAxis
          dataKey="name"
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
          cursor={{ fill: COLOR_GRID, opacity: 0.1 }}
        />
        <Bar dataKey="value" fill={COLOR_BAR} radius={[4, 4, 0, 0]} name="Value" />
      </RBarChart>
    </ResponsiveContainer>
  );
}
