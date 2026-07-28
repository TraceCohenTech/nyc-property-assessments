import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Info, ArrowRight, Search } from "lucide-react";

import rentSummaryRaw from "@/data/rent/rent_summary.json";
import ownersIndexRaw from "@/data/owners/index.json";
import type { RentSummary } from "@/components/rent-regulation/types";
import type { OwnersIndex } from "@/lib/types";
import { formatNumber, formatPct } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";
import { ChartCard } from "@/components/ui/ChartCard";
import { StatusDefinitionCards } from "@/components/rent-regulation/StatusCards";
import { LookupTool } from "@/components/rent-regulation/LookupTool";
import { OwnerGroupsTable } from "@/components/rent-regulation/OwnerGroupsTable";
import {
  ConfirmedByBoroughChart,
  ConfirmedByAgeChart,
  ConfirmedByUnitBandChart,
  ConfirmedByOwnerTypeChart,
} from "@/components/rent-regulation/RentCharts";

const summary = rentSummaryRaw as unknown as RentSummary;
const ownersIndex = ownersIndexRaw as unknown as OwnersIndex;

const ownerSlugByName: Record<string, string> = Object.fromEntries(ownersIndex.owners.map((o) => [o.name, o.slug]));

export const metadata: Metadata = {
  title: "Rent Regulation — NYC Rent-Stabilized Buildings (Beta) | NYC Property Assessment Explorer",
  description:
    "Which NYC buildings are on the official HCR rent-stabilization registration list, joined to the FY2027 DOF assessment roll — by borough, age, size, and owner type. Building-level data only; never unit-level or tenant-level.",
};

export default function RentRegulationPage() {
  const boroughCount = summary.confirmed.by_borough.length;
  const overlapTotal = summary.overlap.candidate_and_hcr_confirmed + summary.overlap.candidate_only_not_in_hcr + summary.overlap.hcr_confirmed_not_candidate;

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <SourceBadge label="NYS HCR 2024 Building Registration File (via NYC Rent Guidelines Board)" />
          <ConfidenceBadge level="planned" label="Beta" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <ShieldCheck className="h-9 w-9 text-blue-600" aria-hidden="true" />
          Rent Regulation
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          Which NYC buildings appear on NYS Homes &amp; Community Renewal&apos;s official rent-stabilization building
          registration list — joined to the DOF FY2027 assessment roll by BBL.
        </p>

        <div className="mt-4 rounded-2xl bg-orange-50 border border-orange-200 p-4 sm:p-5 flex items-start gap-2.5 text-sm text-slate-700">
          <Info className="h-5 w-5 mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
          <div className="space-y-1.5">
            <p>
              <strong className="text-slate-900">Building ≠ unit.</strong> HCR&apos;s public list identifies buildings that
              registered <strong>at least one</strong> stabilized apartment — it does not say how many units in a building are
              stabilized. A building on this list can contain a mix of stabilized, market-rate, rent-controlled, commercial,
              and owner-occupied units.
            </p>
            <p>
              <strong className="text-slate-900">Rent-controlled ≠ rent-stabilized.</strong> These are two different, legally
              distinct regimes — this page is about stabilization (the HCR building-registration list), never controlled
              units, and this site never identifies individual tenants or claims a specific apartment&apos;s status.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<ShieldCheck className="h-4 w-4 text-blue-600" aria-hidden="true" />}
            label="HCR-confirmed buildings"
            value={formatNumber(summary.confirmed.total_buildings)}
            sub={`${formatPct(summary.join_stats.match_rate, 1)} of the HCR list matched to a roll BBL`}
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="Boroughs covered"
            value={boroughCount}
            sub="All five NYC boroughs"
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            label="Est. residential units in confirmed buildings"
            value="Not computed"
            sub="HCR's file identifies buildings, not unit counts — see caveat above; use the roll's own residential_units instead, with the same building-level caveat"
            accent={CATEGORICAL_ORDER[2]}
          />
          <MetricCard
            icon={<Info className="h-4 w-4 text-orange-600" aria-hidden="true" />}
            label="Likely structural candidates"
            value={formatNumber(summary.candidates.total_lots)}
            sub="Estimate — pre-1974, 6+ units, multifamily class. Not a registration."
            accent={CATEGORICAL_ORDER[3]}
          />
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">The five statuses this page tracks</h2>
          <StatusDefinitionCards />
        </section>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="HCR-confirmed buildings by borough" height={300}>
            <ConfirmedByBoroughChart rows={summary.confirmed.by_borough} />
          </ChartCard>
          <ChartCard title="HCR-confirmed buildings by construction era" height={300}>
            <ConfirmedByAgeChart rows={summary.confirmed.by_age_band} />
          </ChartCard>
          <ChartCard title="HCR-confirmed buildings by residential unit-count band" height={300}>
            <ConfirmedByUnitBandChart rows={summary.confirmed.by_unit_band} />
          </ChartCard>
          <ChartCard title="HCR-confirmed buildings by owner entity type" sub="Individual owners are never named — only aggregated" height={300}>
            <ConfirmedByOwnerTypeChart rows={summary.confirmed.by_owner_entity_type} />
          </ChartCard>
        </div>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <h2 className="font-bold text-slate-900 mb-1">Tax-benefit &amp; special-status flags</h2>
          <p className="text-xs text-slate-500 mb-4">
            HCR&apos;s file also flags certain regulatory statuses on confirmed buildings. These counts are non-exclusive — a
            building can carry more than one flag.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatNumber(summary.confirmed.flags.y421a)}</div>
              <DefinitionTooltip term="421-a">
                A property-tax exemption for new residential construction. In exchange, some or all units must be
                rent-stabilized for the exemption period (varies by program iteration).
              </DefinitionTooltip>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatNumber(summary.confirmed.flags.j51)}</div>
              <DefinitionTooltip term="J-51">
                A property-tax abatement/exemption for building rehabilitation or conversion work. Buildings receiving J-51
                benefits must keep their units rent-stabilized for the benefit period.
              </DefinitionTooltip>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {formatNumber(summary.confirmed.flags.coop_condo_conversion)}
              </div>
              <span className="text-xs text-slate-500">Coop/condo conversion</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatNumber(summary.confirmed.flags.hotel_sro)}</div>
              <span className="text-xs text-slate-500">Hotel / SRO / rooming house</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {formatNumber(summary.confirmed.flags.garden_complex)}
              </div>
              <span className="text-xs text-slate-500">Garden complex</span>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <h2 className="font-bold text-slate-900 mb-1">
            Estimate vs. confirmed: how much overlap is there?
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Comparing the {formatNumber(summary.candidates.total_lots)}-lot structural-candidate estimate to the{" "}
            {formatNumber(summary.confirmed.total_buildings)} HCR-confirmed buildings, across {formatNumber(overlapTotal)}{" "}
            total buildings touched by either.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
              <div className="text-xl font-bold text-emerald-800 tabular-nums">
                {formatNumber(summary.overlap.candidate_and_hcr_confirmed)}
              </div>
              <div className="text-xs text-emerald-800/80 mt-0.5">In both — the estimate and the registration agree</div>
            </div>
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
              <div className="text-xl font-bold text-orange-800 tabular-nums">
                {formatNumber(summary.overlap.candidate_only_not_in_hcr)}
              </div>
              <div className="text-xs text-orange-800/80 mt-0.5">
                Estimate-only — looks structurally eligible, not on the current HCR list (could be legitimately deregulated,
                administratively missing, or a false positive in the age/size heuristic)
              </div>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
              <div className="text-xl font-bold text-blue-800 tabular-nums">
                {formatNumber(summary.overlap.hcr_confirmed_not_candidate)}
              </div>
              <div className="text-xs text-blue-800/80 mt-0.5">
                HCR-confirmed but not a structural candidate (younger building, smaller building, or a 421-a/J-51 building
                that wouldn&apos;t otherwise qualify by age/size)
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Top entity owners of HCR-confirmed buildings</h2>
          <p className="text-sm text-slate-500 mb-4">
            Ranked by number of registered buildings. <strong className="text-slate-700">Entity owners only</strong> —
            LLCs, corporations, housing companies, nonprofits, and government agencies. Individual people are never named or
            ranked anywhere on this site.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
            <OwnerGroupsTable rows={summary.top_entity_owner_groups} ownerSlugByName={ownerSlugByName} />
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-600" aria-hidden="true" />
            Look up a building
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Search by street address or 10-digit BBL to see whether a specific building is on the HCR list, a structural
            candidate, or neither.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
            <LookupTool />
          </div>
        </section>

        <div className="mt-10 rounded-2xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600 leading-relaxed">
          Full methodology — source files, parse method, BBL join logic and confidence levels, the candidate-layer formula,
          and every caveat — is documented in{" "}
          <span className="font-mono text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5">
            RENT_REGULATION_METHODOLOGY.md
          </span>{" "}
          in the repo, summarized on the{" "}
          <Link href="/methodology" className="font-semibold text-blue-700 hover:underline">
            Methodology
          </Link>{" "}
          page.
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/housing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
            See the citywide housing stock this fits into <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/owners" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
            Explore the largest entity property owners <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/methodology" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
            Read the full methodology <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
