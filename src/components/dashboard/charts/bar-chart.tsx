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
import {
  PRIMARY,
  GRID as COLOR_GRID,
  AXIS,
  TOOLTIP_STYLE,
} from "@/lib/dashboard/chart-colors";

const COLOR_BAR = PRIMARY;

export function BarChart({
  data,
}: {
  data: { name: string; value: number }[];
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
      <RBarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={COLOR_GRID}
          opacity={0.3}
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fill: AXIS, fontSize: 12 }}
          axisLine={{ stroke: COLOR_GRID, opacity: 0.4 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: AXIS, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: COLOR_GRID, opacity: 0.2 }}
        />
        <Bar dataKey="value" fill={COLOR_BAR} radius={[0, 0, 0, 0]} stroke="#0a0a0a" strokeWidth={1.5} name="Value" />
      </RBarChart>
    </ResponsiveContainer>
  );
}
