import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Layers, TrendingUp } from "lucide-react";

import insightsRaw from "@/data/insights.json";
import type { InsightsData } from "@/lib/types";
import { formatNumber, formatPct, formatUSDFull } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ChartCard } from "@/components/ui/ChartCard";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";
import { ConcentrationCurveChart } from "@/components/value-concentration/ConcentrationCurveChart";
import { ValueBandTable } from "@/components/value-concentration/ValueBandTable";
import { TopNChart } from "@/components/value-concentration/TopNChart";

const insights = insightsRaw as unknown as InsightsData;

export const metadata: Metadata = {
  title: "Value Concentration — Who Really Holds NYC Property Value | NYC Property Assessment Explorer",
  description:
    "How concentrated is NYC property value? A small share of the city's highest-value tax lots hold the majority of total market value — the full Lorenz curve, value-band breakdown, and top-N concentration stats from the DOF FY2027 roll.",
};

export default function ValueConcentrationPage() {
  const c = insights.concentration;
  const top100 = c.top_n_breakdown.find((b) => b.n === 100);
  const top1k = c.top_n_breakdown.find((b) => b.n === 1000);
  const top10k = c.top_n_breakdown.find((b) => b.n === 10000);
  const top50k = c.top_n_breakdown.find((b) => b.n === 50000);

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Value Concentration</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          NYC property value is held very unevenly across its {formatNumber(1_167_962)} tax lots. Just{" "}
          <strong className="text-slate-800">{formatPct(c.pct_lots_for_50pct_value, 1)}</strong> of lots — the highest-value
          ones — account for half of the city's total market value.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<TrendingUp className="h-4 w-4 text-blue-600" aria-hidden="true" />}
            label="Lots for 50% of value"
            value={formatPct(c.pct_lots_for_50pct_value, 1)}
            sub="Of all tax lots citywide"
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            icon={<Layers className="h-4 w-4 text-orange-600" aria-hidden="true" />}
            label="Lots for 80% of value"
            value={formatPct(c.pct_lots_for_80pct_value, 1)}
            sub="Of all tax lots citywide"
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            icon={<Building2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
            label="Lots worth $10M+"
            value={formatNumber(c.lots_above_10m)}
            sub={
              <Link href="/explorer?value_min=10000000" className="text-blue-700 font-semibold hover:underline">
                Open in Property Explorer
              </Link>
            }
            accent={CATEGORICAL_ORDER[2]}
          />
          <MetricCard
            icon={<Building2 className="h-4 w-4 text-red-600" aria-hidden="true" />}
            label="Lots worth $50M+"
            value={formatNumber(c.lots_above_50m)}
            sub={
              <Link href="/explorer?value_min=50000000" className="text-blue-700 font-semibold hover:underline">
                Open in Property Explorer
              </Link>
            }
            accent={CATEGORICAL_ORDER[3]}
          />
        </div>

        <div className="mt-10">
          <ChartCard
            title="The concentration curve"
            sub="Also called a Lorenz curve — the further this line bows above the diagonal, the more concentrated NYC property value is among fewer lots"
            height={420}
          >
            <ConcentrationCurveChart curve={c.curve} />
          </ChartCard>
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <ValueBandTable bands={insights.value_bands} />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <ChartCard title="Top-N concentration" sub="Share of citywide market value held by the N highest-value lots" height={320}>
            <TopNChart breakdown={c.top_n_breakdown} />
          </ChartCard>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
            <h2 className="font-bold text-slate-900 mb-3">Headline numbers</h2>
            <ul className="space-y-3 text-sm text-slate-700">
              {top100 && (
                <li>
                  The <strong>top 100</strong> highest-value tax lots alone hold{" "}
                  <strong className="text-blue-700">{formatPct(top100.share, 1)}</strong> of all NYC property market value
                  ({formatUSDFull(top100.total_value)}).
                </li>
              )}
              {top1k && (
                <li>
                  The <strong>top 1,000</strong> lots hold <strong className="text-blue-700">{formatPct(top1k.share, 1)}</strong>{" "}
                  ({formatUSDFull(top1k.total_value)}).
                </li>
              )}
              {top10k && (
                <li>
                  The <strong>top 10,000</strong> lots — well under 1% of all lots citywide — hold{" "}
                  <strong className="text-blue-700">{formatPct(top10k.share, 1)}</strong> ({formatUSDFull(top10k.total_value)}).
                </li>
              )}
              {top50k && (
                <li>
                  The <strong>top 50,000</strong> lots hold <strong className="text-blue-700">{formatPct(top50k.share, 1)}</strong>{" "}
                  ({formatUSDFull(top50k.total_value)}).
                </li>
              )}
              <li>
                <strong className="text-slate-900">{formatNumber(c.lots_above_50m)} lots</strong> are individually worth{" "}
                <DefinitionTooltip term="$50M+">DOF's total market value estimate for the lot, not a sale price.</DefinitionTooltip> — together they hold roughly{" "}
                <strong className="text-blue-700">
                  {formatPct(insights.value_bands.find((b) => b.band === "$50M+")?.share_value ?? 0, 1)}
                </strong>{" "}
                of citywide value.
              </li>
            </ul>
            <Link
              href="/owners"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline"
            >
              See which entity owners hold the most of that value <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-5 text-sm text-slate-700">
          Concentration among the largest lots is closely tied to housing scale, too — see how it plays out in{" "}
          <Link href="/housing" className="font-semibold text-blue-700 hover:underline">
            unit-size distribution on the Housing page
          </Link>
          , where a small number of very large buildings hold a disproportionate share of residential units.
        </div>
      </div>
    </div>
  );
}
