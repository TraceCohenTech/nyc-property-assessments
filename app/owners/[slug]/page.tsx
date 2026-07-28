import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";

import ownersIndexRaw from "@/data/owners/index.json";
import type { OwnerProfile, OwnersIndex } from "@/lib/types";
import { formatNumber, formatUSDFull } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { ChartCard } from "@/components/ui/ChartCard";
import { OwnerBadge } from "@/components/ui/OwnerBadge";
import { entityTypeColor } from "@/components/owners/entityTypeColors";
import { BoroughDistChart, PropertyTypeDistChart, TaxClassDistChart, ValueBandDistChart, YearBuiltDistChart } from "@/components/owners/OwnerCharts";
import { OwnerTopPropertiesTable } from "@/components/owners/OwnerTopPropertiesTable";
import { AliasList } from "@/components/owners/AliasList";

const ownersIndex = ownersIndexRaw as unknown as OwnersIndex;

async function loadProfile(slug: string): Promise<OwnerProfile | null> {
  try {
    const mod = (await import(`@/data/owners/${slug}.json`)) as { default: OwnerProfile };
    return mod.default;
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return ownersIndex.owners.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) return { title: "Owner not found" };
  return {
    title: `NYC's Largest Property Owners — ${profile.name} | NYC Property Assessment Explorer`,
    description: `${profile.name} (${profile.owner_type}) holds ${formatNumber(profile.totals.lots)} tax lots worth ${formatUSDFull(profile.totals.total_market_value)} in total market value across NYC, per the DOF FY2027 assessment roll.`,
  };
}

export default async function OwnerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) notFound();

  const rank = ownersIndex.owners.findIndex((o) => o.slug === slug) + 1;

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <SourceBadge />
          <Link href="/owners" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
            <ArrowLeft className="h-3 w-3" aria-hidden="true" /> All owners
          </Link>
        </div>

        <div className="flex items-start gap-3 flex-wrap">
          <span className="h-3 w-3 rounded-full mt-2 shrink-0" style={{ background: entityTypeColor(profile.owner_type) }} aria-hidden="true" />
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900">{profile.name}</h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-sm">
              <span className="font-semibold text-slate-600">{profile.owner_type}</span>
              <ConfidenceBadge level={profile.confidence} />
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">Ranked #{rank} of {ownersIndex.owners.length} owner groups by total market value</span>
            </div>
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm text-slate-600 leading-relaxed">
          {profile.evidence === "curated-agency-match" &&
            "Consolidated from multiple DOF filing spellings into one canonical government agency, per a curated agency list."}
          {profile.evidence === "generic-government-fallback" &&
            "A government-classified owner that didn't match one of the curated named agencies — grouped into a generic government bucket rather than left fragmented."}
          {profile.evidence === "exact-normalized-match" &&
            (profile.alias_count > 1
              ? `Consolidated from ${profile.alias_count} exact formatting-variant spellings of the same legal entity (punctuation/spacing/suffix differences only — never merged on shared address or partial name match).`
              : "Filed under a single consistent spelling — no formatting variants to consolidate.")}
        </p>

        {profile.aliases.length > 1 && <AliasList aliases={profile.aliases} />}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Tax lots" value={formatNumber(profile.totals.lots)} accent={CATEGORICAL_ORDER[0]} />
          <MetricCard label="Total market value" value={formatUSDFull(profile.totals.total_market_value)} accent={CATEGORICAL_ORDER[1]} />
          <MetricCard label="Total assessed value" value={formatUSDFull(profile.totals.total_assessed_value)} accent={CATEGORICAL_ORDER[2]} />
          <MetricCard
            label="Residential / total units"
            value={`${formatNumber(profile.totals.residential_units)} / ${formatNumber(profile.totals.total_units)}`}
            sub={`Across ${profile.totals.borough_count} borough${profile.totals.borough_count === 1 ? "" : "s"}`}
            accent={CATEGORICAL_ORDER[3]}
          />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Properties by borough" height={300}>
            <BoroughDistChart rows={profile.borough_distribution} />
          </ChartCard>
          <ChartCard title="Properties by type" sub="Top 10 property types held" height={300}>
            <PropertyTypeDistChart rows={profile.property_type_distribution} />
          </ChartCard>
          <ChartCard title="Properties by tax class" height={300}>
            <TaxClassDistChart rows={profile.tax_class_distribution} />
          </ChartCard>
          <ChartCard title="Properties by value band" height={300}>
            <ValueBandDistChart rows={profile.value_band_distribution} />
          </ChartCard>
        </div>

        <div className="mt-6">
          <ChartCard title="Properties by construction era" height={300}>
            <YearBuiltDistChart rows={profile.year_built_distribution} />
          </ChartCard>
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <OwnerTopPropertiesTable properties={profile.top_properties} ownerName={profile.name} />
        </div>

        {profile.zip_spread.length > 0 && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
            <h2 className="font-bold text-slate-900 mb-1">Zip code spread</h2>
            <p className="text-xs text-slate-500 mb-4">Where {profile.name}'s holdings concentrate, by zip code.</p>
            <div className="flex flex-wrap gap-2">
              {profile.zip_spread.map((z) => (
                <Link
                  key={z.zip}
                  href={`/explorer?zip=${encodeURIComponent(z.zip)}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {z.zip} <span className="text-slate-400">·</span> {formatNumber(z.lots)} lots
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-5 flex items-start gap-2 text-sm text-slate-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
          <span>
            Every property listed above is an individually filed DOF tax lot — owner names shown are entities only (LLCs,
            corporations, trusts, government agencies), never individual people. See the{" "}
            <Link href="/methodology#owner-consolidation" className="font-semibold text-blue-700 hover:underline">
              consolidation methodology
            </Link>{" "}
            for how spelling variants are merged.
          </span>
        </div>

        <Link
          href={`/explorer?owner=${encodeURIComponent(profile.name)}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline"
        >
          Open {profile.name} in Property Explorer <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
