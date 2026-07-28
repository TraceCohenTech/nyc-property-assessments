import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import timelineRaw from "@/data/analytics/timeline.json";
import { formatNumber, formatUSDAuto } from "@/lib/format";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { InsightCard } from "@/components/ui/InsightCard";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { TimelineClient, type DecadeRow } from "@/components/analytics-b/TimelineClient";
import { decadeToYearRange } from "@/components/analytics-b/decadeRange";

const timeline = timelineRaw as unknown as { decades: DecadeRow[] };

export const metadata: Metadata = {
  title: "How NYC Was Built — Property Timeline by Decade | NYC Property Assessment Explorer",
  description:
    "Every NYC tax lot still standing today, broken down by the decade it was built — the 1920s construction boom, the postwar apartment wave, and the modern condo era, stacked by borough.",
};

export default function TimelinePage() {
  const decades = timeline.decades;
  const peak = [...decades].filter((d) => d.decade !== "Unknown").sort((a, b) => b.lots - a.lots)[0];
  const peak1920s = decades.find((d) => d.decade === "1920s")!;
  const knownDecades = decades.filter((d) => d.decade !== "Unknown");
  const totalLots = decades.reduce((s, d) => s + d.lots, 0);
  const unknown = decades.find((d) => d.decade === "Unknown")!;
  const range1920s = decadeToYearRange("1920s")!;

  return (
    <div className="pt-24 sm:pt-28 pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">How NYC Was Built</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          {formatNumber(totalLots)} tax lots, grouped by the decade their building was constructed — a physical record
          of the city&apos;s growth spurts, one-family rowhouse booms, and modern condo towers.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Peak construction decade"
            value={peak.decade}
            sub={`${formatNumber(peak.lots)} still-standing lots`}
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="1920s residential units"
            value={formatNumber(peak1920s.residential_units)}
            sub="Built in a single decade"
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            label="1920s market value today"
            value={formatUSDAuto(peak1920s.total_market_value)}
            sub="Current DOF assessment"
            accent={CATEGORICAL_ORDER[2]}
          />
          <MetricCard
            label="No year-built on file"
            value={formatNumber(unknown.lots)}
            sub={`~${((unknown.lots / totalLots) * 100).toFixed(0)}% of all lots`}
            accent={CATEGORICAL_ORDER[3]}
          />
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <h2 className="font-bold text-slate-900 mb-1">Lots, value, and units by decade built</h2>
          <p className="text-xs text-slate-500 mb-4">
            Switch metric, then click any decade tile below the chart to open it in the Property Explorer.
          </p>
          <TimelineClient decades={decades} />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InsightCard
            eyebrow="The 1920s boom"
            headline={`The 1920s produced more of NYC's still-standing stock than any other decade`}
            description={`${formatNumber(peak1920s.lots)} lots — dominated by one-family homes — went up in that single decade, the classic outer-borough rowhouse and bungalow building boom that still defines much of Queens, Brooklyn, and the Bronx today.`}
            href={`/explorer?year_built_min=${range1920s.min}&year_built_max=${range1920s.max}`}
            linkLabel="Browse 1920s-built properties"
            accent={CATEGORICAL_ORDER[0]}
          />
          <InsightCard
            eyebrow="The condo era"
            headline="Condos became the dominant new-build type starting in the 1980s"
            description="Every decade from the 1980s onward except the 1990s has condo as its single most common new property type — a structural shift from the prewar one/two-family and rental-apartment stock built earlier in the century."
            href="/analytics/treemap"
            linkLabel="See condo share in the treemap"
            accent={CATEGORICAL_ORDER[3]}
          />
        </div>

        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-5 text-sm text-slate-700">
          Curious how building age plays into value per square foot?{" "}
          <Link href="/analytics/price-per-sqft" className="font-semibold text-blue-700 hover:underline inline-flex items-center gap-1">
            See the $/sqft breakdown <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          , or explore{" "}
          <Link href="/analytics/zips" className="font-semibold text-blue-700 hover:underline">
            the ZIP league table
          </Link>
          .
        </div>

        <p className="sr-only">{knownDecades.length} decades of data shown, plus an Unknown bucket for missing year-built records.</p>
      </div>
    </div>
  );
}
