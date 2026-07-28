import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import zipLeagueRaw from "@/data/analytics/zip_league.json";
import { formatNumber, formatUSDAuto } from "@/lib/format";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { ZipLeagueTable, type ZipRow } from "@/components/analytics-b/ZipLeagueTable";
import { ZipCompareTool } from "@/components/analytics-b/ZipCompareTool";
import { TopBottomZipsChart } from "@/components/analytics-b/TopBottomZipsChart";

const zipLeague = zipLeagueRaw as unknown as { zips: ZipRow[] };

export const metadata: Metadata = {
  title: "The ZIP League — Every NYC ZIP Code Ranked | NYC Property Assessment Explorer",
  description:
    "All 185 qualifying NYC ZIP codes ranked by total value, median value, price per square foot, and LLC ownership share — sortable, filterable, exportable, with a two-ZIP comparison tool.",
};

export default function ZipsPage() {
  const zips = zipLeague.zips;
  const richest = [...zips].sort((a, b) => b.median_market_value - a.median_market_value)[0];
  const mostLots = [...zips].sort((a, b) => b.lots - a.lots)[0];
  const highestLlc = [...zips].sort((a, b) => b.llc_share - a.llc_share)[0];

  return (
    <div className="pt-24 sm:pt-28 pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">The ZIP League</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          All {zips.length} NYC ZIP codes that clear the neighborhood-code bar (10+ lots, excluding single-building
          PO-box and campus zips) — ranked, filterable by borough, and exportable.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Highest median value"
            value={richest.zip}
            sub={`${formatUSDAuto(richest.median_market_value)} · ${richest.borough}`}
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="Most tax lots"
            value={mostLots.zip}
            sub={`${formatNumber(mostLots.lots)} lots · ${mostLots.borough}`}
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            label="Highest LLC share"
            value={highestLlc.zip}
            sub={`${(highestLlc.llc_share * 100).toFixed(0)}% of lots · ${highestLlc.borough}`}
            accent={CATEGORICAL_ORDER[2]}
          />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Top 10 ZIPs by median value" sub="Highest median market value per tax lot" height={340}>
            <TopBottomZipsChart zips={zips} direction="top" metricLabel="Median market value" />
          </ChartCard>
          <ChartCard title="Bottom 10 ZIPs by median value" sub="Lowest median market value per tax lot, among qualifying ZIPs" height={340}>
            <TopBottomZipsChart zips={zips} direction="bottom" metricLabel="Median market value" />
          </ChartCard>
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <h2 className="font-bold text-slate-900 mb-1">All {zips.length} ZIPs</h2>
          <p className="text-xs text-slate-500 mb-4">
            Sort any column, filter by borough, or search a ZIP prefix. The value-mix column is a mini distribution
            across 8 value bands, lightest = cheapest lots.
          </p>
          <ZipLeagueTable zips={zips} />
        </div>

        <div className="mt-10">
          <ZipCompareTool zips={zips} />
        </div>

        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-5 text-sm text-slate-700">
          Want the citywide picture instead of ZIP-by-ZIP?{" "}
          <Link href="/analytics/treemap" className="font-semibold text-blue-700 hover:underline inline-flex items-center gap-1">
            See the value treemap <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>{" "}
          or browse{" "}
          <Link href="/boroughs" className="font-semibold text-blue-700 hover:underline">
            borough-level profiles
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
