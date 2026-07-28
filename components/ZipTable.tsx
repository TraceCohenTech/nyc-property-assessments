"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { formatUSDFull, formatNumber } from "@/lib/format";

type ZipRow = {
  zip: string;
  borough: string;
  count: number;
  total_market_value: number;
  total_assessed_value: number;
  avg_market_value: number;
  top_bldg_class_letter: string;
};

type SortKey = "count" | "avg_market_value" | "total_market_value";

const COLS: { key: SortKey; label: string }[] = [
  { key: "count", label: "Properties" },
  { key: "avg_market_value", label: "Avg market value" },
  { key: "total_market_value", label: "Total market value" },
];

export function ZipTable({ zips }: { zips: ZipRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [desc, setDesc] = useState(true);
  const [limit, setLimit] = useState(25);

  const sorted = useMemo(() => {
    const arr = [...zips].sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return arr.slice(0, limit);
  }, [zips, sortKey, desc, limit]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  }

  return (
    <div>
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-3">Zip</th>
              <th className="py-2 pr-3">Borough</th>
              {COLS.map((c) => (
                <th key={c.key} className="py-2 pr-3 text-right">
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
                </th>
              ))}
              <th className="py-2 pr-3">Top bldg class</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((z) => (
              <tr key={z.zip} className="border-b border-slate-100 hover:bg-blue-50/30">
                <td className="py-2 pr-3 font-semibold text-slate-900 tabular-nums">{z.zip}</td>
                <td className="py-2 pr-3 text-slate-700">{z.borough}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatNumber(z.count)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatUSDFull(z.avg_market_value)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatUSDFull(z.total_market_value)}</td>
                <td className="py-2 pr-3 text-slate-500">{z.top_bldg_class_letter || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit < zips.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + 25)}
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-md text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-[0.97]"
          >
            Show 25 more zips ({zips.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
