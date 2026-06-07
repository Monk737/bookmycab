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
 * Typed, server-render-friendly presentational table, brutalist: ink frame,
 * hard shadow, ink-ruled header, zebra rows, yellow hover. No client sorting.
 *
 * `getRowKey` yields a stable key per row; `getRowHref` (optional) makes the
 * whole row a link target, the first cell wraps its content in an anchor so
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
    <div className="overflow-hidden border-[3px] border-ink bg-paper shadow-brut">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-[3px] border-ink bg-ink">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-paper ${col.headerClassName ?? ""}`}
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
                className="px-4 py-10 text-center text-sm font-medium text-gray-500"
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
                  className="border-b-2 border-gray-200 last:border-0 odd:bg-paper even:bg-gray-50 transition-colors duration-150 hover:bg-brut-yellow"
                >
                  {columns.map((col, i) => {
                    const content = col.render(row);
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 align-middle font-medium text-gray-700 ${col.cellClassName ?? ""}`}
                      >
                        {href && i === 0 ? (
                          <a
                            href={href}
                            className="font-bold text-ink underline-offset-2 outline-none hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink"
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
