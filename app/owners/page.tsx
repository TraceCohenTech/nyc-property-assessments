import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Landmark, Users, Layers } from "lucide-react";

import raw from "@/data/aggregates.json";
import insightsRaw from "@/data/insights.json";
import ownersIndexRaw from "@/data/owners/index.json";
import type { Aggregates, InsightsData, OwnersIndex } from "@/lib/types";
import { isEntityOwner } from "@/lib/ownerPrivacy";
import { formatNumber, formatUSDFull, formatPct } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ChartCard } from "@/components/ui/ChartCard";
import { OwnersExplorer } from "@/components/owners/OwnersExplorer";
import { EntityTypeOverviewChart } from "@/components/owners/OwnerCharts";

const data = raw as unknown as Aggregates;
const insights = insightsRaw as unknown as InsightsData;
const ownersIndex = ownersIndexRaw as unknown as OwnersIndex;

export const metadata: Metadata = {
  title: "NYC's Largest Property Owners | NYC Property Assessment Explorer",
  description:
    "The largest entity property owners in NYC by total assessed value — LLCs, corporations, trusts, and institutions, both consolidated and as filed. Individual owners' names are never shown.",
};

export default function OwnersPage() {
  const entityOwners = data.top_owners.filter((o) => isEntityOwner(o.owner));
  const individualSlice = insights.ownership.by_entity_type.find((t) => t.type === "Individual");
  const totalValue = insights.ownership.by_entity_type.reduce((s, t) => s + t.total_value, 0);

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Owners</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          The largest entity owners of NYC property, ranked by total value, lots, or residential units held.{" "}
          <strong className="text-slate-800">Individual people's names are never displayed anywhere on this site</strong> —
          only businesses, LLCs, trusts, government agencies, and other organizations are named or ranked below.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            icon={<Layers className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
            label="Consolidated owner groups"
            value={formatNumber(ownersIndex.owners.length)}
            sub="Formatting-variant spellings merged"
            accent={CATEGORICAL_ORDER[2]}
          />
          <MetricCard
            icon={<Users className="h-4 w-4 text-slate-500" aria-hidden="true" />}
            label="Individually owned (aggregate only)"
            value={individualSlice ? formatPct(individualSlice.total_value / totalValue) : "—"}
            sub={individualSlice ? `${formatNumber(individualSlice.lots)} lots — never named or ranked` : undefined}
            accent="#94a3b8"
          />
        </div>

        <div className="mt-10">
          <ChartCard
            title="Total property value by owner entity type"
            sub="Individual is shown only as an aggregate slice — no individual owner is ever named or ranked on this site"
            height={340}
          >
            <EntityTypeOverviewChart byType={insights.ownership.by_entity_type} />
          </ChartCard>
        </div>

        <p className="mt-4 text-xs text-slate-500 max-w-3xl">
          How raw DOF filings become the rows below is explained in full in the{" "}
          <Link href="/methodology#owner-consolidation" className="font-semibold text-blue-700 hover:underline">
            owner consolidation methodology
          </Link>
          .
        </p>

        <div className="mt-6">
          <OwnersExplorer consolidated={ownersIndex.owners} rawOwners={entityOwners} />
        </div>
      </div>
    </div>
  );
}
