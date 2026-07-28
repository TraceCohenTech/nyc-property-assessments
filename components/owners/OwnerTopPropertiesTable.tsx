"use client";

import Link from "next/link";
import { formatNumber, formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import type { OwnerTopProperty } from "@/lib/types";

export function OwnerTopPropertiesTable({ properties, ownerName }: { properties: OwnerTopProperty[]; ownerName: string }) {
  const columns: DataTableColumn<OwnerTopProperty>[] = [
    { key: "rank", label: "#", sortable: false, render: (r) => properties.indexOf(r) + 1 },
    {
      key: "address",
      label: "Address",
      sortable: false,
      render: (r) => (
        <Link href={`/properties/${r.bbl}`} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
          {r.address || r.bbl}
        </Link>
      ),
    },
    { key: "borough", label: "Borough", sortable: false, render: (r) => r.borough },
    { key: "building_class", label: "Bldg class", sortable: false, render: (r) => r.building_class || "—" },
    {
      key: "residential_units",
      label: "Resid. units",
      align: "right",
      sortable: true,
      sortValue: (r) => r.residential_units,
      render: (r) => formatNumber(r.residential_units),
    },
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
        <h2 className="font-bold text-slate-900">Top {properties.length} properties</h2>
        <ExportButton
          rows={properties.map((p, i) => ({
            rank: i + 1,
            bbl: p.bbl,
            address: p.address,
            borough: p.borough,
            building_class: p.building_class,
            residential_units: p.residential_units,
            total_units: p.total_units,
            market_value: p.market_value,
          }))}
          filename={`${ownerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-top-properties.csv`}
        />
      </div>
      <DataTable columns={columns} rows={properties} rowKey={(r) => r.bbl} initialSortKey="market_value" initialSortDesc />
    </div>
  );
}
