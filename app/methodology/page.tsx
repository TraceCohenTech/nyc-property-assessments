import type { Metadata } from "next";
import { Database, ShieldCheck, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

import raw from "@/data/aggregates.json";
import type { Aggregates } from "@/lib/types";
import { formatNumber, formatUSD } from "@/lib/format";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";
import { MetricCard } from "@/components/ui/MetricCard";
import { CATEGORICAL_ORDER } from "@/lib/colors";

const data = raw as unknown as Aggregates;

export const metadata: Metadata = {
  title: "Methodology | NYC Property Assessment Explorer",
  description:
    "How this site derives its numbers from the NYC DOF FY2027 Final Assessment Roll: data source, what a tax lot is, the owner-privacy policy, known limitations, and data-source status.",
};

const SOURCE_STATUS: { name: string; status: "available" | "planned" | "unavailable"; note: string }[] = [
  { name: "DOF FY2027 Final Assessment Roll (PTS extract)", status: "available", note: "Primary source for every figure on this site." },
  { name: "HCR rent-regulation registration files", status: "planned", note: "Needed for a real Rent Regulation section — not yet integrated; that page currently shows a rough age-based proxy only." },
  { name: "MapPLUTO (parcel coordinates)", status: "planned", note: "Needed to power the interactive Map page — not yet joined to the roll." },
  { name: "Historical assessment rolls (prior fiscal years)", status: "planned", note: "Would enable year-over-year trend views; only FY2027 is loaded today." },
  { name: "ACRIS (deed / sale transaction records)", status: "unavailable", note: "Would show actual sale prices vs. DOF market value; not currently in scope." },
  { name: "HPD (violations, code enforcement)", status: "unavailable", note: "Would add building-condition context; not currently in scope." },
  { name: "RPIE (income & expense filings)", status: "unavailable", note: "DOF's underlying income data for commercial valuations; not public at the lot level and not in scope." },
];

const STATUS_STYLE = {
  available: { icon: CheckCircle2, label: "Available", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  planned: { icon: Clock, label: "Planned", cls: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  unavailable: { icon: XCircle, label: "Unavailable / manual", cls: "text-slate-500 bg-slate-100 border-slate-200" },
} as const;

export default function MethodologyPage() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Methodology</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          How the numbers on this site are derived, what's verified vs. estimated, and what's still missing.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard icon={<Database className="h-4 w-4 text-blue-600" aria-hidden="true" />} label="Rows processed" value={formatNumber(data.meta.total_rows_processed)} accent={CATEGORICAL_ORDER[0]} />
          <MetricCard label="Bad rows skipped" value={formatNumber(data.meta.bad_rows_skipped)} accent={CATEGORICAL_ORDER[1]} />
          <MetricCard label="Total market value" value={formatUSD(data.citywide.total_market_value, 2)} accent={CATEGORICAL_ORDER[2]} />
        </div>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Data source</h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            All figures on this site are computed directly from the New York City Department of Finance's{" "}
            <strong className="text-slate-900">FY2027 Final Assessment Roll</strong>, specifically the raw
            Property Tax System (PTS) extract — not DOF's own published, rounded PDF summary tables. Source
            files: {data.meta.source_files.join(", ")}. Because this site computes aggregates directly from the
            raw extract, figures here can run slightly higher or lower than DOF's own published FY2027 summary
            workbook; that's an expected, minor divergence between two independent tabulations of the same
            underlying records, not a data-quality problem.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">What is a tax lot?</h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            A <DefinitionTooltip term="tax lot">A single, uniquely identified unit of real property for tax purposes — identified by its BBL (Borough-Block-Lot).</DefinitionTooltip>{" "}
            is DOF's basic unit of property assessment, identified by a unique{" "}
            <strong className="text-slate-900">BBL</strong> (borough digit + 5-digit tax block + 4-digit tax
            lot, e.g. <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">1008710031</code>). Most tax
            lots correspond to a single building or parcel, but a large condo building is typically split into
            many tax lots — one per unit, each with its own BBL. This means unit-level condo data (like a
            10-unit condo building) appears as 10 separate rows in the underlying data, each with its own
            market and assessed value.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">How values are derived</h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
            DOF estimates <strong className="text-slate-900">market value</strong> for each tax lot using sales
            comparables, income capitalization (for rental/commercial property), or replacement cost, depending
            on property type. <strong className="text-slate-900">Assessed value</strong> is then derived from
            market value using each tax class's statutory assessment ratio and, for Class 1, an annual
            increase cap. See the{" "}
            <a href="/tax-classes" className="text-blue-700 font-semibold hover:underline">
              Tax Classes page
            </a>{" "}
            for the full breakdown of market vs. assessed vs. taxable vs. exempt value.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" aria-hidden="true" />
            Owner-privacy policy
          </h2>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
              <strong className="text-slate-900">Individual people's names are never displayed anywhere on this
              site</strong> — not on the homepage, not in the Owners directory, not in search results, not in
              any API response. Only business, institutional, and government entities (LLCs, corporations,
              trusts, nonprofits, religious institutions, universities, hospitals, and government agencies) are
              shown by name. Everything else renders as "Private Owner."
            </p>
            <p className="mt-3 text-sm sm:text-base text-slate-700 leading-relaxed">
              This is enforced by a shared classification function (matching a curated list of entity
              suffixes/keywords like LLC, Corp, Trust, and government-agency phrases) that both the search API
              and every static page apply before any owner string is rendered — never as an after-the-fact UI
              filter on data that already left the server unredacted.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" aria-hidden="true" />
            Known limitations
          </h2>
          <ul className="space-y-2 text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed list-disc pl-5">
            <li>Figures reflect a single point-in-time extract (dated 2026-05-15) — not real-time, and not yet compared against prior fiscal years.</li>
            <li>Owner name strings are capped at 60 characters in the source system; unusually long trust/estate names may appear truncated.</li>
            <li>A small number of duplicate BBL records exist in the underlying data; aggregate totals are computed directly from the raw extract without additional deduplication logic beyond what DOF's own extract already applies.</li>
            <li>Search (address / owner / BBL) uses simple text matching rather than a full geocoded or fuzzy-matched index — unusual abbreviations or misspellings in an address may not match.</li>
            <li>Insights on this site's homepage (value concentration, ownership-by-entity-type, and housing-unit breakdowns) are computed by a separate analysis pass; while that pass is still being finalized, some of those specific figures are shown as clearly labeled preliminary estimates.</li>
          </ul>
        </section>

        <section className="mt-10 mb-4">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Data sources — status</h2>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {SOURCE_STATUS.map((s) => {
                  const style = STATUS_STYLE[s.status];
                  const Icon = style.icon;
                  return (
                    <tr key={s.name} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-3 font-semibold text-slate-900">{s.name}</td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${style.cls}`}>
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {style.label}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{s.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
