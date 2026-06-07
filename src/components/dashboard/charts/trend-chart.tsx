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

// Data palette: current = ink (#0a0a0a), previous = gray-500 (#6f6f6b)
const COLOR_CURRENT = "#0a0a0a";
const COLOR_PREVIOUS = "#6f6f6b";
const COLOR_GRID = "#6f6f6b";

export function TrendChart({
  data,
}: {
  data: { label: string; current: number; previous: number }[];
}): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div
        style={{ height: 256 }}
        className="flex items-center justify-center text-sm font-medium text-gray-500"
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
            backgroundColor: "#0a0a0a",
            border: "2px solid #ffffff",
            borderRadius: 0,
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 600,
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
