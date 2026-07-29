import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building, Info, AlertTriangle } from "lucide-react";

import ownershipRaw from "@/data/analytics/ownership_concentration.json";
import { formatNumber, formatPct, formatUSD } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ChartCard } from "@/components/ui/ChartCard";
import {
  CumulativeShareChart,
  OwnershipSplitChart,
  LlcShareByBoroughChart,
} from "@/components/analytics-a/OwnershipConcentrationCharts";

type OwnershipData = {
  meta: { exclusions: string };
  total_entity_owner_groups: number;
  cumulative_value_share: { top_n: number | string; owner_groups: number; cumulative_value: number; share_of_citywide_market_value: number }[];
  ownership_splits: {
    government: { lots: number; market_value: number; share_of_citywide_value: number };
    private_entity_aggregate: { lots: number; market_value: number; share_of_citywide_value: number };
    individual: { lots: number; market_value: number; share_of_citywide_value: number };
    unknown_other: { lots: number; market_value: number; share_of_citywide_value: number };
  };
  llc_share_by_borough: { borough: string; llc_share_of_value: number; llc_share_of_lots: number }[];
  owner_groups_over_1b: number;
  owner_groups_over_100m: number;
};

const data = ownershipRaw as unknown as OwnershipData;

export const metadata: Metadata = {
  title: "Ownership Concentration — Who Really Controls NYC Property | NYC Property Assessment Explorer",
  description:
    "67.3% of NYC tax lots are individually owned, but they hold only 40.7% of citywide value. LLC value-share by borough, the $1B+ entity club, and cumulative value share of the top 10/50/100/500 tracked entity owner-groups — with the conservative-floor caveat front and center.",
};

export default function OwnershipConcentrationPage() {
  const splits = data.ownership_splits;
  const top10 = data.cumulative_value_share.find((r) => r.top_n === 10);
  const manhattanLlc = data.llc_share_by_borough.find((r) => r.borough === "Manhattan");
  const siLlc = data.llc_share_by_borough.find((r) => r.borough === "Staten Island");

  const individualLotShare = splits.individual.lots / (splits.government.lots + splits.private_entity_aggregate.lots + splits.individual.lots + splits.unknown_other.lots);

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <Building className="h-9 w-9 text-blue-600" aria-hidden="true" />
          Ownership Concentration
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          <strong className="text-slate-900">{formatPct(individualLotShare, 1)}</strong> of NYC tax lots are
          individually owned — but they hold only{" "}
          <strong className="text-slate-900">{formatPct(splits.individual.share_of_citywide_value, 1)}</strong> of
          citywide value. Most of the city&apos;s property wealth sits with a comparatively small number of entity
          owners.
        </p>

        <div className="mt-4 rounded-2xl bg-orange-50 border border-orange-200 p-4 sm:p-5 flex items-start gap-2.5 text-sm text-slate-700">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
          <p>
            <strong className="text-slate-900">These are conservative floors, not ceilings.</strong> Entity
            owner-groups here are built by exact repeated-name matching only — a common NYC ownership structure is a
            unique single-building holding-company LLC, which never gets grouped and is invisible to the top-N
            leaderboards below (it&apos;s still correctly counted as &quot;LLC&quot; in the aggregate splits, just not linked to any
            other property). True corporate concentration is almost certainly higher than what these numbers show.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Individually owned lots"
            value={formatPct(individualLotShare, 1)}
            sub={`But only ${formatPct(splits.individual.share_of_citywide_value, 1)} of citywide value`}
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="Tracked entity owner-groups"
            value={formatNumber(data.total_entity_owner_groups)}
            sub="Repeated-name-matched LLCs, corps, gov't & nonprofits"
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            label="Top 10 groups' value share"
            value={top10 ? formatPct(top10.share_of_citywide_market_value, 1) : "—"}
            sub={top10 ? `${formatUSD(top10.cumulative_value, 1)} — mostly government` : undefined}
            accent={CATEGORICAL_ORDER[2]}
          />
          <MetricCard label="Groups worth $1B+" value={formatNumber(data.owner_groups_over_1b)} sub={`${formatNumber(data.owner_groups_over_100m)} worth $100M+`} accent={CATEGORICAL_ORDER[3]} />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Cumulative value share, top-N entity owner-groups"
            sub="Government agencies dominate the tracked top — private ownership is far more fragmented under the exact-name-match method"
            height={340}
          >
            <CumulativeShareChart rows={data.cumulative_value_share} />
          </ChartCard>
          <ChartCard title="Share of citywide value by ownership type" height={340}>
            <OwnershipSplitChart
              rows={[
                { type: "Government", ...splits.government },
                { type: "Private entity aggregate", ...splits.private_entity_aggregate },
                { type: "Individual", ...splits.individual },
                { type: "Unknown / other", ...splits.unknown_other },
              ]}
            />
          </ChartCard>
        </div>

        <div className="mt-10">
          <ChartCard
            title="LLC share of value vs. lots, by borough"
            sub={`Manhattan (${manhattanLlc ? formatPct(manhattanLlc.llc_share_of_value, 1) : "—"} of value) is by far the highest — Staten Island (${siLlc ? formatPct(siLlc.llc_share_of_value, 1) : "—"}) the lowest`}
            height={340}
          >
            <LlcShareByBoroughChart rows={data.llc_share_by_borough} />
          </ChartCard>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="font-bold text-slate-900 mb-1">The $1B+ club</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">{formatNumber(data.owner_groups_over_1b)} tracked entity groups</strong>{" "}
              individually control more than $1 billion in NYC property value each — a mix of major government
              agencies and the largest commercial real estate holders in the city.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="font-bold text-slate-900 mb-1">The $100M+ tier</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-900">{formatNumber(data.owner_groups_over_100m)} tracked entity groups</strong>{" "}
              clear the $100M threshold — still a small fraction of the {formatNumber(data.total_entity_owner_groups)}{" "}
              total tracked groups, underscoring how concentrated even the &quot;tracked&quot; population is.
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl bg-slate-50 border border-slate-200 p-5 flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
          <Info className="h-5 w-5 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <p>{data.meta.exclusions}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/owners" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            Browse all ranked entity owners <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/methodology" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            Read the full owner-consolidation methodology <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/value-concentration" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            See lot-level value concentration <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
