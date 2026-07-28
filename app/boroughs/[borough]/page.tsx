import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";

import raw from "@/data/aggregates.json";
import type { Aggregates } from "@/lib/types";
import { formatNumber, formatUSD, formatPct } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";

const data = raw as unknown as Aggregates;

function slugify(borough: string) {
  return borough.toLowerCase().replace(/\s+/g, "-");
}

function findBorough(slug: string) {
  return data.boroughs.find((b) => slugify(b.borough) === slug);
}

export function generateStaticParams() {
  return data.boroughs.map((b) => ({ borough: slugify(b.borough) }));
}

export async function generateMetadata({ params }: { params: Promise<{ borough: string }> }): Promise<Metadata> {
  const { borough: slug } = await params;
  const b = findBorough(slug);
  if (!b) return { title: "Borough not found" };
  return {
    title: `${b.borough} Property Assessments | NYC Property Assessment Explorer`,
    description: `${formatNumber(b.count)} tax lots and ${formatUSD(b.total_market_value, 1)} in DOF market value across ${b.borough}, from the FY2027 assessment roll.`,
  };
}

const TAX_CLASS_LABEL: Record<string, string> = {
  "1": "Class 1 — 1-3 family homes",
  "2": "Class 2 — Rentals & co-ops/condos",
  "3": "Class 3 — Utility",
  "4": "Class 4 — Commercial",
};

export default async function BoroughDetailPage({ params }: { params: Promise<{ borough: string }> }) {
  const { borough: slug } = await params;
  const b = findBorough(slug);
  if (!b) notFound();

  const rankByValue = [...data.boroughs].sort((x, y) => y.total_market_value - x.total_market_value).findIndex((x) => x.borough === b.borough) + 1;
  const rankByCount = [...data.boroughs].sort((x, y) => y.count - x.count).findIndex((x) => x.borough === b.borough) + 1;

  const byTaxClass = Object.entries(b.by_tax_class).sort((a, z) => a[0].localeCompare(z[0]));

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2">
          <SourceBadge />
          <Link href="/boroughs" className="text-xs font-semibold text-blue-700 hover:underline">
            ← All boroughs
          </Link>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">{b.borough}</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          Ranked #{rankByValue} of 5 boroughs by total market value, #{rankByCount} by lot count.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Tax lots" value={formatNumber(b.count)} accent={CATEGORICAL_ORDER[0]} />
          <MetricCard label="Total market value" value={formatUSD(b.total_market_value, 1)} accent={CATEGORICAL_ORDER[1]} />
          <MetricCard label="Total assessed value" value={formatUSD(b.total_assessed_value, 1)} accent={CATEGORICAL_ORDER[2]} />
          <MetricCard label="Assessment ratio" value={formatPct(b.assessment_ratio)} sub="Assessed ÷ market" accent={CATEGORICAL_ORDER[3]} />
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <h2 className="font-bold text-slate-900 mb-1">By tax class</h2>
          <p className="text-xs text-slate-500 mb-4">How {b.borough}'s lots split across the four DOF tax classes.</p>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Tax class</th>
                  <th className="py-2 pr-3 text-right">Lots</th>
                  <th className="py-2 pr-3 text-right">Market value</th>
                  <th className="py-2 pr-3 text-right">Assessed value</th>
                  <th className="py-2 pr-3 text-right">Assmt. ratio</th>
                </tr>
              </thead>
              <tbody>
                {byTaxClass.map(([cls, row]) => (
                  <tr key={cls} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-semibold text-slate-900">{TAX_CLASS_LABEL[cls] ?? `Class ${cls}`}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatNumber(row.count)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatUSD(row.total_market_value, 1)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatUSD(row.total_assessed_value, 1)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold text-blue-700">{formatPct(row.assessment_ratio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-5 flex items-start gap-2 text-sm text-slate-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
          <span>
            Want individual properties in {b.borough}? The full Property Explorer (with per-lot filtering by
            value, tax class, and building type) is landing in a later build — for now, use{" "}
            <Link href="/#search" className="font-semibold text-blue-700 hover:underline">
              address / owner / BBL search
            </Link>
            .
          </span>
        </div>

        <Link href={`/explorer?borough=${encodeURIComponent(b.borough)}`} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
          Open {b.borough} in Property Explorer <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
