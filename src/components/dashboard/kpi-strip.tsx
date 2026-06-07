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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="border-[3px] border-ink bg-paper px-5 py-4 shadow-brut-sm"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
            {item.label}
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-ink">
            {item.value}
          </p>
          {item.sub != null && (
            <p className="mt-0.5 text-xs font-medium text-gray-500">{item.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
