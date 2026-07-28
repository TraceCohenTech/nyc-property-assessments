import type { Metadata } from "next";
import Link from "next/link";
import { Search, Info } from "lucide-react";

import raw from "@/data/aggregates.json";
import type { Aggregates } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { FilterPanel, type FilterField } from "@/components/ui/FilterPanel";
import { SearchTool } from "@/components/SearchTool";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { EmptyState } from "@/components/ui/EmptyState";

const data = raw as unknown as Aggregates;

export const metadata: Metadata = {
  title: "Property Explorer | NYC Property Assessment Explorer",
  description:
    "Search and filter every NYC tax lot in the FY2027 DOF assessment roll by value, borough, tax class, building type, and owner.",
};

/**
 * Shell for the full per-lot Property Explorer (filterable, paginated results grid).
 * A later wave wires FilterPanel + a results table to a real query API and to the URL
 * query-param contract documented in the UI-layer report:
 *   value_min / value_max   — market value in whole dollars
 *   borough                 — full borough name, e.g. "Manhattan"
 *   entity                  — all | llc | corp | trust | government | nonprofit
 *   tax_class                — "1" | "2" | "3" | "4"
 *   bldg_class               — DOF building class code, e.g. "R4"
 *   zip                      — 5-digit zip
 *   year_built_min / _max    — construction year bounds
 *   q                        — free-text address/owner search
 *   sort                     — value_desc | value_asc | count_desc | count_asc
 *   page                     — 1-indexed results page
 * Today, the working search surface is the address/owner/BBL lookup below (same as the
 * homepage's live Neon-backed /api/search).
 */
export default function ExplorerPage() {
  const fields: FilterField[] = [
    { key: "value_min", label: "Min market value", type: "number", placeholder: "$0" },
    { key: "value_max", label: "Max market value", type: "number", placeholder: "Any" },
    {
      key: "borough",
      label: "Borough",
      type: "select",
      options: data.boroughs.map((b) => ({ value: b.borough, label: b.borough })),
    },
    {
      key: "tax_class",
      label: "Tax class",
      type: "select",
      options: data.tax_classes.map((t) => ({ value: t.tax_class, label: `Class ${t.tax_class}` })),
    },
    { key: "entity", label: "Owner type", type: "select", options: [{ value: "llc", label: "LLC" }, { value: "government", label: "Government" }] },
    { key: "zip", label: "Zip code", type: "text", placeholder: "e.g. 10001" },
  ];

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Property Explorer</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          Search and filter all {formatNumber(data.citywide.total_properties)} tax lots in the FY2027 roll. The
          full filterable grid (value range, borough, tax class, building type, owner type) is landing in a
          later build — the filters below preview what's coming.
        </p>

        <div className="mt-8">
          <FilterPanel fields={fields} />
        </div>

        <div className="mt-6 rounded-2xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-2 text-sm text-slate-700">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
          Filtering isn't wired up yet — for now, use live address / owner / BBL search below, which queries the
          full database directly.
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <h2 className="font-bold text-slate-900">Address / owner / BBL search</h2>
          </div>
          <SearchTool />
        </div>

        <div className="mt-8">
          <EmptyState
            title="Full filtered browsing is coming soon"
            description="In the meantime, explore aggregate views by borough, tax class, or owner type."
            action={
              <div className="flex flex-wrap gap-2 justify-center">
                <Link href="/boroughs" className="text-sm font-semibold text-blue-700 hover:underline">
                  Boroughs
                </Link>
                <span className="text-slate-300">·</span>
                <Link href="/tax-classes" className="text-sm font-semibold text-blue-700 hover:underline">
                  Tax classes
                </Link>
                <span className="text-slate-300">·</span>
                <Link href="/owners" className="text-sm font-semibold text-blue-700 hover:underline">
                  Owners
                </Link>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
