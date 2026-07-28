"use client";

import Link from "next/link";
import { formatNumber, formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { OwnerBadge } from "@/components/ui/OwnerBadge";
import type { Owner } from "@/lib/types";

/**
 * Borough-level top-owners table. Rows are unconsolidated "as filed" DOF owner strings (same
 * source as the Owners page's "owners of record" view) — if a row's normalized name matches a
 * published consolidated owner-group profile (via aliasIndex, built by
 * scripts/etl/05_build_owner_profiles.ts), it links out to that fuller /owners/[slug] page;
 * otherwise it renders as plain (still entity-safe) text.
 */
export function TopEntityOwnersTable({ owners, aliasIndex, borough }: { owners: Owner[]; aliasIndex: Record<string, string>; borough: string }) {
  function normalize(raw: string): string {
    return raw
      .toUpperCase()
      .replace(/&/g, " AND ")
      .replace(/[.,'"`;:()#]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const columns: DataTableColumn<Owner>[] = [
    { key: "rank", label: "#", sortable: false, render: (r) => owners.indexOf(r) + 1 },
    {
      key: "owner",
      label: "Owner",
      sortable: false,
      render: (r) => {
        const slug = aliasIndex[normalize(r.owner)];
        if (slug) {
          return (
            <Link href={`/owners/${slug}`} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
              {r.owner}
            </Link>
          );
        }
        return <OwnerBadge owner={r.owner} />;
      },
    },
    {
      key: "property_count",
      label: "Properties",
      align: "right",
      sortable: true,
      sortValue: (r) => r.property_count,
      render: (r) => formatNumber(r.property_count),
    },
    {
      key: "total_market_value",
      label: "Market value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_market_value,
      render: (r) => formatUSDFull(r.total_market_value),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-slate-900">Top entity owners in {borough}</h2>
        <ExportButton
          rows={owners.map((o, i) => ({ rank: i + 1, owner: o.owner, properties: o.property_count, total_market_value: o.total_market_value }))}
          filename={`${borough.toLowerCase().replace(/\s+/g, "-")}-top-owners.csv`}
        />
      </div>
      <DataTable columns={columns} rows={owners} rowKey={(r) => r.owner} initialSortKey="total_market_value" initialSortDesc />
    </div>
  );
}
