import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Ruler, Info } from "lucide-react";

import sqftRaw from "@/data/analytics/sqft_percentiles.json";
import { formatNumber } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ChartCard } from "@/components/ui/ChartCard";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";
import { PropertyTypeTabs } from "@/components/analytics-a/PropertyTypeTabs";
import { ZipSqftTable } from "@/components/analytics-a/ZipSqftTable";

type PercentileRow = { property_type: string; borough: string; n: number; p10: number; p25: number; median: number; p75: number; p90: number };
type ZipRow = { zip: string; borough: string; n: number; p10: number; p25: number; median: number; p75: number; p90: number };

type SqftData = {
  meta: { exclusions: string };
  by_property_type_x_borough: PercentileRow[];
  by_zip: ZipRow[];
};

const data = sqftRaw as unknown as SqftData;

export const metadata: Metadata = {
  title: "Price per Square Foot | NYC Property Assessment Explorer",
  description:
    "$/sqft (market value ÷ building area) percentile distributions by property type and borough, plus a sortable, exportable per-zip median table across 185 NYC zip codes.",
};

export default function PriceSqftPage() {
  const manhattanCondo = data.by_property_type_x_borough.find((r) => r.property_type === "condo" && r.borough === "Manhattan");
  const bronxCondo = data.by_property_type_x_borough.find((r) => r.property_type === "condo" && r.borough === "Bronx");
  const topZip = [...data.by_zip].sort((a, b) => b.median - a.median)[0];

  const manhattanSpread = manhattanCondo ? (manhattanCondo.p90 / manhattanCondo.p10).toFixed(1) : "—";
  const bronxSpread = bronxCondo ? (bronxCondo.p90 / bronxCondo.p10).toFixed(1) : "—";

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <Ruler className="h-9 w-9 text-blue-600" aria-hidden="true" />
          Price per Square Foot
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          <DefinitionTooltip term="$/sqft">Market value ÷ building area, per lot — not a per-unit sale price.</DefinitionTooltip> varies
          enormously by property type, borough, and neighborhood. Percentile ranges (p10–p90) tell a more honest
          story than a single average.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Manhattan condo p10–p90 spread"
            value={`${manhattanSpread}×`}
            sub={manhattanCondo ? `$${manhattanCondo.p10.toFixed(0)} → $${manhattanCondo.p90.toFixed(0)}` : undefined}
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="Bronx condo p10–p90 spread"
            value={`${bronxSpread}×`}
            sub={bronxCondo ? `$${bronxCondo.p10.toFixed(0)} → $${bronxCondo.p90.toFixed(0)}` : undefined}
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            label="Highest-median zip code"
            value={topZip?.zip ?? "—"}
            sub={topZip ? `$${topZip.median.toFixed(0)}/sqft median · ${topZip.borough}` : undefined}
            accent={CATEGORICAL_ORDER[2]}
          />
          <MetricCard label="Zip codes covered" value={formatNumber(data.by_zip.length)} sub="Of ~240 raw zips citywide (n ≥ 5 required)" accent={CATEGORICAL_ORDER[3]} />
        </div>

        <div className="mt-10">
          <ChartCard
            title="$/sqft percentile range by borough"
            sub="Pick a property type — each marker is the median, with the shaded range spanning p10 to p90"
            height={440}
          >
            <PropertyTypeTabs rows={data.by_property_type_x_borough} />
          </ChartCard>
        </div>

        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-5 text-sm text-slate-700 leading-relaxed">
          Manhattan condo $/sqft is remarkably tight ({manhattanSpread}× spread) compared to the outer boroughs, where
          the spread runs far wider (Bronx condo: {bronxSpread}×) — a handful of new-construction luxury condo
          buildings sit right next to legacy low-value stock inside the same borough/property-type bucket.
        </div>

        <section className="mt-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
            <ZipSqftTable rows={data.by_zip} />
          </div>
        </section>

        <div className="mt-10 rounded-2xl bg-slate-50 border border-slate-200 p-5 flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
          <Info className="h-5 w-5 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <p>
            <strong className="text-slate-900">Methodology: </strong>
            {data.meta.exclusions}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/explorer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            Explore individual properties <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/analytics/tax-burden" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            See how value translates to tax burden <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
