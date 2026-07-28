"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { formatNumber, formatPct, formatUSD, formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { ZipMiniBandBar } from "@/components/analytics-b/ZipMiniBandBar";

export type ZipRow = {
  zip: string;
  borough: string;
  lots: number;
  total_market_value: number;
  median_market_value: number;
  median_price_per_sqft: number;
  residential_units: number;
  llc_share: number;
  government_share: number;
  dominant_property_type: string;
  value_band_distribution: { band: string; count: number }[];
};

const BOROUGHS = ["All boroughs", "Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

export function ZipLeagueTable({ zips }: { zips: ZipRow[] }) {
  const [borough, setBorough] = useState("All boroughs");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return zips.filter((z) => {
      if (borough !== "All boroughs" && z.borough !== borough) return false;
      if (query && !z.zip.startsWith(query.trim())) return false;
      return true;
    });
  }, [zips, borough, query]);

  const columns: DataTableColumn<ZipRow>[] = [
    {
      key: "zip",
      label: "ZIP",
      sortable: true,
      sortValue: (r) => r.zip,
      render: (r) => (
        <Link href={`/explorer?zip=${r.zip}`} className="font-semibold text-blue-700 hover:underline inline-flex items-center gap-1">
          {r.zip}
        </Link>
      ),
    },
    { key: "borough", label: "Borough", sortable: true, sortValue: (r) => r.borough, render: (r) => r.borough },
    { key: "lots", label: "Lots", align: "right", sortable: true, render: (r) => formatNumber(r.lots), sortValue: (r) => r.lots },
    {
      key: "total_market_value",
      label: "Total value",
      align: "right",
      sortable: true,
      render: (r) => formatUSD(r.total_market_value, 1),
      sortValue: (r) => r.total_market_value,
    },
    {
      key: "median_market_value",
      label: "Median value",
      align: "right",
      sortable: true,
      render: (r) => formatUSDFull(r.median_market_value),
      sortValue: (r) => r.median_market_value,
    },
    {
      key: "median_price_per_sqft",
      label: "Median $/sqft",
      align: "right",
      sortable: true,
      render: (r) => `$${r.median_price_per_sqft.toFixed(0)}`,
      sortValue: (r) => r.median_price_per_sqft,
    },
    {
      key: "llc_share",
      label: "LLC share",
      align: "right",
      sortable: true,
      render: (r) => formatPct(r.llc_share, 1),
      sortValue: (r) => r.llc_share,
    },
    {
      key: "dominant_property_type",
      label: "Dominant type",
      sortable: true,
      sortValue: (r) => r.dominant_property_type,
      render: (r) => <span className="capitalize">{r.dominant_property_type}</span>,
    },
    {
      key: "value_band_distribution",
      label: "Value mix",
      cardLabel: "Value-band mix",
      render: (r) => <ZipMiniBandBar bands={r.value_band_distribution} totalLots={r.lots} />,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="zip-borough" className="text-xs font-semibold text-slate-500">
            Borough
          </label>
          <select
            id="zip-borough"
            value={borough}
            onChange={(e) => setBorough(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            {BOROUGHS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="zip-search" className="text-xs font-semibold text-slate-500">
            Search ZIP
          </label>
          <input
            id="zip-search"
            type="text"
            inputMode="numeric"
            placeholder="e.g. 100"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[40px] w-32 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {filtered.length} of {zips.length} ZIPs
          </span>
          <ExportButton rows={filtered.map(({ value_band_distribution: _vbd, ...rest }) => rest)} filename="nyc-zip-league.csv" />
        </div>
      </div>

      <DataTable columns={columns} rows={filtered} rowKey={(r) => r.zip} initialSortKey="total_market_value" emptyMessage="No ZIPs match those filters." />

      <p className="mt-3 text-xs text-slate-500 flex items-center gap-1">
        <ExternalLink className="h-3 w-3" aria-hidden="true" /> Click any ZIP to open it in the Property Explorer.
      </p>
    </div>
  );
}
