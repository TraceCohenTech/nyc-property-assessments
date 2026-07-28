"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";

export type ZipRow = { zip: string; borough: string; n: number; p10: number; p25: number; median: number; p75: number; p90: number };

export function ZipSqftTable({ rows }: { rows: ZipRow[] }) {
  const columns: DataTableColumn<ZipRow>[] = [
    { key: "zip", label: "Zip", sortable: false, render: (r) => <span className="font-semibold text-slate-900">{r.zip}</span> },
    { key: "borough", label: "Borough", sortable: false, render: (r) => r.borough },
    { key: "n", label: "Lots (n)", align: "right", sortable: true, sortValue: (r) => r.n, render: (r) => r.n.toLocaleString() },
    { key: "p10", label: "p10", align: "right", sortable: true, sortValue: (r) => r.p10, render: (r) => `$${r.p10.toFixed(0)}` },
    { key: "median", label: "Median", align: "right", sortable: true, sortValue: (r) => r.median, render: (r) => <span className="font-semibold text-blue-700">${r.median.toFixed(0)}</span> },
    { key: "p90", label: "p90", align: "right", sortable: true, sortValue: (r) => r.p90, render: (r) => `$${r.p90.toFixed(0)}` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-slate-900">$/sqft by zip code</h2>
        <ExportButton
          rows={rows.map((r) => ({ zip: r.zip, borough: r.borough, n: r.n, p10: r.p10, p25: r.p25, median: r.median, p75: r.p75, p90: r.p90 }))}
          filename="nyc-price-per-sqft-by-zip.csv"
        />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.zip} initialSortKey="median" initialSortDesc />
    </div>
  );
}
