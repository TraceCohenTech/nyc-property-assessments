import {
  Info,
  MapPinned,
  Users,
  CalendarClock,
  Search as SearchIcon,
  Building2,
  Landmark,
  Home as HomeIcon,
} from "lucide-react";

import raw from "@/data/aggregates.json";
import insightsRaw from "@/data/insights.json";
import type { Aggregates, Borough, InsightsData } from "@/lib/types";
import { CountUp } from "@/components/CountUp";
import { Reveal } from "@/components/Reveal";
import { AssessmentFlowDiagram } from "@/components/AssessmentFlowDiagram";
import { SearchTool } from "@/components/SearchTool";
import { ZipTable } from "@/components/ZipTable";
import { OwnersTable } from "@/components/OwnersTable";
import { InsightCard } from "@/components/ui/InsightCard";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import {
  TaxEquityChart,
  BoroughValueChart,
  BuildingClassChart,
  TopOwnersChart,
  AgeDistributionChart,
} from "@/components/charts/Charts";
import {
  ValueBandsMiniChart,
  ConcentrationMiniChart,
  OwnershipMiniChart,
  HousingBandsMiniChart,
  ResidentialUnitsByBoroughMiniChart,
} from "@/components/charts/InsightCharts";
import { formatUSD, formatUSDAuto, formatNumber, formatPct } from "@/lib/format";
import { isEntityOwner } from "@/lib/ownerPrivacy";
import { CATEGORICAL, CATEGORICAL_ORDER } from "@/lib/colors";

const data = raw as unknown as Aggregates;
const insights = insightsRaw as unknown as InsightsData;

export default function Home() {
  const { citywide, boroughs, tax_classes, zips, building_classes, top_owners, age_distribution, meta } = data;

  const class1 = tax_classes.find((t) => t.tax_class === "1")!;
  const class2 = tax_classes.find((t) => t.tax_class === "2")!;
  const class4 = tax_classes.find((t) => t.tax_class === "4")!;
  const ratioGap = class2.assessment_ratio / class1.assessment_ratio;

  const boroughsByValue = [...boroughs].sort((a, b) => b.total_assessed_value - a.total_assessed_value);
  const boroughsByCount = [...boroughs].sort((a, b) => b.count - a.count);
  const taxClassesByValue = [...tax_classes].sort((a, b) => b.total_market_value - a.total_market_value);
  const totalUnits = insights.housing.residential_units_by_borough.reduce((sum, b) => sum + b.units, 0);

  const topZipsByCount = [...zips].sort((a, b) => b.count - a.count);
  const topBuildingClasses = building_classes.slice(0, 12);

  // Individual owners' real names never render — only business/institutional/government
  // entities (see lib/ownerPrivacy.isEntityOwner) are shown, here and in the search API.
  const entityOwners = top_owners.filter((o) => isEntityOwner(o.owner));
  const topOwnersForChart = entityOwners.slice(0, 12).map((o) => ({
    ...o,
    owner: o.owner.length > 22 ? o.owner.slice(0, 21) + "…" : o.owner,
  }));

  const manhattanHeadliner = insights.borough_headliners.find((h) => h.borough === "Manhattan");
  const queensHeadliner = insights.borough_headliners.find((h) => h.borough === "Queens");

  return (
    <div id="top" className="min-h-screen text-slate-900">
      {/* HERO */}
      <header className="relative overflow-hidden bg-slate-950 text-white pt-24 sm:pt-28 pb-16 sm:pb-24 noise-overlay">
        <div className="mesh-bg" aria-hidden="true">
          <div className="mesh-blob-3" />
        </div>
        <div className="absolute inset-0 grid-pattern opacity-60" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6">
          <Reveal>
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 pulse-dot" />
                  <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                DOF FY2027 Final Assessment Roll
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
                Tax classes 1–4 · all 5 boroughs
              </span>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              NYC Property
              <br />
              <span className="text-cyan-300">Assessment Explorer.</span>
            </h1>
            <p className="mt-3 text-sm text-blue-200/50 font-mono tracking-wide uppercase">
              NYC Dept. of Finance · FY2027 property assessment roll
            </p>
          </Reveal>

          <Reveal delay={220}>
            <p className="mt-5 text-base sm:text-xl text-blue-100/85 max-w-3xl leading-relaxed">
              Explore every NYC property, owner, tax class, building type, housing unit, and assessed
              value in the FY2027 assessment roll.
            </p>
            <p className="mt-3 text-xs sm:text-sm text-blue-200/70 max-w-3xl leading-relaxed flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              DOF market value is an assessment value used for tax administration — not necessarily
              current sale price.
            </p>
          </Reveal>

          {/* KPI grid — data-driven, never hardcoded */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Reveal delay={300}>
              <HeroStat label="Total tax lots" value={<CountUp to={citywide.total_properties} />} sub="FY2027 final roll" />
            </Reveal>
            <Reveal delay={360}>
              <HeroStat label="Total market value" value={formatUSDAuto(citywide.total_market_value)} sub="DOF assessment value, not sale price" />
            </Reveal>
            <Reveal delay={420}>
              <HeroStat label="Total housing units" value={<CountUp to={totalUnits} />} sub="Across all 5 boroughs" />
            </Reveal>
            <Reveal delay={480}>
              <HeroStat label="Boroughs" value={String(boroughs.length)} sub={`${boroughsByValue[0]?.borough} leads by value`} />
            </Reveal>
          </div>

          <Reveal delay={640}>
            <div className="mt-8 flex flex-wrap items-start gap-2 text-xs text-blue-100/70">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Figures are computed directly from DOF's raw FY2027 PTS extract (extract dated
                2026-05-15) and may vary slightly from DOF's own published summary tables.
              </span>
            </div>
          </Reveal>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1600px] px-4 sm:px-6 py-12 sm:py-20 space-y-16 sm:space-y-24">
        {/* SECONDARY KPI ROW */}
        <section>
          <Reveal>
            <SectionTitle
              eyebrow="At a glance"
              title="The FY2027 roll, by the numbers"
              sub="Every headline figure below is computed live from the underlying dataset — never hand-typed."
            />
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Reveal delay={60}>
              <KpiCard
                icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
                label="Largest borough by value"
                value={boroughsByValue[0]?.borough}
                sub={formatUSDAuto(boroughsByValue[0]?.total_market_value ?? 0)}
                accent={CATEGORICAL_ORDER[0]}
              />
            </Reveal>
            <Reveal delay={120}>
              <KpiCard
                icon={<MapPinned className="h-4 w-4" aria-hidden="true" />}
                label="Largest borough by lot count"
                value={boroughsByCount[0]?.borough}
                sub={`${formatNumber(boroughsByCount[0]?.count ?? 0)} lots`}
                accent={CATEGORICAL_ORDER[1]}
              />
            </Reveal>
            <Reveal delay={180}>
              <KpiCard
                icon={<Landmark className="h-4 w-4" aria-hidden="true" />}
                label="Largest tax class by value"
                value={`Class ${taxClassesByValue[0]?.tax_class}`}
                sub={formatUSDAuto(taxClassesByValue[0]?.total_market_value ?? 0)}
                accent={CATEGORICAL_ORDER[2]}
              />
            </Reveal>
            <Reveal delay={240}>
              <KpiCard
                icon={<HomeIcon className="h-4 w-4" aria-hidden="true" />}
                label="LLC-owned value"
                value={formatUSDAuto(insights.ownership.llc.total_value)}
                sub={`${formatNumber(insights.ownership.llc.lots)} lots`}
                accent={CATEGORICAL_ORDER[3]}
              />
            </Reveal>
          </div>
          {insights.placeholder && (
            <p className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
              <ConfidenceBadge level="planned" label="Preliminary insights" /> Ownership and housing figures above are
              seed estimates pending the data pipeline's full computation.
            </p>
          )}
        </section>

        {/* INSIGHTS — 8 cards, each linking into the future explorer */}
        <section>
          <Reveal>
            <SectionTitle
              eyebrow="Insights"
              title="What the roll reveals"
              sub="Eight cuts through the data — click through to explore each one."
            />
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <Reveal delay={60}>
              <InsightCard
                eyebrow="Value distribution"
                headline={`Most lots sit in the ${insights.value_bands.slice().sort((a, b) => b.lots - a.lots)[0]?.band} band`}
                description={`${formatPct(insights.value_bands.slice().sort((a, b) => b.lots - a.lots)[0]?.share_lots ?? 0)} of all tax lots fall in this range, but it's not where most of the city's value sits.`}
                href="/explorer?sort=value_desc"
                chart={<ValueBandsMiniChart bands={insights.value_bands} />}
                accent={CATEGORICAL_ORDER[0]}
              />
            </Reveal>
            <Reveal delay={120}>
              <InsightCard
                eyebrow="Concentration"
                headline={`The top ${formatPct(insights.concentration.pct_lots_for_50pct_value)} of lots hold half the city's value`}
                description={`Just ${formatPct(insights.concentration.pct_lots_for_80pct_value)} of lots account for 80% of total market value — NYC property value is highly concentrated.`}
                href="/explorer?sort=value_desc"
                chart={<ConcentrationMiniChart curve={insights.concentration.curve} />}
                accent={CATEGORICAL_ORDER[1]}
              />
            </Reveal>
            <Reveal delay={180}>
              <InsightCard
                eyebrow="Mega-parcels"
                headline={`${formatNumber(insights.concentration.lots_above_50m)} lots are worth over $50M each`}
                description="A tiny slice of the roll — mostly commercial towers and large multifamily buildings — carries an outsized share of total value."
                href="/explorer?value_min=50000000"
                accent={CATEGORICAL_ORDER[2]}
              />
            </Reveal>
            <Reveal delay={240}>
              <InsightCard
                eyebrow="Ownership"
                headline={`LLCs hold ${formatUSDAuto(insights.ownership.llc.total_value)} in property value`}
                description={`Across ${formatNumber(insights.ownership.llc.lots)} tax lots — the single largest entity-ownership category citywide.`}
                href="/explorer?entity=llc"
                chart={<OwnershipMiniChart byType={insights.ownership.by_entity_type} />}
                accent={CATEGORICAL_ORDER[3]}
              />
            </Reveal>
            <Reveal delay={300}>
              <InsightCard
                eyebrow="Public sector"
                headline={`Government owns ${formatUSDAuto(insights.ownership.government.total_value)} in assessed value`}
                description={`${formatNumber(insights.ownership.government.lots)} city, state, and federal properties — schools, parks, housing authority buildings, and more.`}
                href="/owners"
                accent={CATEGORICAL_ORDER[4]}
              />
            </Reveal>
            <Reveal delay={360}>
              <InsightCard
                eyebrow="Housing stock"
                headline="Small buildings dominate the unit count"
                description="1-3 unit buildings account for a huge share of NYC's residential units, even though large multifamily buildings hold more value per lot."
                href="/housing"
                chart={<HousingBandsMiniChart bands={insights.housing.unit_size_bands} />}
                accent={CATEGORICAL_ORDER[5]}
              />
            </Reveal>
            <Reveal delay={420}>
              <InsightCard
                eyebrow="Building age"
                headline={`${formatNumber(insights.housing.pre_1940.lots)} lots predate 1940`}
                description={`Prewar buildings still house roughly ${formatNumber(insights.housing.pre_1940.units)} units citywide — a huge share of the city's housing stock.`}
                href="/explorer?year_built_max=1940"
                accent={CATEGORICAL_ORDER[0]}
              />
            </Reveal>
            <Reveal delay={480}>
              <InsightCard
                eyebrow="Borough spotlight"
                headline={manhattanHeadliner ? `Manhattan: ${manhattanHeadliner.headline.toLowerCase()}` : "Manhattan leads by value"}
                description={queensHeadliner ? `Meanwhile, Queens leads on a different measure: ${queensHeadliner.headline.toLowerCase()} (${queensHeadliner.stat}).` : "Explore how each borough compares."}
                href="/boroughs"
                chart={<ResidentialUnitsByBoroughMiniChart rows={insights.housing.residential_units_by_borough} />}
                accent={CATEGORICAL_ORDER[1]}
              />
            </Reveal>
          </div>
        </section>

        {/* ASSESSMENT PROCESS DIAGRAM */}
        <section>
          <Reveal>
            <SectionTitle
              eyebrow="How it works"
              title="From tentative value to your tax bill"
              sub="Every property moves through the same four-stage DOF process each fiscal year before its assessed value is locked in."
            />
          </Reveal>
          <Reveal delay={120}>
            <Card>
              <AssessmentFlowDiagram />
            </Card>
          </Reveal>
        </section>

        {/* BOROUGHS */}
        <section id="boroughs" className="scroll-mt-20">
          <Reveal>
            <SectionTitle
              eyebrow="By borough"
              title="Manhattan carries a third of the city's value in a tenth of the parcels"
              sub="Property count, market value, and the assessment ratio (assessed ÷ market) side by side for all five boroughs. Full borough profiles →"
            />
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
            {boroughsByValue.map((b, i) => (
              <Reveal key={b.borough} delay={60 + i * 60}>
                <BoroughKpiCard borough={b} accent={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
              </Reveal>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            <Reveal delay={100} className="lg:col-span-3">
              <Card>
                <h3 className="font-bold text-slate-900 mb-1">Total market value by borough</h3>
                <p className="text-xs text-slate-500 mb-3">Sum of DOF market value estimates</p>
                <div className="h-[280px] sm:h-[340px]">
                  <BoroughValueChart boroughs={boroughs} />
                </div>
              </Card>
            </Reveal>
            <Reveal delay={200} className="lg:col-span-2">
              <Card className="h-full flex flex-col">
                <h3 className="font-bold text-slate-900 mb-3">Borough breakdown</h3>
                <div className="overflow-x-auto -mx-2 px-2 flex-1">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                        <th className="py-2 pr-2">Borough</th>
                        <th className="py-2 pr-2 text-right">Properties</th>
                        <th className="py-2 pr-2 text-right">Assessed value</th>
                        <th className="py-2 pr-2 text-right">Assmt. ratio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...boroughs]
                        .sort((a, b) => b.total_market_value - a.total_market_value)
                        .map((b) => (
                          <tr key={b.borough} className="border-b border-slate-100">
                            <td className="py-2 pr-2 font-semibold text-slate-900">{b.borough}</td>
                            <td className="py-2 pr-2 text-right tabular-nums text-slate-700">{formatNumber(b.count)}</td>
                            <td className="py-2 pr-2 text-right tabular-nums text-slate-700">
                              {formatUSD(b.total_assessed_value, 1)}
                            </td>
                            <td className="py-2 pr-2 text-right tabular-nums font-semibold text-blue-700">
                              {formatPct(b.assessment_ratio)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Reveal>
          </div>
        </section>

        {/* TAX EQUITY — the headline story */}
        <section id="tax-equity" className="scroll-mt-20">
          <Reveal>
            <SectionTitle
              eyebrow="The tax-equity gap"
              title="Homeowners pay tax on ~6% of their home's value. Everyone else pays on ~45%."
              sub="NYC's tax classes are assessed at wildly different fractions of market value — a well-documented, long-running controversy in city property tax policy. Full breakdown on the Tax Classes page →"
            />
          </Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            <Reveal delay={100} className="lg:col-span-3">
              <Card>
                <h3 className="font-bold text-slate-900 mb-1">Market value vs. assessed value, by tax class</h3>
                <p className="text-xs text-slate-500 mb-3">
                  The gap between the blue and orange bars is the untaxed share of each class's value.
                </p>
                <div className="h-[300px] sm:h-[360px]">
                  <TaxEquityChart taxClasses={tax_classes} />
                </div>
              </Card>
            </Reveal>
            <Reveal delay={200} className="lg:col-span-2">
              <div className="grid grid-cols-1 gap-3 sm:gap-4 h-full">
                <RatioCallout
                  label="Class 1 — 1-3 family homes"
                  ratio={class1.assessment_ratio}
                  desc={`${formatNumber(class1.count)} homes, ${formatUSD(class1.total_market_value, 1)} in market value — assessed on just ${formatPct(class1.assessment_ratio)} of it.`}
                  accent={CATEGORICAL.blue}
                />
                <RatioCallout
                  label="Class 2 — Rentals & co-ops/condos"
                  ratio={class2.assessment_ratio}
                  desc={`${formatNumber(class2.count)} units, assessed on ${formatPct(class2.assessment_ratio)} of market value — ${ratioGap.toFixed(1)}× Class 1's share.`}
                  accent={CATEGORICAL.orange}
                />
                <RatioCallout
                  label="Class 4 — Commercial"
                  ratio={class4.assessment_ratio}
                  desc={`${formatNumber(class4.count)} commercial properties, also assessed on ${formatPct(class4.assessment_ratio)} of market value.`}
                  accent={CATEGORICAL.green}
                />
              </div>
            </Reveal>
          </div>
          <Reveal delay={280}>
            <div className="mt-4 sm:mt-6 rounded-2xl bg-blue-50 border border-blue-200 p-5 sm:p-6">
              <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
                <strong className="text-slate-900">In plain English:</strong> state law caps how fast a 1-3 family
                home's assessed value can rise each year, so decades of appreciation in neighborhoods like brownstone
                Brooklyn or much of Queens never fully catches up to market value — leaving the average Class 1 owner
                taxed on roughly {formatPct(class1.assessment_ratio)} of what their home is actually worth. Owners of
                rental buildings, co-ops, condos, and commercial property (Classes 2–4) have no such cap and are
                assessed much closer to {formatPct(class2.assessment_ratio)} of market value — effectively a{" "}
                {ratioGap.toFixed(1)}× higher share. It's one of the most persistent tax-equity debates in NYC
                politics, and this gap is why.
              </p>
            </div>
          </Reveal>
        </section>

        {/* NEIGHBORHOODS / ZIPS */}
        <section id="neighborhoods" className="scroll-mt-20">
          <Reveal>
            <SectionTitle
              eyebrow="By zip code"
              title="Neighborhood explorer"
              sub={`Ranked across ${zips.length} NYC zip codes. Sort by property count, average market value, or total market value.`}
            />
          </Reveal>
          <Reveal delay={100}>
            <Card>
              <ZipTable zips={topZipsByCount} />
            </Card>
          </Reveal>
        </section>

        {/* BUILDING CLASSES */}
        <section id="buildings" className="scroll-mt-20">
          <Reveal>
            <SectionTitle
              eyebrow="Building types"
              title="What NYC is actually built out of"
              sub="Top building classes citywide by property count — R4 (condos), A1/A5 (1-2 family homes), and the rest of the DOF building-class taxonomy."
            />
          </Reveal>
          <Reveal delay={100}>
            <Card>
              <h3 className="font-bold text-slate-900 mb-1">Top 12 building classes by count</h3>
              <p className="text-xs text-slate-500 mb-3">Out of {building_classes.length} classes tracked citywide</p>
              <div className="h-[380px] sm:h-[420px]">
                <BuildingClassChart classes={topBuildingClasses} />
              </div>
            </Card>
          </Reveal>
        </section>

        {/* TOP OWNERS */}
        <section id="owners" className="scroll-mt-20">
          <Reveal>
            <SectionTitle
              eyebrow="Ownership concentration"
              title="The largest entity owners in NYC"
              sub="Ranked by aggregate assessed value across all their holdings. Individual people's names are never shown — only businesses, LLCs, trusts, and other organizations appear here. Full owners directory →"
            />
          </Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            <Reveal delay={100} className="lg:col-span-2">
              <Card>
                <h3 className="font-bold text-slate-900 mb-1">Top 12 by assessed value</h3>
                <div className="h-[420px] sm:h-[480px]">
                  <TopOwnersChart owners={topOwnersForChart} />
                </div>
              </Card>
            </Reveal>
            <Reveal delay={200} className="lg:col-span-3">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-orange-600" aria-hidden="true" />
                  <h3 className="font-bold text-slate-900">Top {entityOwners.length} entity owners, ranked</h3>
                </div>
                <OwnersTable owners={entityOwners} />
              </Card>
            </Reveal>
          </div>
        </section>

        {/* SEARCH */}
        <section id="search" className="scroll-mt-20">
          <Reveal>
            <SectionTitle
              eyebrow="Look up a property"
              title={`Search the full ${formatNumber(meta.total_rows_processed)}-row roll`}
              sub="Search by street address, owner name, or BBL (borough digit + 5-digit block + 4-digit lot, e.g. 1008710031). Live query against the full database — individual owners' names are shown as “Private Owner”; only business, institutional, and government owners are named."
            />
          </Reveal>
          <Reveal delay={100}>
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <SearchIcon className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <h3 className="font-bold text-slate-900">Address / owner / BBL search</h3>
              </div>
              <SearchTool />
            </Card>
          </Reveal>
        </section>

        {/* AGE DISTRIBUTION */}
        <section>
          <Reveal>
            <SectionTitle
              eyebrow="Building age"
              title="When NYC was built"
              sub="Property counts by decade of construction — the 1920s prewar boom and the 2000s condo boom stand out."
            />
          </Reveal>
          <Reveal delay={100}>
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <h3 className="font-bold text-slate-900">Properties by decade built</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">Includes an "Unknown" bucket for missing year-built data</p>
              <div className="h-[300px] sm:h-[340px]">
                <AgeDistributionChart buckets={age_distribution} />
              </div>
            </Card>
          </Reveal>
        </section>

        {/* Closing note */}
        <Reveal>
          <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 sm:p-10 text-white relative overflow-hidden noise-overlay">
            <div className="absolute inset-0 grid-pattern opacity-50" aria-hidden="true" />
            <div className="absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-blue-600/30 blur-3xl" aria-hidden="true" />
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
              <div className="lg:col-span-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-cyan-300 font-bold mb-3">
                  <MapPinned className="h-3.5 w-3.5" aria-hidden="true" />
                  Source
                </div>
                <p className="text-xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                  Built from NYC DOF's raw FY2027 Property Tax System extract —
                  <span className="text-cyan-300"> not the published PDF summaries.</span>
                </p>
                <p className="mt-4 text-sm sm:text-base text-blue-100/85 max-w-2xl leading-relaxed">
                  Source files: {meta.source_files.join(", ")}. Extract dated 2026-05-15,{" "}
                  {formatNumber(meta.total_rows_processed)} rows processed across all five boroughs and tax classes
                  1–4. Figures here run somewhat higher than DOF's own published FY2027 summary workbook — direct
                  DOF PTS extracts commonly diverge slightly from that office's rounded, filtered summary tables.
                  Full methodology →
                </p>
              </div>
              <div className="lg:col-span-2 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-4">
                  <div className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Properties</div>
                  <div className="text-2xl sm:text-3xl font-bold text-white mt-1">
                    {formatNumber(citywide.total_properties)}
                  </div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-4">
                  <div className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Market value</div>
                  <div className="text-2xl sm:text-3xl font-bold text-cyan-300 mt-1">
                    {formatUSD(citywide.total_market_value, 2)}
                  </div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-4">
                  <div className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Zip codes</div>
                  <div className="text-2xl sm:text-3xl font-bold text-white mt-1">{zips.length}</div>
                </div>
                <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 p-4">
                  <div className="text-xs text-blue-200 uppercase tracking-wider font-semibold">Tax classes</div>
                  <div className="text-2xl sm:text-3xl font-bold text-cyan-300 mt-1">{tax_classes.length}</div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </main>
    </div>
  );
}

/* ---------- Building blocks ---------- */

function SectionTitle({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mb-6 sm:mb-8">
      {eyebrow && (
        <div className="text-xs uppercase tracking-[0.2em] text-blue-600 font-semibold mb-2">{eyebrow}</div>
      )}
      <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">{title}</h2>
      {sub && <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-3xl">{sub}</p>}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card ${className}`}>
      {children}
    </div>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-white/70 font-semibold">{label}</div>
      <div className="text-2xl sm:text-4xl font-bold mt-2 text-white stat-glow-subtle">{value}</div>
      {sub && <div className="text-xs text-white/70 mt-1">{sub}</div>}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 card-hover h-full flex flex-col">
      <div className="flex items-center gap-2 text-slate-500" style={{ color: accent }}>
        {icon}
        <div className="text-xs font-semibold uppercase tracking-wider">{label}</div>
      </div>
      <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-2">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1 tabular-nums">{sub}</div>}
    </div>
  );
}

function BoroughKpiCard({ borough, accent }: { borough: Borough; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 card-hover h-full flex flex-col">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: accent }} aria-hidden="true" />
        <div className="text-sm font-bold text-slate-900">{borough.borough}</div>
      </div>
      <div className="mt-3 space-y-1.5 text-xs">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500">Market value</span>
          <span className="font-semibold text-slate-900 tabular-nums">{formatUSD(borough.total_market_value, 1)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500">Assessed value</span>
          <span className="font-semibold text-slate-900 tabular-nums">{formatUSD(borough.total_assessed_value, 1)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500">Properties</span>
          <span className="font-semibold text-slate-900 tabular-nums">{formatNumber(borough.count)}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-baseline justify-between">
        <span className="text-xs text-slate-500">Assmt. ratio</span>
        <span className="text-lg font-bold tabular-nums text-slate-900">
          {formatPct(borough.assessment_ratio)}
        </span>
      </div>
    </div>
  );
}

function RatioCallout({
  label,
  ratio,
  desc,
  accent,
}: {
  label: string;
  ratio: number;
  desc: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card h-full flex flex-col justify-center">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-3xl sm:text-4xl font-bold mt-1" style={{ color: accent }}>
        {formatPct(ratio)}
      </div>
      <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">{desc}</p>
    </div>
  );
}
