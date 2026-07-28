"use client";

import Link from "next/link";
import { formatNumber, formatPct, formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import type { ValueBand } from "@/lib/types";

// Numeric bounds for each band string, matching scripts/etl/04_build_aggregates.ts's valueBand()
// bucketing exactly — used only to build /explorer deep links, never to recompute the bands.
const BAND_BOUNDS: Record<string, { min?: number; max?: number }> = {
  "<$500K": { max: 500_000 },
  "$500K–1M": { min: 500_000, max: 1_000_000 },
  "$1M–2M": { min: 1_000_000, max: 2_000_000 },
  "$2M–5M": { min: 2_000_000, max: 5_000_000 },
  "$5M–10M": { min: 5_000_000, max: 10_000_000 },
  "$10M–20M": { min: 10_000_000, max: 20_000_000 },
  "$20M–50M": { min: 20_000_000, max: 50_000_000 },
  "$50M+": { min: 50_000_000 },
};

function explorerHref(band: string): string {
  const b = BAND_BOUNDS[band];
  const params = new URLSearchParams();
  if (b?.min) params.set("value_min", String(b.min));
  if (b?.max) params.set("value_max", String(b.max));
  return `/explorer?${params.toString()}`;
}

export function ValueBandTable({ bands }: { bands: ValueBand[] }) {
  // Bands arrive already sorted low-to-high (04_build_aggregates.ts's fixed order); compute a
  // running cumulative share of value, largest-value-band-first, to match how the concentration
  // curve is read ("top X% of lots hold Y% of value").
  const order = ["$50M+", "$20M–50M", "$10M–20M", "$5M–10M", "$2M–5M", "$1M–2M", "$500K–1M", "<$500K"];
  const byLargestFirst = [...bands].sort((a, b) => order.indexOf(a.band) - order.indexOf(b.band));
  const rows = byLargestFirst.reduce<((ValueBand & { cumulative_share_value: number; cumulative_share_lots: number })[])>((acc, b) => {
    const prev = acc[acc.length - 1];
    const cumulative_share_value = (prev?.cumulative_share_value ?? 0) + b.share_value;
    const cumulative_share_lots = (prev?.cumulative_share_lots ?? 0) + b.share_lots;
    acc.push({ ...b, cumulative_share_value, cumulative_share_lots });
    return acc;
  }, []);

  const columns: DataTableColumn<(typeof rows)[number]>[] = [
    {
      key: "band",
      label: "Market value band",
      sortable: false,
      render: (r) => (
        <Link href={explorerHref(r.band)} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
          {r.band}
        </Link>
      ),
    },
    { key: "lots", label: "Lots", align: "right", sortable: true, sortValue: (r) => r.lots, render: (r) => formatNumber(r.lots) },
    { key: "share_lots", label: "Share of lots", align: "right", sortable: true, sortValue: (r) => r.share_lots, render: (r) => formatPct(r.share_lots, 1) },
    {
      key: "total_market_value",
      label: "Total value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_market_value,
      render: (r) => formatUSDFull(r.total_market_value),
    },
    { key: "share_value", label: "Share of value", align: "right", sortable: true, sortValue: (r) => r.share_value, render: (r) => formatPct(r.share_value, 1) },
    { key: "avg_value", label: "Avg. value", align: "right", sortable: true, sortValue: (r) => r.avg_value, render: (r) => formatUSDFull(r.avg_value) },
    {
      key: "cumulative_share_value",
      label: "Cumulative value share",
      align: "right",
      sortable: false,
      render: (r) => <span className="font-semibold text-blue-700">{formatPct(r.cumulative_share_value, 1)}</span>,
      cardLabel: "Cumulative value share (top-down)",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-bold text-slate-900">Value bands</h2>
        <ExportButton
          rows={rows.map((r) => ({
            band: r.band,
            lots: r.lots,
            share_of_lots: r.share_lots,
            total_market_value: r.total_market_value,
            share_of_value: r.share_value,
            avg_value: r.avg_value,
            cumulative_share_of_value_top_down: r.cumulative_share_value,
          }))}
          filename="nyc-value-bands.csv"
        />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.band} initialSortKey="share_value" initialSortDesc />
    </div>
  );
}
