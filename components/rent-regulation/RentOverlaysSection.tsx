import { Info } from "lucide-react";
import rentOverlaysRaw from "@/data/analytics/rent_overlays.json";
import { formatPct } from "@/lib/format";
import { ChartCard } from "@/components/ui/ChartCard";
import {
  StabilizedShareByBoroughChart,
  AbatementsByDecadeChart,
  StabilizedStockByOwnerTypeChart,
} from "@/components/rent-regulation/RentOverlayCharts";
import { StabilizedByZipTable } from "@/components/rent-regulation/StabilizedByZipTable";

type RentOverlaysData = {
  meta: { exclusions: string };
  stabilized_share_of_structural_candidates: {
    by_borough: { borough: string; structural_candidates: number; hcr_registered: number; stabilized_share: number }[];
    by_zip: { zip: string; structural_candidates: number; hcr_registered: number; stabilized_share: number }[];
  };
  abatements_by_decade: { decade: string; hcr_buildings: number; count_421a: number; count_j51: number }[];
  stabilized_stock_by_owner_entity_type: { owner_entity_type: string; hcr_registered_buildings: number }[];
};

const data = rentOverlaysRaw as unknown as RentOverlaysData;

/**
 * Rent-overlay analytics section for /rent-regulation. Stabilized share of pre-1974, 6+ unit
 * "structural candidate" stock by borough and zip, 421-a vs. J-51 abatements by construction
 * decade, and stabilized stock by owner entity type (a classification, never a name — see
 * data/analytics/README.md privacy rule). Same building-level, not unit-level, caveat as the
 * rest of this page.
 */
export function RentOverlaysSection() {
  const queens = data.stabilized_share_of_structural_candidates.by_borough.find((b) => b.borough === "Queens");
  const staten = data.stabilized_share_of_structural_candidates.by_borough.find((b) => b.borough === "Staten Island");

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-slate-900 mb-1">Stabilization share of the pre-1974 multifamily stock</h2>
      <p className="text-sm text-slate-500 mb-4">
        Among buildings that structurally could plausibly fall under rent stabilization — non-easement, built before
        1974, 6+ residential units, walk-up/elevator/small-multifamily class —{" "}
        {queens ? (
          <>
            <strong className="text-slate-700">Queens</strong> has the highest confirmed stabilized share (
            <strong className="text-blue-700">{formatPct(queens.stabilized_share, 1)}</strong>)
          </>
        ) : (
          "stabilization rates vary sharply by borough"
        )}
        {staten ? (
          <>
            {" "}
            versus <strong className="text-slate-700">Staten Island</strong>&apos;s{" "}
            <strong className="text-blue-700">{formatPct(staten.stabilized_share, 1)}</strong> (a small denominator —
            few pre-1974, 6+ unit buildings exist there at all).
          </>
        ) : null}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Stabilized share by borough" height={300}>
          <StabilizedShareByBoroughChart rows={data.stabilized_share_of_structural_candidates.by_borough} />
        </ChartCard>
        <ChartCard
          title="421-a vs. J-51 abatements by construction decade"
          sub="421-a concentrates in 2000s–2020s new construction; J-51 skews 1900s–1930s prewar renovation"
          height={300}
        >
          <AbatementsByDecadeChart rows={data.abatements_by_decade} />
        </ChartCard>
      </div>

      <div className="mt-6">
        <ChartCard
          title="Stabilized stock by owner entity type"
          sub="Entity-type classification only — individual owners are never named, only counted"
          height={300}
        >
          <StabilizedStockByOwnerTypeChart rows={data.stabilized_stock_by_owner_entity_type} />
        </ChartCard>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
        <StabilizedByZipTable rows={data.stabilized_share_of_structural_candidates.by_zip} />
      </div>

      <div className="mt-6 rounded-2xl bg-orange-50 border border-orange-200 p-4 flex items-start gap-2 text-sm text-slate-700">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-orange-600" aria-hidden="true" />
        <p>
          <strong className="text-slate-900">Building-level, not unit-level — and a structural proxy, not a legal determination.</strong>{" "}
          {data.meta.exclusions}
        </p>
      </div>
    </section>
  );
}
