import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Landmark, Info } from "lucide-react";

import exemptionsRaw from "@/data/analytics/exemptions.json";
import ownersIndexRaw from "@/data/owners/index.json";
import type { OwnersIndex } from "@/lib/types";
import { formatNumber, formatPct, formatUSD, formatUSDFull } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ChartCard } from "@/components/ui/ChartCard";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";
import {
  ExemptVsTaxableByBoroughChart,
  ExemptShareByClassChart,
  ExemptShareByOwnerTypeChart,
} from "@/components/analytics-a/ExemptionsCharts";
import { TopExemptOwnersTable, type ExemptOwnerRow } from "@/components/analytics-a/TopExemptOwnersTable";

type ExemptionsData = {
  meta: { exclusions: string };
  by_borough: { borough: string; exempt_value: number; taxable_value: number; market_value: number; share_of_value_exempt: number }[];
  by_tax_class: { tax_class: string; share_of_value_exempt: number }[];
  by_owner_entity_type: { owner_entity_type: string; share_of_value_exempt: number; exempt_value: number }[];
  government_nonprofit_vs_private: {
    government_and_nonprofit: { lots: number; exempt_value: number; taxable_value: number; market_value: number; share_of_value_exempt: number };
    private_aggregate: { lots: number; exempt_value: number; taxable_value: number; market_value: number; share_of_value_exempt: number };
  };
  top_20_exempt_entity_owner_groups: ExemptOwnerRow[];
};

const data = exemptionsRaw as unknown as ExemptionsData;
const ownersIndex = ownersIndexRaw as unknown as OwnersIndex;
const slugByName: Record<string, string> = Object.fromEntries(ownersIndex.owners.map((o) => [o.name, o.slug]));

const CITYWIDE_EXEMPT = 176_885_449_301;
const CITYWIDE_ASSESSED = 536_131_027_415;

export const metadata: Metadata = {
  title: "Property Tax Exemptions — Who Doesn't Pay | NYC Property Assessment Explorer",
  description:
    "$176.9B of NYC's $536.1B in assessed property value is fully tax-exempt — government, nonprofit, and abated property. Exempt vs. taxable value by borough, tax class, and owner type, plus the top 20 exempt entity owners led by NYC Parks at $16.9B.",
};

export default function ExemptionsPage() {
  const top = data.top_20_exempt_entity_owner_groups[0];
  const govNonprofit = data.government_nonprofit_vs_private.government_and_nonprofit;
  const privateAgg = data.government_nonprofit_vs_private.private_aggregate;

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <Landmark className="h-9 w-9 text-blue-600" aria-hidden="true" />
          Who Doesn&apos;t Pay
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          Of NYC&apos;s {formatUSD(CITYWIDE_ASSESSED, 1)} in citywide{" "}
          <DefinitionTooltip term="assessed value">
            The portion of market value actually subject to the tax rate before any exemptions are applied.
          </DefinitionTooltip>
          , {formatUSD(CITYWIDE_EXEMPT, 1)} — {formatPct(CITYWIDE_EXEMPT / CITYWIDE_ASSESSED, 1)} — is fully{" "}
          <DefinitionTooltip term="exempt value">
            The portion of assessed value excused from taxation entirely. Government, religious, and nonprofit
            property is commonly fully exempt; some private property carries partial abatements (e.g. 421-a, J-51,
            co-op/condo abatement).
          </DefinitionTooltip>
          .
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Citywide exempt value"
            value={formatUSD(CITYWIDE_EXEMPT, 1)}
            sub={`${formatPct(CITYWIDE_EXEMPT / CITYWIDE_ASSESSED, 1)} of assessed value`}
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="Gov't + nonprofit exempt share"
            value={formatPct(govNonprofit.share_of_value_exempt, 1)}
            sub={`${formatNumber(govNonprofit.lots)} lots`}
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            label="Private-aggregate exempt share"
            value={formatPct(privateAgg.share_of_value_exempt, 1)}
            sub="Includes co-op/condo & 421-a/J-51 abatements"
            accent={CATEGORICAL_ORDER[2]}
          />
          <MetricCard
            label="#1 exempt-value owner"
            value={top ? formatUSD(top.total_exempt_value, 1) : "—"}
            sub={
              top ? (
                slugByName[top.name] ? (
                  <Link href={`/owners/${slugByName[top.name]}`} className="text-blue-700 font-semibold hover:underline">
                    {top.name}
                  </Link>
                ) : (
                  top.name
                )
              ) : undefined
            }
            accent={CATEGORICAL_ORDER[3]}
          />
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Exempt vs. taxable value by borough" height={340}>
            <ExemptVsTaxableByBoroughChart rows={data.by_borough} />
          </ChartCard>
          <ChartCard title="Share of value exempt, by tax class" sub="Class 1/2/3/4 headline classes" height={340}>
            <ExemptShareByClassChart rows={data.by_tax_class} />
          </ChartCard>
        </div>

        <div className="mt-10">
          <ChartCard
            title="Share of value exempt, by owner entity type"
            sub="Government and nonprofit entity types run near-total exemption; private entity types carry partial abatements only"
            height={340}
          >
            <ExemptShareByOwnerTypeChart rows={data.by_owner_entity_type} />
          </ChartCard>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-5">
            <h3 className="font-bold text-slate-900 mb-1">Government &amp; nonprofit</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {formatNumber(govNonprofit.lots)} lots hold {formatUSD(govNonprofit.market_value, 1)} in market value —{" "}
              <strong>{formatPct(govNonprofit.share_of_value_exempt, 1)}</strong> of it is exempt. This bucket includes
              parks, schools, hospitals, universities, and religious institutions.
            </p>
          </div>
          <div className="rounded-2xl bg-orange-50 border border-orange-200 p-5">
            <h3 className="font-bold text-slate-900 mb-1">Private aggregate</h3>
            <p className="text-sm text-slate-700 leading-relaxed">
              {formatNumber(privateAgg.lots)} lots hold {formatUSD(privateAgg.market_value, 1)} in market value — only{" "}
              <strong>{formatPct(privateAgg.share_of_value_exempt, 1)}</strong> is exempt, almost entirely from
              co-op/condo abatements and construction incentives like 421-a and J-51.
            </p>
          </div>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Top 20 exempt entity owners</h2>
          <p className="text-sm text-slate-500 mb-4">
            Ranked by total exempt value. <strong className="text-slate-700">Entity owners only</strong> — no
            individual is ever named or ranked on this site (see privacy rule in{" "}
            <span className="font-mono text-xs bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
              data/analytics/README.md
            </span>
            ).
          </p>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
            <TopExemptOwnersTable rows={data.top_20_exempt_entity_owner_groups} slugByName={slugByName} />
          </div>
        </section>

        <div className="mt-10 rounded-2xl bg-slate-50 border border-slate-200 p-5 flex items-start gap-2.5 text-sm text-slate-600 leading-relaxed">
          <Info className="h-5 w-5 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
          <p>{data.meta.exclusions}</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/analytics/tax-burden" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
            See how the classes that DO pay are assessed <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link href="/owners" className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline">
            Browse all entity owners <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
