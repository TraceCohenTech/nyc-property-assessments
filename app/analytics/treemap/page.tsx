import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import treemapRaw from "@/data/analytics/treemap.json";
import { formatUSDAuto, formatNumber } from "@/lib/format";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { TreemapClient, type TreemapRoot } from "@/components/analytics-b/TreemapClient";

const treemap = treemapRaw as unknown as { root: TreemapRoot };

export const metadata: Metadata = {
  title: "Where the $1.9T Lives — NYC Property Value Treemap | NYC Property Assessment Explorer",
  description:
    "An interactive treemap of NYC's entire $1.9T property tax base — drill from borough into property type into building class to see exactly where the city's assessed value sits.",
};

export default function TreemapPage() {
  const { root } = treemap;
  const topBorough = [...root.children].sort((a, b) => b.market_value - a.market_value)[0];

  return (
    <div className="pt-24 sm:pt-28 pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Where the $1.9T Lives</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          Every one of NYC&apos;s {formatNumber(root.lots)} tax lots, rolled up by borough, then property type, then
          building class — tile area is proportional to total market value. Click a tile (or a table row) to drill in;
          use the breadcrumb to zoom back out.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Citywide market value"
            value={formatUSDAuto(root.market_value)}
            sub="Across all boroughs"
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="Highest-value borough"
            value={topBorough.name}
            sub={`${formatUSDAuto(topBorough.market_value)} · ${formatNumber(topBorough.lots)} lots`}
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard label="Total tax lots" value={formatNumber(root.lots)} sub="FY2027 DOF roll" accent={CATEGORICAL_ORDER[2]} />
        </div>

        <div className="mt-10">
          <TreemapClient root={root} />
        </div>

        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-5 text-sm text-slate-700">
          Want to see who actually holds this value, not just where it sits?{" "}
          <Link href="/analytics/extremes" className="font-semibold text-blue-700 hover:underline inline-flex items-center gap-1">
            See NYC&apos;s most extreme properties <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>{" "}
          or browse{" "}
          <Link href="/owners" className="font-semibold text-blue-700 hover:underline">
            entity owner profiles
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
