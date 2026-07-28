import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import raw from "@/data/aggregates.json";
import type { Aggregates } from "@/lib/types";
import { formatNumber, formatUSD, formatPct } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { BoroughValueChart } from "@/components/charts/Charts";
import { MetricCard } from "@/components/ui/MetricCard";
import { ChartCard } from "@/components/ui/ChartCard";
import { SourceBadge } from "@/components/ui/SourceBadge";

const data = raw as unknown as Aggregates;

export const metadata: Metadata = {
  title: "NYC Property Assessments by Borough | NYC Property Assessment Explorer",
  description:
    "Compare Manhattan, Brooklyn, Queens, the Bronx, and Staten Island on total market value, assessed value, lot count, and assessment ratio from the FY2027 DOF roll.",
};

function slugify(borough: string) {
  return borough.toLowerCase().replace(/\s+/g, "-");
}

export default function BoroughsPage() {
  const boroughs = [...data.boroughs].sort((a, b) => b.total_market_value - a.total_market_value);

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Boroughs</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          Manhattan, Brooklyn, Queens, the Bronx, and Staten Island each carry a very different share of NYC's
          assessed value, lot count, and assessment ratio. Compare all five here, or open a full borough profile.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {boroughs.map((b, i) => (
            <Link key={b.borough} href={`/boroughs/${slugify(b.borough)}`} className="block">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card card-hover h-full flex flex-col">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length] }} aria-hidden="true" />
                <div className="text-lg font-bold text-slate-900 mt-2">{b.borough}</div>
                <div className="mt-3 space-y-1.5 text-sm flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-slate-500 text-xs">Market value</span>
                    <span className="font-semibold text-slate-900 tabular-nums">{formatUSD(b.total_market_value, 1)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-slate-500 text-xs">Lots</span>
                    <span className="font-semibold text-slate-900 tabular-nums">{formatNumber(b.count)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-slate-500 text-xs">Assmt. ratio</span>
                    <span className="font-semibold text-slate-900 tabular-nums">{formatPct(b.assessment_ratio)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-semibold text-blue-700">
                  Full profile <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MetricCard label="Total lots" value={formatNumber(data.citywide.total_properties)} accent={CATEGORICAL_ORDER[0]} />
          <MetricCard label="Total market value" value={formatUSD(data.citywide.total_market_value, 2)} accent={CATEGORICAL_ORDER[1]} />
          <MetricCard label="Boroughs" value={String(boroughs.length)} accent={CATEGORICAL_ORDER[2]} />
        </div>

        <div className="mt-10">
          <ChartCard title="Total market value by borough" sub="Sum of DOF market value estimates" height={360}>
            <BoroughValueChart boroughs={data.boroughs} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
