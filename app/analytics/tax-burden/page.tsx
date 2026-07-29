import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Scale, Info } from "lucide-react";

import taxBurdenRaw from "@/data/analytics/tax_burden.json";
import { formatNumber, formatPct, formatUSD } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ChartCard } from "@/components/ui/ChartCard";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";
import {
  RatioByClassFamilyChart,
  RatioMatrixTable,
  TaxBurdenExampleCards,
  FAMILY_LABEL,
} from "@/components/analytics-a/TaxBurdenCharts";

type FamilyRow = {
  base_class_family: string;
  label: string;
  count: number;
  total_market_value: number;
  total_assessed_value: number;
  total_taxable_value: number;
  citywide_assessed_to_market_ratio: number;
  citywide_taxable_to_market_ratio: number;
};

type TaxBurdenData = {
  meta: { caption: string; exclusions: string };
  citywide_by_base_class_family: FamilyRow[];
  matrix_by_family_x_borough: {
    base_class_family: string;
    borough: string;
    citywide_assessed_to_market_ratio: number;
    count: number;
    total_market_value: number;
  }[];
};

const data = taxBurdenRaw as unknown as TaxBurdenData;

export const metadata: Metadata = {
  title: "Tax Burden by Class — The NYC Assessment Equity Gap | NYC Property Assessment Explorer",
  description:
    "Class 1 homes assess at roughly 6% of market value citywide, versus roughly 45% for Class 2, 3, and 4 property — a structural gap set by NY State's RPTL §1805 assessment caps, not the market. The full ratio matrix by tax class and borough.",
};

export default function TaxBurdenPage() {
  const class1 = data.citywide_by_base_class_family.find((f) => f.base_class_family === "1");
  const class2 = data.citywide_by_base_class_family.find((f) => f.base_class_family === "2");
  const class3 = data.citywide_by_base_class_family.find((f) => f.base_class_family === "3");
  const class4 = data.citywide_by_base_class_family.find((f) => f.base_class_family === "4");

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <Scale className="h-9 w-9 text-blue-600" aria-hidden="true" />
          Tax Burden by Class
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          NYC assesses the same dollar of{" "}
          <DefinitionTooltip term="market value">
            DOF&apos;s estimate of what a property would sell for on the open market — not a sale price or appraisal.
          </DefinitionTooltip>{" "}
          very differently depending on what kind of property it sits on. This is the single biggest structural
          equity story in the property tax system, and it&apos;s set entirely by state law.
        </p>

        <div className="mt-4 rounded-2xl bg-orange-50 border border-orange-200 p-4 sm:p-5 flex items-start gap-2.5 text-sm text-slate-700">
          <Info className="h-5 w-5 mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
          <p>{data.meta.caption}</p>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[class1, class2, class3, class4].map((f, i) =>
            f ? (
              <MetricCard
                key={f.base_class_family}
                label={`Class ${f.base_class_family}`}
                value={formatPct(f.citywide_assessed_to_market_ratio, 1)}
                sub={`${formatNumber(f.count)} lots · ${formatUSD(f.total_market_value, 1)} market value`}
                accent={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]}
              />
            ) : null
          )}
        </div>

        <div className="mt-10">
          <ChartCard
            title="Effective assessment ratio by tax class"
            sub="Assessed value as a share of market value — the fraction the tax rate is actually calculated against"
            height={360}
          >
            <RatioByClassFamilyChart rows={data.citywide_by_base_class_family} />
          </ChartCard>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Ratio matrix — tax class × borough</h2>
          <p className="text-sm text-slate-500 mb-4">
            The same class-level gap holds almost perfectly flat across every borough — this is a statutory rule
            (
            <DefinitionTooltip term="RPTL §1805">
              NY State&apos;s Real Property Tax Law caps how fast a Class 1 property&apos;s assessed value can rise year over
              year (6% per year, 20% over five years), regardless of market appreciation. No such cap exists for
              Class 2, 3, or 4.
            </DefinitionTooltip>
            ), not a borough-by-borough market effect.
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
            <RatioMatrixTable rows={data.matrix_by_family_x_borough} />
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Why the gap exists</h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed mb-6">
            It isn&apos;t that Class 1 homes are worth less relative to their assessments for market reasons — it&apos;s that
            state law puts a hard annual cap on how much a Class 1 property&apos;s assessed value is allowed to increase,
            even when its market value jumps. Classes 2 and 4 have no such cap, so their assessments track market
            value far more closely, year after year, compounding the gap over decades.
          </p>
          <TaxBurdenExampleCards class1Ratio={class1?.citywide_assessed_to_market_ratio ?? 0.06} class2Ratio={class2?.citywide_assessed_to_market_ratio ?? 0.45} />
          <p className="text-xs text-slate-500 mt-3 max-w-3xl leading-relaxed">
            In other words: a $1M single-family home and a $1M slice of a condo or rental building start from the
            same market value, but the home&apos;s owner is taxed on roughly {formatPct((class1?.citywide_assessed_to_market_ratio ?? 0.06) / (class2?.citywide_assessed_to_market_ratio ?? 0.45), 0)}{" "}
            as much assessed value as the condo/rental slice.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="font-bold text-slate-900 mb-1">{FAMILY_LABEL["1"]}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Assessed at a fraction of market value, capped by RPTL §1805 — the class that benefits most from the
              cap in dollar terms, since it&apos;s also the largest class by lot count ({formatNumber(class1?.count ?? 0)}{" "}
              lots).
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="font-bold text-slate-900 mb-1">{FAMILY_LABEL["2"]}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              No annual cap — assessments move with market value, so co-op, condo, and rental owners are assessed on
              a share of value roughly {formatPct((class2?.citywide_assessed_to_market_ratio ?? 0.45) / (class1?.citywide_assessed_to_market_ratio ?? 0.06), 0)}{" "}
              the size of a Class 1 owner&apos;s.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/tax-classes" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            Read the full tax-class breakdown <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/explorer?tax_class=1" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            Explore Class 1 properties <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/analytics/exemptions" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline py-2 min-h-[44px]">
            See who pays nothing at all <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
