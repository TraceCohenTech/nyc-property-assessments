import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plane } from "lucide-react";

import extremesRaw from "@/data/analytics/extremes.json";
import { formatNumber, formatUSD } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { InsightCard } from "@/components/ui/InsightCard";
import { ExtremesSection } from "@/components/analytics-b/ExtremesSection";
import {
  ValueLeaderboardTable,
  UnitsLeaderboardTable,
  AreaLeaderboardTable,
  PerUnitLeaderboardTable,
  OldestLeaderboardTable,
  VacantOwnerLeaderboardTable,
  VacantLotLeaderboardTable,
  type UnitsRow,
  type AreaRow,
  type ValueRow,
  type PerUnitRow,
  type OldestRow,
  type VacantLotRow,
  type OwnerHoldingRow,
} from "@/components/analytics-b/ExtremesTables";

const data = extremesRaw as unknown as {
  biggest_by_residential_units: UnitsRow[];
  biggest_by_building_area: AreaRow[];
  most_valuable_single_lots: ValueRow[];
  highest_value_per_residential_unit: PerUnitRow[];
  oldest_still_standing: OldestRow[];
  largest_vacant_land_holdings_by_owner_group: OwnerHoldingRow[];
  largest_single_vacant_lots: VacantLotRow[];
};

export const metadata: Metadata = {
  title: "NYC's Most Extreme Properties | NYC Property Assessment Explorer",
  description:
    "Leaderboards for NYC's biggest, most valuable, oldest, and most extreme tax lots — including JFK Airport, a single $18.88B parcel, and the entity owners holding the most vacant land in the city.",
};

export default function ExtremesPage() {
  const jfk = data.most_valuable_single_lots[0];
  const riverbay = data.biggest_by_residential_units[0];
  const parksVacant = data.largest_vacant_land_holdings_by_owner_group[0];

  return (
    <div className="pt-24 sm:pt-28 pb-24">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="mb-4">
          <SourceBadge />
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900">NYC&apos;s Most Extreme Properties</h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600 max-w-3xl leading-relaxed">
          Seven top-25 leaderboards pulled straight from the FY2027 DOF roll — biggest by units, by building footprint,
          by total value, by value per unit, oldest still standing, and the entity owners holding the most vacant land
          in the city.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            icon={<Plane className="h-4 w-4 text-blue-600" aria-hidden="true" />}
            label="Most valuable single lot"
            value={formatUSD(jfk.market_value, 2)}
            sub="JFK Airport, Queens"
            accent={CATEGORICAL_ORDER[0]}
          />
          <MetricCard
            label="Most residential units, single lot"
            value={formatNumber(riverbay.residential_units)}
            sub={riverbay.address}
            accent={CATEGORICAL_ORDER[1]}
          />
          <MetricCard
            label="Largest vacant-land holder"
            value={formatNumber(parksVacant.lots)}
            sub={`${parksVacant.name} · ${(parksVacant.total_lot_area_sqft / 43560).toFixed(0)} acres`}
            accent={CATEGORICAL_ORDER[2]}
          />
        </div>

        <div className="mt-10">
          <InsightCard
            eyebrow="Not a data error"
            headline={`${jfk.address}, Queens is a single $${(jfk.market_value / 1e9).toFixed(2)}B tax lot`}
            description="This is JFK International Airport, owned by the Port Authority of NY & NJ and classified as a single ~4,920-acre utility parcel in DOF's records — the entire airport footprint assessed as one BBL, which is why it towers over every other lot in the city by market value."
            href={`/properties/${jfk.bbl}`}
            linkLabel="View this property record"
            accent={CATEGORICAL_ORDER[5]}
          />
        </div>

        <div className="mt-10 space-y-10">
          <ExtremesSection
            id="most-valuable"
            title="Most valuable single lots"
            description="Ranked by DOF market value — dominated by Manhattan office towers, utility infrastructure, and one very large airport."
          >
            <ValueLeaderboardTable rows={data.most_valuable_single_lots} />
          </ExtremesSection>

          <ExtremesSection
            id="most-units"
            title="Biggest by residential units"
            description="Single tax lots with the most residential units on file — mostly Mitchell-Lama and large co-op/rental complexes."
          >
            <UnitsLeaderboardTable rows={data.biggest_by_residential_units} />
          </ExtremesSection>

          <ExtremesSection
            id="biggest-footprint"
            title="Biggest by building area"
            description="Largest building footprints in square feet — includes some odd institutional/government records worth a second look."
          >
            <AreaLeaderboardTable rows={data.biggest_by_building_area} />
          </ExtremesSection>

          <ExtremesSection
            id="value-per-unit"
            title="Highest value per residential unit"
            description="Total market value divided by residential unit count — limited to lots with 10+ units to avoid single/duo-unit noise."
          >
            <PerUnitLeaderboardTable rows={data.highest_value_per_residential_unit} />
          </ExtremesSection>

          <ExtremesSection
            id="oldest"
            title="Oldest still standing"
            description="Structures built before 1700 are excluded as near-certain data errors — everything here is a real surviving building."
          >
            <OldestLeaderboardTable rows={data.oldest_still_standing} />
          </ExtremesSection>

          <ExtremesSection
            id="vacant-land-owners"
            title="Largest vacant-land holders"
            description="Entity owner-groups (never individuals) ranked by summed lot area across all their vacant-land parcels citywide."
          >
            <VacantOwnerLeaderboardTable rows={data.largest_vacant_land_holdings_by_owner_group} />
          </ExtremesSection>

          <ExtremesSection
            id="vacant-lots"
            title="Largest single vacant lots"
            description="Individual vacant-land parcels ranked by lot area — not aggregated by owner."
          >
            <VacantLotLeaderboardTable rows={data.largest_single_vacant_lots} />
          </ExtremesSection>
        </div>

        <div className="mt-10 rounded-2xl bg-blue-50 border border-blue-200 p-5 text-sm text-slate-700">
          Want the full picture behind who&apos;s on these lists?{" "}
          <Link href="/owners" className="font-semibold text-blue-700 hover:underline inline-flex items-center gap-1">
            Browse entity owner profiles <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>{" "}
          or see where all this value sits on the{" "}
          <Link href="/analytics/treemap" className="font-semibold text-blue-700 hover:underline">
            value treemap
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
