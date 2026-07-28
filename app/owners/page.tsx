import type { Metadata } from "next";
import { Building2, Landmark, ShieldAlert } from "lucide-react";

import raw from "@/data/aggregates.json";
import insightsRaw from "@/data/insights.json";
import type { Aggregates, InsightsData } from "@/lib/types";
import { isEntityOwner } from "@/lib/ownerPrivacy";
import { formatNumber, formatUSDFull } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { OwnersDirectory } from "@/components/OwnersDirectory";

const data = raw as unknown as Aggregates;
const insights = insightsRaw as unknown as InsightsData;

export const metadata: Metadata = {
  title: "NYC's Largest Property Owners | NYC Property Assessment Explorer",
  description:
    "The largest entity property owners in NYC by total assessed value — LLCs, corporations, trusts, and institutions. Individual owners' names are never shown.",
};

export default function OwnersPage() {
  const entityOwners = data.top_owners.filter((o) => isEntityOwner(o.owner));

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Owners</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          The largest entity owners in NYC, ranked by total assessed value across all their holdings.{" "}
          <strong className="text-slate-800">Individual people's names are never displayed anywhere on this site</strong> —
          only businesses, LLCs, trusts, government agencies, and other organizations appear below.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            icon={<Building2 className="h-4 w-4 text-blue-600" aria-hidden="true" />}
            label="LLC-owned value"
            value={formatUSDFull(insights.ownership.llc.total_value)}
            sub={`${formatNumber(insights.ownership.llc.lots)} lots`}
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            icon={<Landmark className="h-4 w-4 text-orange-600" aria-hidden="true" />}
            label="Government-owned value"
            value={formatUSDFull(insights.ownership.government.total_value)}
            sub={`${formatNumber(insights.ownership.government.lots)} lots`}
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            icon={<ShieldAlert className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
            label="Entity owners ranked below"
            value={formatNumber(entityOwners.length)}
            sub="Individuals redacted, never ranked"
            accent={CATEGORICAL_ORDER[2]}
          />
        </div>
        {insights.placeholder && (
          <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
            <ConfidenceBadge level="planned" label="Preliminary" /> Ownership totals above are seed estimates pending
            the data pipeline's full computation.
          </p>
        )}

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <OwnersDirectory owners={entityOwners} />
        </div>
      </div>
    </div>
  );
}
