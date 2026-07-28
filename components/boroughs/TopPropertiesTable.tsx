"use client";

import Link from "next/link";
import { formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import type { BoroughProfile } from "@/lib/types";

type PropRow = BoroughProfile["top_properties"][number];

export function TopPropertiesTable({ rows, borough }: { rows: PropRow[]; borough: string }) {
  const columns: DataTableColumn<PropRow>[] = [
    { key: "rank", label: "#", sortable: false, render: (r) => rows.indexOf(r) + 1 },
    {
      key: "bbl",
      label: "BBL",
      sortable: false,
      render: (r) => (
        <Link href={`/properties/${r.bbl}`} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline tabular-nums">
          {r.bbl}
        </Link>
      ),
    },
    { key: "owner_display", label: "Owner", sortable: false, render: (r) => r.owner_display },
    { key: "building_class", label: "Bldg class", sortable: false, render: (r) => r.building_class || "—" },
    {
      key: "market_value",
      label: "Market value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.market_value,
      render: (r) => formatUSDFull(r.market_value),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-slate-900">Top {rows.length} properties in {borough}</h2>
        <ExportButton
          rows={rows.map((r, i) => ({ rank: i + 1, bbl: r.bbl, owner: r.owner_display, building_class: r.building_class, market_value: r.market_value }))}
          filename={`${borough.toLowerCase().replace(/\s+/g, "-")}-top-properties.csv`}
        />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.bbl} initialSortKey="market_value" initialSortDesc />
    </div>
  );
}
