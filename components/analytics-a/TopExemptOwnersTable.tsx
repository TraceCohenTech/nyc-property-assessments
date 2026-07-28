"use client";

import Link from "next/link";
import { formatNumber, formatPct, formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";

export type ExemptOwnerRow = {
  owner_group_id: number;
  name: string;
  owner_type: string;
  lots: number;
  total_exempt_value: number;
  total_market_value: number;
};

/**
 * Top-20 exempt entity owners. Entity-only (owner_group_id is never assigned to Individual /
 * Unknown-Other owners — see data/analytics/README.md privacy rule). Links to the owner profile
 * when a matching slug exists in the owners index.
 */
export function TopExemptOwnersTable({ rows, slugByName }: { rows: ExemptOwnerRow[]; slugByName: Record<string, string> }) {
  const columns: DataTableColumn<ExemptOwnerRow>[] = [
    {
      key: "name",
      label: "Owner",
      sortable: false,
      render: (r) => {
        const slug = slugByName[r.name];
        return slug ? (
          <Link href={`/owners/${slug}`} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
            {r.name}
          </Link>
        ) : (
          <span className="font-semibold text-slate-900">{r.name}</span>
        );
      },
    },
    { key: "owner_type", label: "Type", sortable: false, render: (r) => <span className="text-xs text-slate-500">{r.owner_type}</span> },
    { key: "lots", label: "Lots", align: "right", sortable: true, sortValue: (r) => r.lots, render: (r) => formatNumber(r.lots) },
    {
      key: "total_exempt_value",
      label: "Exempt value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_exempt_value,
      render: (r) => <span className="font-semibold text-red-700">{formatUSDFull(r.total_exempt_value)}</span>,
    },
    {
      key: "total_market_value",
      label: "Market value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_market_value,
      render: (r) => formatUSDFull(r.total_market_value),
    },
    {
      key: "pct_exempt",
      label: "% exempt",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_exempt_value / r.total_market_value,
      render: (r) => formatPct(r.total_exempt_value / r.total_market_value, 0),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-slate-900">Top 20 exempt entity owners</h2>
        <ExportButton
          rows={rows.map((r) => ({
            owner: r.name,
            owner_type: r.owner_type,
            lots: r.lots,
            total_exempt_value: r.total_exempt_value,
            total_market_value: r.total_market_value,
            pct_exempt: r.total_exempt_value / r.total_market_value,
          }))}
          filename="nyc-top-exempt-owners.csv"
        />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => String(r.owner_group_id)} initialSortKey="total_exempt_value" initialSortDesc />
    </div>
  );
}
