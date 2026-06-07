"use client";

import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  PALETTE,
  AXIS,
  TOOLTIP_STYLE,
} from "@/lib/dashboard/chart-colors";

export function DonutChart({
  data,
}: {
  data: { name: string; value: number }[];
}): React.JSX.Element {
  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  if (!hasData) {
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
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={PALETTE[index % PALETTE.length]}
              stroke="#0a0a0a"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12, color: AXIS }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
