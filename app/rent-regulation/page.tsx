import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Info } from "lucide-react";

import insightsRaw from "@/data/insights.json";
import type { InsightsData } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { MetricCard } from "@/components/ui/MetricCard";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { EmptyState } from "@/components/ui/EmptyState";

const insights = insightsRaw as unknown as InsightsData;

export const metadata: Metadata = {
  title: "Rent Regulation (Beta) | NYC Property Assessment Explorer",
  description:
    "A preview of rent-regulated housing coverage for the NYC Property Assessment Explorer — pending HCR rent-regulation file integration.",
};

export default function RentRegulationPage() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <SourceBadge />
          <ConfidenceBadge level="planned" label="Beta — coming soon" />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
          <ShieldCheck className="h-9 w-9 text-blue-600" aria-hidden="true" />
          Rent Regulation
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          This section will identify likely rent-stabilized buildings by joining the DOF assessment roll with
          NYS Homes and Community Renewal (HCR) rent-regulation registration data — not yet integrated.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            label="Pre-1974 multifamily lots"
            value={formatNumber(insights.housing.pre_1974_multifamily.lots)}
            sub="A common proxy for rent-stabilization eligibility, pending real HCR data"
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="Units in those buildings"
            value={formatNumber(insights.housing.pre_1974_multifamily.units)}
            accent={CATEGORICAL_ORDER[1]}
          />
        </div>

        <div className="mt-6 rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-2 text-sm text-slate-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
          The figures above are a rough proxy (pre-1974 multifamily building age) — not actual HCR registration
          data. Treat them as directional, not authoritative, until the real rent-regulation dataset lands. See{" "}
          <Link href="/methodology" className="font-semibold text-blue-700 hover:underline">
            Methodology
          </Link>{" "}
          for the full data-sources status table.
        </div>

        <div className="mt-8">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" aria-hidden="true" />}
              title="Rent-regulation lookup — coming soon"
              description="Once HCR data is integrated, you'll be able to check whether a specific building appears on the rent-stabilization registration list."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
