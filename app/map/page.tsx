import type { Metadata } from "next";
import { MapPinned } from "lucide-react";

import raw from "@/data/aggregates.json";
import type { Aggregates } from "@/lib/types";
import { formatNumber, formatUSD } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";

const data = raw as unknown as Aggregates;

export const metadata: Metadata = {
  title: "NYC Property Map | NYC Property Assessment Explorer",
  description:
    "An interactive map of NYC property assessments by lot, planned for a future release using MapPLUTO coordinates.",
};

export default function MapPage() {
  const topZips = [...data.zips].sort((a, b) => b.total_market_value - a.total_market_value).slice(0, 5);

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <SourceBadge />
          <ConfidenceBadge level="planned" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Map</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          A lot-level interactive map is planned once MapPLUTO coordinates are joined to the assessment roll (see{" "}
          <a href="/methodology" className="text-blue-700 font-semibold hover:underline">
            Methodology
          </a>
          ). Until then, here's the zip-code view of where value concentrates today.
        </p>

        <div className="mt-10">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
            <EmptyState
              icon={<MapPinned className="h-6 w-6" aria-hidden="true" />}
              title="Interactive map — coming soon"
              description="This page will render every tax lot geographically, colored by market value, tax class, or owner type."
            />
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {topZips.map((z, i) => (
            <MetricCard
              key={z.zip}
              label={`Zip ${z.zip}`}
              value={formatUSD(z.total_market_value, 1)}
              sub={`${z.borough} · ${formatNumber(z.count)} lots`}
              accent={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
