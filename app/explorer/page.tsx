import type { Metadata } from "next";
import { Suspense } from "react";

import raw from "@/data/aggregates.json";
import type { Aggregates } from "@/lib/types";
import { formatNumber } from "@/lib/format";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { LoadingState } from "@/components/ui/LoadingState";
import { ExplorerClient } from "@/components/explorer/ExplorerClient";

const data = raw as unknown as Aggregates;

export const metadata: Metadata = {
  title: "Property Explorer | NYC Property Assessment Explorer",
  description:
    "Search and filter every NYC tax lot in the FY2027 DOF assessment roll by value, borough, tax class, building type, and owner.",
};

/**
 * Full per-lot Property Explorer — filterable, sortable, paginated grid backed by
 * /api/properties (SQLite/Turso). URL query-param contract (every filter change updates the
 * URL; back/forward and shared links work):
 *   value_min / value_max      — market value in whole dollars
 *   borough                    — full borough name, e.g. "Manhattan"
 *   entity                     — all | llc | corp | trust | government | nonprofit
 *   tax_class                   — "1" | "1A" | ... | "2" | "3" | "4"
 *   bldg_class                  — DOF building class code, e.g. "R4", or a letter prefix "R"
 *   zip                         — 5-digit zip
 *   year_built_min / _max       — construction year bounds
 *   units_min / units_max       — total unit bounds
 *   property_type                — one of the derived rollup categories (see lib/explorer/constants.ts)
 *   value_band                   — one of the precomputed value bands
 *   q                            — free-text address/owner/BBL search
 *   sort                         — value_desc | value_asc | count_desc | count_asc | year_desc |
 *                                   year_asc | units_desc | units_asc | address_asc
 *   page                         — 1-indexed results page
 */
export default function ExplorerPage() {
  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">Property Explorer</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl">
          Search and filter all {formatNumber(data.citywide.total_properties)} tax lots in the FY2027 roll by
          value, borough, tax class, building type, owner type, and more.
        </p>

        <div className="mt-8">
          <Suspense fallback={<LoadingState label="Loading Property Explorer…" />}>
            <ExplorerClient boroughs={data.boroughs.map((b) => ({ borough: b.borough }))} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
