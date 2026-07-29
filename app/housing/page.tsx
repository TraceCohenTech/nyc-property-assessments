import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Home as HomeIcon, Building, CalendarClock, Info } from "lucide-react";

import raw from "@/data/aggregates.json";
import insightsRaw from "@/data/insights.json";
import manhattan from "@/data/borough/manhattan.json";
import brooklyn from "@/data/borough/brooklyn.json";
import queens from "@/data/borough/queens.json";
import bronx from "@/data/borough/bronx.json";
import statenIsland from "@/data/borough/staten-island.json";
import type { Aggregates, BoroughProfile, InsightsData } from "@/lib/types";
import { formatNumber, formatPct } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";
import { AgeDistributionChart } from "@/components/charts/Charts";
import { ResidentialUnitsByBoroughMiniChart } from "@/components/charts/InsightCharts";
import { UnitBandsDualChart, StockCompositionChart, UnitsByEntityTypeChart, ValuePerUnitByBoroughChart } from "@/components/housing/HousingCharts";
import { ChartCard } from "@/components/ui/ChartCard";

const data = raw as unknown as Aggregates;
const insights = insightsRaw as unknown as InsightsData;

const BOROUGH_PROFILES = [manhattan, brooklyn, queens, bronx, statenIsland] as unknown as BoroughProfile[];

export const metadata: Metadata = {
  title: "NYC Housing Units & Building Age | NYC Property Assessment Explorer",
  description:
    "Residential unit counts by borough, building-size band, and owner entity type, plus housing stock composition and pre-1974 multifamily rent-regulation context, from the NYC DOF FY2027 assessment roll.",
};

export default function HousingPage() {
  const totalUnits = insights.housing.residential_units_by_borough.reduce((s, b) => s + b.units, 0);

  // Citywide stock composition: sum the 5 borough files' property_type_distribution rollups —
  // no separate citywide field exists, so this is computed here rather than hardcoded.
  const stockComposition = new Map<string, number>();
  for (const bp of BOROUGH_PROFILES) {
    for (const row of bp.property_type_distribution) {
      stockComposition.set(row.property_type, (stockComposition.get(row.property_type) ?? 0) + row.count);
    }
  }
  const stockRows = [...stockComposition.entries()].map(([property_type, count]) => ({ property_type, count }));

  const valuePerUnitByBorough = BOROUGH_PROFILES.map((bp) => ({
    borough: bp.borough,
    value_per_unit: bp.medians.median_value_per_resid_unit,
  })).sort((a, b) => b.value_per_unit - a.value_per_unit);

  const totalLots = data.citywide.total_properties;
  const pre1940LotShare = insights.housing.pre_1940.lots / totalLots;
  const pre1974UnitShare = insights.housing.pre_1974_multifamily.units / totalUnits;

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Housing</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          How NYC's roughly {formatNumber(totalUnits)} residential units are distributed across boroughs, building sizes,
          construction eras, and owner types.
        </p>
        <p className="mt-2 text-sm text-slate-500 max-w-3xl">
          A quick note on <strong className="text-slate-700">properties vs. units</strong>: a "lot" or "property" is one tax
          parcel — it could be a single-family house or a 1,000-unit tower, and both count as one lot. A "residential unit" is
          one apartment/dwelling within that lot. The two numbers tell very different stories, which is why most charts below
          show both.
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
            sub={`${formatNumber(insights.housing.pre_1974_multifamily.lots)} lots · ${formatPct(pre1974UnitShare, 1)} of all units`}
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            icon={<CalendarClock className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
            label="Pre-1940 lots"
            value={formatNumber(insights.housing.pre_1940.lots)}
            sub={`${formatNumber(insights.housing.pre_1940.units)} units · ${formatPct(pre1940LotShare, 1)} of all lots`}
            accent={CATEGORICAL_ORDER[2]}
          />
        </div>

        <div className="mt-6 rounded-2xl bg-blue-50 border border-blue-200 p-5 flex items-start gap-2 text-sm text-slate-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
          <span>
            Pre-1974 multifamily buildings are the age/size cohort most likely to fall under NYC's rent-stabilization rules —
            see how that maps to the regulated housing stock on the{" "}
            <Link href="/rent-regulation" className="font-semibold text-blue-700 hover:underline">
              Rent Regulation
            </Link>{" "}
            page.
          </span>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Residential units by borough" height={300}>
            <ResidentialUnitsByBoroughMiniChart rows={insights.housing.residential_units_by_borough} />
          </ChartCard>
          <ChartCard
            title="Buildings vs. residential units, by building-size band"
            sub="A tiny number of very large buildings hold a large share of units — most lots are small"
            height={300}
          >
            <UnitBandsDualChart bands={insights.housing.unit_size_bands} />
          </ChartCard>
          <ChartCard title="Housing stock composition" sub="All NYC property types, citywide, largest first" height={340}>
            <StockCompositionChart rows={stockRows} />
          </ChartCard>
          <ChartCard
            title="Residential units by owner entity type"
            sub="Individual is shown as an aggregate slice only — never named or ranked"
            height={340}
          >
            <UnitsByEntityTypeChart byType={insights.ownership.by_entity_type} />
          </ChartCard>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title={
              <DefinitionTooltip term="Value per residential unit, by borough">
                Borough total market value ÷ borough residential units — a rough proxy for per-apartment value, not an
                individual sale price.
              </DefinitionTooltip>
            }
            height={300}
          >
            <ValuePerUnitByBoroughChart rows={valuePerUnitByBorough} />
          </ChartCard>
          <ChartCard title="Properties by decade built" sub="Includes an 'Unknown' bucket for missing year-built data" height={300}>
            <AgeDistributionChart buckets={data.age_distribution} />
          </ChartCard>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="font-bold text-slate-900 mb-1">Building-size bands</h2>
          <p className="text-xs text-slate-500 mb-4">
            Lots (buildings) and residential units per band — the gap between the two columns is the properties-vs-units
            distinction in numbers.
          </p>
          <p className="sm:hidden text-[11px] text-slate-400 mb-1.5">Swipe to see all columns &rarr;</p>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[480px] text-sm">
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

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/value-concentration" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            See how property value concentrates the same way <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/rent-regulation" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            Explore pre-1974 multifamily &amp; rent regulation <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
