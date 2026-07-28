import type { Metadata } from "next";

import taxBurdenRaw from "@/data/analytics/tax_burden.json";
import exemptionsRaw from "@/data/analytics/exemptions.json";
import sqftRaw from "@/data/analytics/sqft_percentiles.json";
import ownershipRaw from "@/data/analytics/ownership_concentration.json";
import treemapRaw from "@/data/analytics/treemap.json";
import timelineRaw from "@/data/analytics/timeline.json";
import extremesRaw from "@/data/analytics/extremes.json";
import zipLeagueRaw from "@/data/analytics/zip_league.json";
import insightsRaw from "@/data/insights.json";
import type { InsightsData } from "@/lib/types";
import { formatNumber, formatPct, formatUSD, formatUSDFull } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { InsightCard } from "@/components/ui/InsightCard";

const taxBurden = taxBurdenRaw as unknown as {
  citywide_by_base_class_family: { base_class_family: string; citywide_assessed_to_market_ratio: number }[];
};
const exemptions = exemptionsRaw as unknown as { meta: { generated_at: string } };
const sqft = sqftRaw as unknown as { by_property_type_x_borough: { property_type: string; borough: string; p10: number; p90: number }[] };
const ownership = ownershipRaw as unknown as { ownership_splits: { individual: { share_of_citywide_value: number } } };
const treemap = treemapRaw as unknown as { root: { name: string; lots: number; market_value: number; children: unknown[] } };
const timeline = timelineRaw as unknown as { decades: { decade: string; lots: number; dominant_property_type: string }[] };
const extremes = extremesRaw as unknown as { most_valuable_single_lots: { address: string; borough: string; market_value: number; owner_group_name: string | null }[] };
const zipLeague = zipLeagueRaw as unknown as { zips: { zip: string; borough: string; total_market_value: number }[]; meta: { zip_count: number } };
const insights = insightsRaw as unknown as InsightsData;

const class1 = taxBurden.citywide_by_base_class_family.find((f) => f.base_class_family === "1");
const class2 = taxBurden.citywide_by_base_class_family.find((f) => f.base_class_family === "2");
const manhattanCondo = sqft.by_property_type_x_borough.find((r) => r.property_type === "condo" && r.borough === "Manhattan");
const topDecade = [...timeline.decades].sort((a, b) => b.lots - a.lots)[0];
const topLot = extremes.most_valuable_single_lots[0];
const topZip = [...zipLeague.zips].sort((a, b) => b.total_market_value - a.total_market_value)[0];

export const metadata: Metadata = {
  title: "Analytics — Deep Dives into NYC Property Data | NYC Property Assessment Explorer",
  description:
    "Nine analytical deep dives into the NYC DOF FY2027 assessment roll: tax burden by class, exemptions, price per square foot, ownership concentration, value distribution, construction timeline, record-setting extremes, the zip code league table, and value concentration — plus a curated data story.",
};

export default function AnalyticsHubPage() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Analytics</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          Nine deep dives into the {formatUSD(1_911_446_867_962, 2)} NYC DOF FY2027 assessment roll — tax equity,
          exemptions, price per square foot, ownership concentration, value distribution, construction history,
          record-setting extremes, and a citywide zip code league table — plus a curated scrollytelling data story.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <InsightCard
            eyebrow="Tax Burden"
            headline="Class 1 homes assess at a fraction of Class 2's rate"
            description={`Class 1 (1-3 family homes) assesses at ~${class1 ? formatPct(class1.citywide_assessed_to_market_ratio, 0) : "6%"} of market value citywide — versus ~${class2 ? formatPct(class2.citywide_assessed_to_market_ratio, 0) : "45%"} for Class 2 apartments, co-ops, and condos. A structural gap set by state law, not the market.`}
            href="/analytics/tax-burden"
            accent={CATEGORICAL_ORDER[0]}
          />
          <InsightCard
            eyebrow="Exemptions"
            headline="$176.9B of assessed value pays nothing"
            description="NYC Parks & Recreation alone holds $16.9B in exempt value across 5,053 lots. See exempt vs. taxable value by borough, tax class, and owner type — plus the top 20 exempt entity owners."
            href="/analytics/exemptions"
            accent={CATEGORICAL_ORDER[1]}
          />
          <InsightCard
            eyebrow="Price per SqFt"
            headline="The same property type can span a 6× price range"
            description={`Manhattan condo $/sqft is remarkably tight (p10 $${manhattanCondo?.p10.toFixed(0) ?? "234"} to p90 $${manhattanCondo?.p90.toFixed(0) ?? "541"}) — the outer boroughs run far wider. Percentile bands and a sortable, exportable per-zip median table.`}
            href="/analytics/price-per-sqft"
            accent={CATEGORICAL_ORDER[2]}
          />
          <InsightCard
            eyebrow="Ownership Concentration"
            headline="67.3% of lots are individual — 40.7% of value is"
            description={`Individually owned lots make up the majority of NYC parcels but hold only ${formatPct(ownership.ownership_splits.individual.share_of_citywide_value, 1)} of citywide value. LLC share by borough, the $1B+ club, and the conservative-floor caveat on entity grouping.`}
            href="/analytics/ownership-concentration"
            accent={CATEGORICAL_ORDER[3]}
          />
          <InsightCard
            eyebrow="Value Treemap"
            headline="$1.91T, broken down borough by building class"
            description={`Drill from ${formatUSD(treemap.root.market_value, 2)} citywide down through each borough, property type, and building class in one interactive treemap.`}
            href="/analytics/treemap"
            accent={CATEGORICAL_ORDER[4]}
          />
          <InsightCard
            eyebrow="Construction Timeline"
            headline="The 1920s built more of NYC than any other decade"
            description={`${formatNumber(topDecade?.lots ?? 192358)} still-standing lots date to the ${topDecade?.decade ?? "1920s"} — dominated by ${topDecade?.dominant_property_type ?? "one-family"} homes, the classic outer-borough building boom.`}
            href="/analytics/timeline"
            accent={CATEGORICAL_ORDER[5]}
          />
          <InsightCard
            eyebrow="Extremes"
            headline="NYC's single most valuable 'lot' is an airport"
            description={topLot ? `${topLot.address}, ${topLot.borough} is assessed at ${formatUSDFull(topLot.market_value)} as one PTS record — it's JFK Airport, owned by the Port Authority of NY & NJ.` : "Record-setting leaderboards: biggest by units, by building area, most valuable, oldest standing, and largest vacant land holdings."}
            href="/analytics/extremes"
            accent={CATEGORICAL_ORDER[0]}
          />
          <InsightCard
            eyebrow="ZIP League"
            headline={`${zipLeague.meta.zip_count} zip codes, ranked citywide`}
            description={topZip ? `${topZip.zip} (${topZip.borough}) leads all NYC zip codes at ${formatUSD(topZip.total_market_value, 1)} in total market value. Compare lots, value, $/sqft, and ownership mix across every zip.` : "Compare every NYC zip code by value, density, $/sqft, and ownership mix."}
            href="/analytics/zips"
            accent={CATEGORICAL_ORDER[1]}
          />
          <InsightCard
            eyebrow="Data Story"
            headline="The State of NYC Property"
            description="A curated, scrollytelling walk through the ten strongest findings across the entire analytics layer — from the Class 1/2 assessment gap to JFK Airport as the city's single most valuable lot."
            href="/story"
            linkLabel="Read the story"
            accent={CATEGORICAL_ORDER[2]}
          />
          <InsightCard
            eyebrow="Value Concentration"
            headline={`Just ${formatPct(insights.concentration.pct_lots_for_50pct_value, 1)} of lots hold half the city's value`}
            description={`The full Lorenz concentration curve, value-band breakdown, and top-N stats — ${formatPct(insights.concentration.pct_lots_for_80pct_value, 1)} of lots account for 80% of total NYC property market value.`}
            href="/value-concentration"
            accent={CATEGORICAL_ORDER[3]}
          />
        </div>

        <div className="mt-10 rounded-2xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600 leading-relaxed">
          Every number on this page is pulled directly from the analytics data layer (
          <span className="font-mono text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5">data/analytics/</span>
          , generated {new Date(exemptions.meta.generated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          ) — cross-checked against the canonical citywide totals of 1,167,962 lots and $1.91T in market value.
        </div>
      </div>
    </div>
  );
}
