import type React from "react";

export interface KpiItem {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}

export function KpiStrip({
  items,
}: {
  items: KpiItem[];
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-shadow duration-150 hover:shadow-md"
        >
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-600">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
            {item.value}
          </p>
          {item.sub != null && (
            <p className="mt-0.5 text-xs text-gray-500">{item.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
