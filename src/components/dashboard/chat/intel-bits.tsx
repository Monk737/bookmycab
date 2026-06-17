/** Pure presentational bits for Chat Intelligence — safe in server and client trees. */

/** A horizontal proportion bar with a label and a value. */
export function Bar({ label, value, count, max, fill }: { label: string; value: string; count: number; max: number; fill: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">{label}</p>
        <span className="mt-1 block h-2.5 border-2 border-ink bg-paper">
          <span className={`block h-full ${fill}`} style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
        </span>
      </div>
      <span className="shrink-0 text-right font-mono text-xs font-bold tabular-nums text-ink">{value}</span>
    </div>
  );
}

/** A fixed (non-searchable) bar list inside a Panel. */
export function BarList({ rows, fill, emptyLabel }: { rows: { key: string; label: string; value: string; count: number }[]; fill: string; emptyLabel: string }) {
  if (rows.length === 0) return <p className="text-sm text-gray-600">{emptyLabel}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <Bar label={r.label} value={r.value} count={r.count} max={max} fill={fill} />
        </li>
      ))}
    </ul>
  );
}
