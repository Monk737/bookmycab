import type { ReactNode } from "react";

/**
 * Column definition for {@link DataTable}.
 *
 * `render` maps a row to cell content. `headerClassName`/`cellClassName` allow
 * per-column alignment (e.g. right-aligned numerics).
 */
export type Column<Row> = {
  /** Stable key, used as the React key for cells in this column. */
  key: string;
  /** Column header label. */
  header: ReactNode;
  /** Cell renderer for a given row. */
  render: (row: Row) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

/**
 * Typed, server-render-friendly presentational table using the dashboard
 * (blue/slate) palette. No client sorting or pagination.
 *
 * `getRowKey` yields a stable key per row; `getRowHref` (optional) makes the
 * whole row a link target — the first cell wraps its content in an anchor so
 * the row is keyboard-accessible without nesting interactive elements.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  getRowHref,
  emptyMessage = "No records.",
}: {
  columns: Column<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  getRowHref?: (row: Row) => string;
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-wider text-gray-500 ${col.headerClassName ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const href = getRowHref?.(row);
              return (
                <tr
                  key={getRowKey(row)}
                  className="border-b border-gray-100 last:border-0 odd:bg-white even:bg-gray-50/40 transition-colors duration-150 hover:bg-blue-50/50"
                >
                  {columns.map((col, i) => {
                    const content = col.render(row);
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 align-middle text-gray-700 ${col.cellClassName ?? ""}`}
                      >
                        {href && i === 0 ? (
                          <a
                            href={href}
                            className="font-medium text-gray-900 underline-offset-2 outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-blue-800"
                          >
                            {content}
                          </a>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
