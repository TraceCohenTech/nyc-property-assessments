"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { formatNumber, formatUSDFull } from "@/lib/format";

type Row = {
  owner_group_id: number;
  name: string;
  owner_type: string;
  hcr_buildings: number;
  residential_units: number;
  total_market_value: number;
};

/** slug -> true, for owner groups that have a live /owners/[slug] profile page. */
export function OwnerGroupsTable({ rows, ownerSlugByName }: { rows: Row[]; ownerSlugByName: Record<string, string> }) {
  const columns: DataTableColumn<Row>[] = [
    {
      key: "name",
      label: "Owner (entity)",
      sortable: false,
      render: (r) => {
        const slug = ownerSlugByName[r.name];
        return slug ? (
          <Link href={`/owners/${slug}`} className="font-semibold text-blue-700 hover:underline">
            {r.name}
          </Link>
        ) : (
          <span className="font-semibold text-slate-900">{r.name}</span>
        );
      },
    },
    { key: "owner_type", label: "Type", sortable: true, render: (r) => <span className="text-xs text-slate-500">{r.owner_type}</span> },
    {
      key: "hcr_buildings",
      label: "HCR buildings",
      align: "right",
      sortable: true,
      render: (r) => formatNumber(r.hcr_buildings),
    },
    {
      key: "residential_units",
      label: "Res. units in them",
      align: "right",
      sortable: true,
      render: (r) => formatNumber(r.residential_units),
    },
    {
      key: "total_market_value",
      label: "Total assessed market value",
      align: "right",
      sortable: true,
      render: (r) => formatUSDFull(r.total_market_value),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <ExportButton
          rows={rows.map((r) => ({
            owner: r.name,
            owner_type: r.owner_type,
            hcr_buildings: r.hcr_buildings,
            residential_units: r.residential_units,
            total_market_value: r.total_market_value,
          }))}
          filename="rent-stabilized-top-owners.csv"
        />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => String(r.owner_group_id)} initialSortKey="hcr_buildings" />
    </div>
  );
}
