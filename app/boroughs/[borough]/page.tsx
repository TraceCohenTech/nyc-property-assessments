import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Info, TrendingDown, TrendingUp } from "lucide-react";

import raw from "@/data/aggregates.json";
import aliasIndexRaw from "@/data/owners/alias-index.json";
import type { Aggregates, BoroughProfile } from "@/lib/types";
import { formatNumber, formatUSD, formatUSDFull, formatPct } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ChartCard } from "@/components/ui/ChartCard";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";
import { EntityMixChart, PropertyTypeDistChart, TaxClassDistChart, ValueBandDistChart } from "@/components/boroughs/BoroughCharts";
import { ZipBreakdownTable } from "@/components/boroughs/ZipBreakdownTable";
import { TopEntityOwnersTable } from "@/components/boroughs/TopEntityOwnersTable";
import { TopPropertiesTable } from "@/components/boroughs/TopPropertiesTable";

const data = raw as unknown as Aggregates;
const aliasIndex = aliasIndexRaw as unknown as Record<string, string>;

const BOROUGH_SLUGS: Record<string, string> = {
  Manhattan: "manhattan",
  Brooklyn: "brooklyn",
  Queens: "queens",
  Bronx: "bronx",
  "Staten Island": "staten-island",
};

function slugify(borough: string) {
  return borough.toLowerCase().replace(/\s+/g, "-");
}

async function loadBoroughProfile(name: string): Promise<BoroughProfile | null> {
  const file = BOROUGH_SLUGS[name];
  if (!file) return null;
  try {
    const mod = (await import(`@/data/borough/${file}.json`)) as { default: BoroughProfile };
    return mod.default;
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return Object.keys(BOROUGH_SLUGS).map((b) => ({ borough: slugify(b) }));
}

export async function generateMetadata({ params }: { params: Promise<{ borough: string }> }): Promise<Metadata> {
  const { borough: slug } = await params;
  const name = Object.keys(BOROUGH_SLUGS).find((b) => slugify(b) === slug);
  if (!name) return { title: "Borough not found" };
  const profile = await loadBoroughProfile(name);
  return {
    title: `${name} Property Assessments | NYC Property Assessment Explorer`,
    description: profile
      ? `${formatNumber(profile.totals.count)} tax lots and ${formatUSD(profile.totals.total_market_value, 1)} in DOF market value across ${name}, from the FY2027 assessment roll.`
      : `${name} property assessment profile.`,
  };
}

const TAX_CLASS_LABEL: Record<string, string> = {
  "1": "Class 1 — 1-3 family homes",
  "2": "Class 2 — Rentals & co-ops/condos",
  "3": "Class 3 — Utility",
  "4": "Class 4 — Commercial",
};

function TrendBadge({ delta, higherIsNotable = true }: { delta: number; higherIsNotable?: boolean }) {
  const up = delta >= 0;
  const good = higherIsNotable ? up : !up;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${good ? "text-emerald-700" : "text-orange-700"}`}>
      {up ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
      {formatPct(Math.abs(delta), 0)} vs. citywide avg
    </span>
  );
}

export default async function BoroughDetailPage({ params }: { params: Promise<{ borough: string }> }) {
  const { borough: slug } = await params;
  const name = Object.keys(BOROUGH_SLUGS).find((b) => slugify(b) === slug);
  if (!name) notFound();
  const b = data.boroughs.find((x) => x.borough === name);
  const profile = await loadBoroughProfile(name);
  if (!b || !profile) notFound();

  const rankByValue = [...data.boroughs].sort((x, y) => y.total_market_value - x.total_market_value).findIndex((x) => x.borough === name) + 1;
  const rankByCount = [...data.boroughs].sort((x, y) => y.count - x.count).findIndex((x) => x.borough === name) + 1;
  const byTaxClass = Object.entries(b.by_tax_class).sort((a, z) => a[0].localeCompare(z[0]));

  // Citywide-average comparison indicators — computed as the simple average across all 5
  // borough profiles (not lot-weighted), which is the natural "vs. the other boroughs" baseline
  // for a per-borough profile page (a lot-weighted citywide mean would just echo Manhattan and
  // Brooklyn's dominance back at every borough).
  const allProfiles = await Promise.all(Object.keys(BOROUGH_SLUGS).map((n) => loadBoroughProfile(n)));
  const valid = allProfiles.filter((p): p is BoroughProfile => !!p);
  const avgValuePerUnit = valid.reduce((s, p) => s + p.medians.median_value_per_resid_unit, 0) / valid.length;
  const avgMedianValue = valid.reduce((s, p) => s + p.medians.median_market_value, 0) / valid.length;
  const avgYearBuilt = valid.reduce((s, p) => s + p.medians.avg_year_built, 0) / valid.length;
  const avgLlcShare =
    valid.reduce((s, p) => {
      const total = p.entity_mix.reduce((ss, t) => ss + t.total_value, 0);
      const llc = p.entity_mix.find((t) => t.type === "LLC")?.total_value ?? 0;
      return s + (total > 0 ? llc / total : 0);
    }, 0) / valid.length;
  const thisLlcShare = (() => {
    const total = profile.entity_mix.reduce((ss, t) => ss + t.total_value, 0);
    const llc = profile.entity_mix.find((t) => t.type === "LLC")?.total_value ?? 0;
    return total > 0 ? llc / total : 0;
  })();

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2">
          <SourceBadge />
          <Link href="/boroughs" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> All boroughs
          </Link>
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">{name}</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          Ranked #{rankByValue} of 5 boroughs by total market value, #{rankByCount} by lot count.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Tax lots" value={formatNumber(profile.totals.count)} accent={CATEGORICAL_ORDER[0]} />
          <MetricCard label="Total market value" value={formatUSD(profile.totals.total_market_value, 1)} accent={CATEGORICAL_ORDER[1]} />
          <MetricCard label="Total assessed value" value={formatUSD(profile.totals.total_assessed_value, 1)} accent={CATEGORICAL_ORDER[2]} />
          <MetricCard label="Residential units" value={formatNumber(profile.totals.residential_units)} accent={CATEGORICAL_ORDER[3]} />
          <MetricCard label="Assessment ratio" value={formatPct(b.assessment_ratio)} sub="Assessed ÷ market" accent={CATEGORICAL_ORDER[4]} />
          <MetricCard
            label="Median market value"
            value={formatUSDFull(profile.medians.median_market_value)}
            sub={<TrendBadge delta={profile.medians.median_market_value / avgMedianValue - 1} />}
            accent={CATEGORICAL_ORDER[5]}
          />
          <MetricCard
            label={
              <DefinitionTooltip term="Value per unit">Total market value divided by residential units — a rough proxy for per-apartment value.</DefinitionTooltip>
            }
            value={formatUSDFull(profile.medians.median_value_per_resid_unit)}
            sub={<TrendBadge delta={profile.medians.median_value_per_resid_unit / avgValuePerUnit - 1} />}
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="Avg. year built"
            value={String(profile.medians.avg_year_built)}
            sub={<TrendBadge delta={profile.medians.avg_year_built / avgYearBuilt - 1} higherIsNotable={false} />}
            accent={CATEGORICAL_ORDER[1]}
          />
        </div>

        <div className="mt-2 text-xs text-slate-500">&ldquo;vs. citywide avg&rdquo; compares this borough to the simple average across all 5 boroughs.</div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <h2 className="font-bold text-slate-900 mb-1">By tax class</h2>
          <p className="text-xs text-slate-500 mb-4">How {name}'s lots split across the four DOF tax classes.</p>
          <p className="sm:hidden text-[11px] text-slate-400 mb-1.5">Swipe to see all columns &rarr;</p>
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

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Ownership mix by entity type"
            sub={`LLC share of value: ${formatPct(thisLlcShare)} (citywide avg: ${formatPct(avgLlcShare)})`}
            height={300}
          >
            <EntityMixChart rows={profile.entity_mix} />
          </ChartCard>
          <ChartCard title="Properties by type" sub="Top 10 property types" height={300}>
            <PropertyTypeDistChart rows={profile.property_type_distribution} />
          </ChartCard>
          <ChartCard title="Properties by tax class" height={300}>
            <TaxClassDistChart rows={profile.tax_class_distribution} />
          </ChartCard>
          <ChartCard title="Properties by value band" height={300}>
            <ValueBandDistChart rows={profile.value_band_distribution} />
          </ChartCard>
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <TopEntityOwnersTable owners={profile.top_entity_owners} aliasIndex={aliasIndex} borough={name} />
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <TopPropertiesTable rows={profile.top_properties} borough={name} />
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <ZipBreakdownTable rows={profile.zip_breakdown} borough={name} />
        </div>

        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-5 flex items-start gap-2 text-sm text-slate-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
          <span>
            Want individual properties in {name}? Use the full{" "}
            <Link href={`/explorer?borough=${encodeURIComponent(name)}`} className="font-semibold text-blue-700 hover:underline">
              Property Explorer
            </Link>{" "}
            with per-lot filtering by value, tax class, and building type.
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-4">
          <Link href={`/explorer?borough=${encodeURIComponent(name)}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            Open {name} in Property Explorer <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/boroughs#compare" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            Compare {name} to another borough <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
