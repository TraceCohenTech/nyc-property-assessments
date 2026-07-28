"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export type DataTableColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
  /** Value used for sorting when different from the rendered node (e.g. raw number vs. formatted string). */
  sortValue?: (row: T) => number | string;
  /** Shown in the mobile card layout; defaults to `label`. */
  cardLabel?: string;
};

/**
 * Sortable data table that degrades to a stacked-card layout below `sm`. Pass `rowKey` to
 * uniquely identify rows for React keys. Sorting is client-side only — for large arrays,
 * pre-slice/paginate before passing `rows`.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  initialSortKey,
  initialSortDesc = true,
  emptyMessage = "No results.",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  initialSortKey?: string;
  initialSortDesc?: boolean;
  emptyMessage?: string;
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(initialSortKey);
  const [desc, setDesc] = useState(initialSortDesc);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const getVal = col.sortValue ?? col.render;
    return [...rows].sort((a, b) => {
      const va = getVal(a) as unknown;
      const vb = getVal(b) as unknown;
      const na = typeof va === "number" ? va : parseFloat(String(va).replace(/[^0-9.-]/g, "")) || 0;
      const nb = typeof vb === "number" ? vb : parseFloat(String(vb).replace(/[^0-9.-]/g, "")) || 0;
      return desc ? nb - na : na - nb;
    });
  }, [rows, sortKey, desc, columns]);

  function toggleSort(key: string) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 py-8 text-center">{emptyMessage}</p>;
  }

  return (
    <div>
      {/* Desktop / tablet table */}
      <div className="hidden sm:block overflow-x-auto -mx-2 px-2">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              {columns.map((c) => (
                <th key={c.key} className={`py-2 pr-3 ${c.align === "right" ? "text-right" : ""}`}>
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 min-h-[32px] hover:text-blue-600 active:scale-[0.97]"
                      aria-label={`Sort by ${c.label}`}
                    >
                      {c.label}
                      {sortKey === c.key &&
                        (desc ? <ArrowDown className="h-3 w-3" aria-hidden="true" /> : <ArrowUp className="h-3 w-3" aria-hidden="true" />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={rowKey(row)} className="border-b border-slate-100 hover:bg-blue-50/30">
                {columns.map((c) => (
                  <td key={c.key} className={`py-2 pr-3 text-slate-700 ${c.align === "right" ? "text-right tabular-nums" : ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="sm:hidden space-y-3">
        {sorted.map((row) => (
          <div key={rowKey(row)} className="rounded-xl border border-slate-200 p-3">
            {columns.map((c) => (
              <div key={c.key} className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
                <span className="text-xs text-slate-500 shrink-0">{c.cardLabel ?? c.label}</span>
                <span className="text-slate-900 font-medium text-right">{c.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
