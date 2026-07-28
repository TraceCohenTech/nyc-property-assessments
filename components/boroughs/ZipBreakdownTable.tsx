"use client";

import Link from "next/link";
import { formatNumber, formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import type { BoroughProfile } from "@/lib/types";

type ZipRow = BoroughProfile["zip_breakdown"][number];

export function ZipBreakdownTable({ rows, borough }: { rows: ZipRow[]; borough: string }) {
  const columns: DataTableColumn<ZipRow>[] = [
    {
      key: "zip",
      label: "Zip",
      sortable: false,
      render: (r) => (
        <Link href={`/explorer?zip=${encodeURIComponent(r.zip)}`} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
          {r.zip}
        </Link>
      ),
    },
    { key: "count", label: "Lots", align: "right", sortable: true, sortValue: (r) => r.count, render: (r) => formatNumber(r.count) },
    {
      key: "total_market_value",
      label: "Market value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_market_value,
      render: (r) => formatUSDFull(r.total_market_value),
    },
    {
      key: "total_assessed_value",
      label: "Assessed value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_assessed_value,
      render: (r) => formatUSDFull(r.total_assessed_value),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-slate-900">{rows.length} zip codes in {borough}</h2>
        <ExportButton
          rows={rows.map((r) => ({ zip: r.zip, lots: r.count, total_market_value: r.total_market_value, total_assessed_value: r.total_assessed_value }))}
          filename={`${borough.toLowerCase().replace(/\s+/g, "-")}-zip-breakdown.csv`}
        />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.zip} initialSortKey="count" initialSortDesc />
    </div>
  );
}
