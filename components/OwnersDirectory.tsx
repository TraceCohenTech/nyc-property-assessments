"use client";

import { formatNumber, formatUSDFull } from "@/lib/format";
import { OwnerBadge } from "@/components/ui/OwnerBadge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";

type OwnerRow = { owner: string; property_count: number; total_assessed_value: number; total_market_value: number };

/**
 * Client-side wrapper around DataTable for the owners directory — column defs include render
 * functions, which can only live in a Client Component (functions can't cross the server/client
 * boundary as props). The owners page (a Server Component) passes plain data in; this component
 * owns all interactive behavior (sort, export).
 */
export function OwnersDirectory({ owners }: { owners: OwnerRow[] }) {
  const columns: DataTableColumn<OwnerRow>[] = [
    { key: "rank", label: "Rank", sortable: false, cardLabel: "Rank", render: (r) => owners.indexOf(r) + 1 },
    { key: "owner", label: "Owner", sortable: false, render: (r) => <OwnerBadge owner={r.owner} /> },
    {
      key: "property_count",
      label: "Properties",
      align: "right",
      sortable: true,
      sortValue: (r) => r.property_count,
      render: (r) => formatNumber(r.property_count),
    },
    {
      key: "total_assessed_value",
      label: "Total assessed value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_assessed_value,
      render: (r) => formatUSDFull(r.total_assessed_value),
    },
    {
      key: "total_market_value",
      label: "Total market value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_market_value,
      render: (r) => formatUSDFull(r.total_market_value),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-slate-900">Top {owners.length} entity owners</h2>
        <ExportButton
          rows={owners.map((o, i) => ({
            rank: i + 1,
            owner: o.owner,
            properties: o.property_count,
            total_assessed_value: o.total_assessed_value,
            total_market_value: o.total_market_value,
          }))}
          filename="nyc-property-top-owners.csv"
        />
      </div>
      <DataTable columns={columns} rows={owners} rowKey={(r) => r.owner} initialSortKey="total_assessed_value" />
    </div>
  );
}
