import type { Metadata } from "next";
import { Home as HomeIcon, Building, CalendarClock } from "lucide-react";

import raw from "@/data/aggregates.json";
import insightsRaw from "@/data/insights.json";
import type { Aggregates, InsightsData } from "@/lib/types";
import { formatNumber, formatPct } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { AgeDistributionChart } from "@/components/charts/Charts";
import { HousingBandsMiniChart, ResidentialUnitsByBoroughMiniChart } from "@/components/charts/InsightCharts";
import { ChartCard } from "@/components/ui/ChartCard";

const data = raw as unknown as Aggregates;
const insights = insightsRaw as unknown as InsightsData;

export const metadata: Metadata = {
  title: "NYC Housing Units & Building Age | NYC Property Assessment Explorer",
  description:
    "Residential unit counts by borough and building-size band, plus building age distribution, from the NYC DOF FY2027 assessment roll.",
};

export default function HousingPage() {
  const totalUnits = insights.housing.residential_units_by_borough.reduce((s, b) => s + b.units, 0);

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <SourceBadge />
          {insights.placeholder && <ConfidenceBadge level="planned" label="Preliminary housing figures" />}
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Housing</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          How NYC's roughly {formatNumber(totalUnits)} residential units are distributed across boroughs, building
          sizes, and construction eras.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            icon={<HomeIcon className="h-4 w-4 text-blue-600" aria-hidden="true" />}
            label="Total residential units"
            value={formatNumber(totalUnits)}
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            icon={<Building className="h-4 w-4 text-orange-600" aria-hidden="true" />}
            label="Pre-1974 multifamily units"
            value={formatNumber(insights.housing.pre_1974_multifamily.units)}
            sub={`${formatNumber(insights.housing.pre_1974_multifamily.lots)} lots — likely rent-stabilization eligible`}
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            icon={<CalendarClock className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
            label="Pre-1940 lots"
            value={formatNumber(insights.housing.pre_1940.lots)}
            sub={`${formatNumber(insights.housing.pre_1940.units)} units`}
            accent={CATEGORICAL_ORDER[2]}
          />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Residential units by borough" height={300}>
            <ResidentialUnitsByBoroughMiniChart rows={insights.housing.residential_units_by_borough} />
          </ChartCard>
          <ChartCard title="Units by building-size band" sub="1-3 units through 100+ unit buildings" height={300}>
            <HousingBandsMiniChart bands={insights.housing.unit_size_bands} />
          </ChartCard>
        </div>

        <div className="mt-6">
          <ChartCard title="Properties by decade built" sub="Includes an 'Unknown' bucket for missing year-built data" height={340}>
            <AgeDistributionChart buckets={data.age_distribution} />
          </ChartCard>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="font-bold text-slate-900 mb-3">Building-size bands</h2>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Band</th>
                  <th className="py-2 pr-3 text-right">Lots</th>
                  <th className="py-2 pr-3 text-right">Units</th>
                  <th className="py-2 pr-3 text-right">Share of units</th>
                </tr>
              </thead>
              <tbody>
                {insights.housing.unit_size_bands.map((b) => (
                  <tr key={b.band} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-slate-900">{b.band}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatNumber(b.lots)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatNumber(b.units)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold text-blue-700">
                      {formatPct(b.units / totalUnits)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
