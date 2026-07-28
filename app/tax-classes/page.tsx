import type { Metadata } from "next";
import { Info } from "lucide-react";

import raw from "@/data/aggregates.json";
import type { Aggregates } from "@/lib/types";
import { formatNumber, formatUSD, formatPct } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { TaxEquityChart } from "@/components/charts/Charts";
import { ChartCard } from "@/components/ui/ChartCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";

const data = raw as unknown as Aggregates;

export const metadata: Metadata = {
  title: "NYC Tax Classes Explained | NYC Property Assessment Explorer",
  description:
    "A plain-English guide to NYC's four property tax classes (1, 2, 2A/2B/2C, 3, 4), assessment ratios, and the difference between market, assessed, taxable, and exempt value.",
};

const CLASSES = [
  {
    id: "1",
    title: "Class 1 — 1, 2, and 3-family homes",
    body: "Most detached, semi-detached, and row houses with up to three units, plus most residential vacant land in outer boroughs. State law caps how much a Class 1 property's assessed value can rise year over year (6% per year, 20% over five years), regardless of how fast market value actually grows.",
  },
  {
    id: "2",
    title: "Class 2 — Rentals, co-ops, and condos",
    body: "Residential property with more than three units — this includes rental apartment buildings, and every co-op and condo unit, whether owner-occupied or not. Subdivided into 2A (4–6 units), 2B (7–10 units), and 2C (co-ops/condos of 2–10 units); larger buildings are simply Class 2. No annual assessment-increase cap applies, so Class 2 assessments track market value much more closely than Class 1.",
  },
  {
    id: "3",
    title: "Class 3 — Utility property",
    body: "Property owned by utility companies (equipment and special franchise property), plus some utility-company real estate. A small class by lot count but assessed differently from the other three under state law.",
  },
  {
    id: "4",
    title: "Class 4 — Commercial & industrial",
    body: "Offices, stores, factories, warehouses, hotels, and all other commercial or industrial property not in Classes 1–3. Like Class 2, there's no annual cap on assessed-value growth — Class 4 assessments move with market value.",
  },
];

const VALUE_TERMS = [
  {
    term: "Market value",
    def: "DOF's estimate of what a property would sell for on the open market — derived from sales, income, and cost data. This is what this site calls \"market value\" throughout. It is an assessment estimate, not an appraisal or guaranteed sale price.",
  },
  {
    term: "Assessed value",
    def: "The portion of market value actually subject to the assessment ratio and caps for a property's tax class. For Class 1, this is capped well below market value; for Classes 2–4, it moves much closer to market value.",
  },
  {
    term: "Taxable value",
    def: "Assessed value minus any exemptions (e.g. STAR, senior, veteran, or J-51/421-a abatement programs). This is the number the tax rate is actually applied to.",
  },
  {
    term: "Exempt value",
    def: "The portion of assessed value that's excused from taxation entirely — government, religious, and nonprofit property is commonly fully exempt.",
  },
];

export default function TaxClassesPage() {
  const byClass = Object.fromEntries(data.tax_classes.map((t) => [t.tax_class, t]));

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Tax Classes, Explained</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          NYC sorts every property into one of four tax classes, and each class is assessed on a different
          fraction of its <DefinitionTooltip term="market value">DOF's estimate of what a property would sell for on the open market — not a sale price or appraisal.</DefinitionTooltip>.
          That difference is one of the most persistent tax-equity debates in city politics.
        </p>

        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-2 text-sm text-slate-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
          <strong className="text-slate-900 mr-1">DOF market value ≠ sale price.</strong>
          It's a modeled estimate used for tax administration, not a listing price, appraisal, or a guarantee of
          what a property would actually sell for.
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {data.tax_classes.map((t, i) => (
            <MetricCard
              key={t.tax_class}
              label={`Class ${t.tax_class}`}
              value={formatPct(t.assessment_ratio)}
              sub={`${formatNumber(t.count)} lots · ${formatUSD(t.total_market_value, 1)} market value`}
              accent={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]}
            />
          ))}
        </div>

        <div className="mt-10">
          <ChartCard title="Market value vs. assessed value, by tax class" sub="The gap between the two bars is the untaxed share of each class's value." height={360}>
            <TaxEquityChart taxClasses={data.tax_classes} />
          </ChartCard>
        </div>

        <div className="mt-10 space-y-6">
          {CLASSES.map((c) => {
            const stats = byClass[c.id];
            return (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
                <h2 className="text-xl font-bold text-slate-900">{c.title}</h2>
                <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">{c.body}</p>
                {stats && (
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Lots: </span>
                      <span className="font-semibold text-slate-900 tabular-nums">{formatNumber(stats.count)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Market value: </span>
                      <span className="font-semibold text-slate-900 tabular-nums">{formatUSD(stats.total_market_value, 1)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Assessment ratio: </span>
                      <span className="font-semibold text-blue-700 tabular-nums">{formatPct(stats.assessment_ratio)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Tax class vs. building class vs. property type</h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed mb-6">
            These three terms describe different things and are easy to conflate:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <h3 className="font-bold text-slate-900 mb-1">Tax class</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                A legal category (1, 2, 3, or 4) that determines how a property is assessed and taxed under state
                law. Every property has exactly one tax class.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <h3 className="font-bold text-slate-900 mb-1">Building class</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                A more granular DOF code (e.g. "R4" for condos, "A1" for single-family detached homes) describing
                the physical building type. Many building classes can map to the same tax class.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <h3 className="font-bold text-slate-900 mb-1">Property type</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                A broader description (residential, commercial, mixed-use, vacant land, utility) often used in
                DOF's own published summary tables — related to, but not identical to, tax class or building class.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Market vs. assessed vs. taxable vs. exempt value</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {VALUE_TERMS.map((v) => (
              <div key={v.term} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <h3 className="font-bold text-slate-900 mb-1">{v.term}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{v.def}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
