"use client";

import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { formatNumber, formatPct } from "@/lib/format";

export type ZipStabRow = { zip: string; structural_candidates: number; hcr_registered: number; stabilized_share: number };

export function StabilizedByZipTable({ rows }: { rows: ZipStabRow[] }) {
  const columns: DataTableColumn<ZipStabRow>[] = [
    { key: "zip", label: "Zip", sortable: false, render: (r) => <span className="font-semibold text-slate-900">{r.zip}</span> },
    {
      key: "structural_candidates",
      label: "Structural candidates",
      align: "right",
      sortable: true,
      sortValue: (r) => r.structural_candidates,
      render: (r) => formatNumber(r.structural_candidates),
    },
    {
      key: "hcr_registered",
      label: "HCR-registered",
      align: "right",
      sortable: true,
      sortValue: (r) => r.hcr_registered,
      render: (r) => formatNumber(r.hcr_registered),
    },
    {
      key: "stabilized_share",
      label: "Stabilized share",
      align: "right",
      sortable: true,
      sortValue: (r) => r.stabilized_share,
      render: (r) => <span className="font-semibold text-blue-700">{formatPct(r.stabilized_share, 1)}</span>,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3 className="font-bold text-slate-900">By zip code</h3>
        <ExportButton
          rows={rows.map((r) => ({ zip: r.zip, structural_candidates: r.structural_candidates, hcr_registered: r.hcr_registered, stabilized_share: r.stabilized_share }))}
          filename="nyc-rent-stabilized-share-by-zip.csv"
        />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.zip} initialSortKey="stabilized_share" initialSortDesc />
    </div>
  );
}
