import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plane } from "lucide-react";

import extremesRaw from "@/data/analytics/extremes.json";
import { formatNumber, formatUSD, formatUSDFull } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { InsightCard } from "@/components/ui/InsightCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { ExtremesSection } from "@/components/analytics-b/ExtremesSection";
import { OwnerGroupCell } from "@/components/analytics-b/OwnerGroupCell";

type PropertyRow = {
  bbl: string;
  address: string;
  borough: string;
  zip: string | null;
  property_type: string;
  building_class: string;
  owner_entity_type: string;
  owner_group_name: string | null;
};

type UnitsRow = PropertyRow & { residential_units: number; market_value: number };
type AreaRow = PropertyRow & { building_area: number; market_value: number };
type ValueRow = PropertyRow & { market_value: number };
type PerUnitRow = PropertyRow & { residential_units: number; market_value: number; value_per_residential_unit: number };
type OldestRow = PropertyRow & { year_built: number };
type VacantLotRow = PropertyRow & { lot_area_sqft: number };
type OwnerHoldingRow = { owner_group_id: number; name: string; owner_type: string; lots: number; total_lot_area_sqft: number; total_market_value: number };

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

const propCols = {
  address: (): DataTableColumn<PropertyRow> => ({
    key: "address",
    label: "Address",
    sortable: true,
    sortValue: (r) => r.address,
    render: (r) => (
      <Link href={`/properties/${r.bbl}`} className="font-semibold text-blue-700 hover:underline">
        {r.address || `BBL ${r.bbl}`}
      </Link>
    ),
  }),
  borough: (): DataTableColumn<PropertyRow> => ({
    key: "borough",
    label: "Borough",
    sortable: true,
    sortValue: (r) => r.borough,
    render: (r) => r.borough,
  }),
  owner: (): DataTableColumn<PropertyRow> => ({
    key: "owner",
    label: "Owner",
    render: (r) => <OwnerGroupCell name={r.owner_group_name} />,
  }),
};

export default function ExtremesPage() {
  const jfk = data.most_valuable_single_lots[0];
  const riverbay = data.biggest_by_residential_units[0];
  const parksVacant = data.largest_vacant_land_holdings_by_owner_group[0];

  const unitsColumns: DataTableColumn<UnitsRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "residential_units", label: "Units", align: "right", sortable: true, render: (r) => formatNumber(r.residential_units), sortValue: (r) => r.residential_units },
    { key: "market_value", label: "Value", align: "right", sortable: true, render: (r) => formatUSD(r.market_value, 1), sortValue: (r) => r.market_value },
    propCols.owner(),
  ];

  const areaColumns: DataTableColumn<AreaRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "building_area", label: "Building area (sqft)", align: "right", sortable: true, render: (r) => formatNumber(r.building_area), sortValue: (r) => r.building_area },
    { key: "market_value", label: "Value", align: "right", sortable: true, render: (r) => formatUSD(r.market_value, 1), sortValue: (r) => r.market_value },
    propCols.owner(),
  ];

  const valueColumns: DataTableColumn<ValueRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "property_type", label: "Type", sortable: true, sortValue: (r) => r.property_type, render: (r) => <span className="capitalize">{r.property_type}</span> },
    { key: "market_value", label: "Market value", align: "right", sortable: true, render: (r) => formatUSDFull(r.market_value), sortValue: (r) => r.market_value },
    propCols.owner(),
  ];

  const perUnitColumns: DataTableColumn<PerUnitRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "residential_units", label: "Units", align: "right", sortable: true, render: (r) => formatNumber(r.residential_units), sortValue: (r) => r.residential_units },
    { key: "value_per_residential_unit", label: "$ / unit", align: "right", sortable: true, render: (r) => formatUSDFull(r.value_per_residential_unit), sortValue: (r) => r.value_per_residential_unit },
    propCols.owner(),
  ];

  const oldestColumns: DataTableColumn<OldestRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "year_built", label: "Year built", align: "right", sortable: true, render: (r) => r.year_built, sortValue: (r) => r.year_built },
    { key: "property_type", label: "Type", sortable: true, sortValue: (r) => r.property_type, render: (r) => <span className="capitalize">{r.property_type}</span> },
    propCols.owner(),
  ];

  const vacantOwnerColumns: DataTableColumn<OwnerHoldingRow>[] = [
    {
      key: "name",
      label: "Owner",
      sortable: true,
      sortValue: (r) => r.name,
      render: (r) => <OwnerGroupCell name={r.name} />,
    },
    { key: "owner_type", label: "Type", sortable: true, sortValue: (r) => r.owner_type, render: (r) => r.owner_type },
    { key: "lots", label: "Vacant lots", align: "right", sortable: true, render: (r) => formatNumber(r.lots), sortValue: (r) => r.lots },
    { key: "total_lot_area_sqft", label: "Total lot area (sqft)", align: "right", sortable: true, render: (r) => formatNumber(r.total_lot_area_sqft), sortValue: (r) => r.total_lot_area_sqft },
    { key: "total_market_value", label: "Total value", align: "right", sortable: true, render: (r) => formatUSD(r.total_market_value, 1), sortValue: (r) => r.total_market_value },
  ];

  const vacantLotColumns: DataTableColumn<VacantLotRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "lot_area_sqft", label: "Lot area (sqft)", align: "right", sortable: true, render: (r) => formatNumber(r.lot_area_sqft), sortValue: (r) => r.lot_area_sqft },
    propCols.owner(),
  ];

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
            <div className="flex justify-end mb-2">
              <ExportButton rows={data.most_valuable_single_lots} filename="nyc-most-valuable-lots.csv" />
            </div>
            <DataTable columns={valueColumns} rows={data.most_valuable_single_lots} rowKey={(r) => r.bbl} initialSortKey="market_value" />
          </ExtremesSection>

          <ExtremesSection
            id="most-units"
            title="Biggest by residential units"
            description="Single tax lots with the most residential units on file — mostly Mitchell-Lama and large co-op/rental complexes."
          >
            <div className="flex justify-end mb-2">
              <ExportButton rows={data.biggest_by_residential_units} filename="nyc-biggest-by-units.csv" />
            </div>
            <DataTable columns={unitsColumns} rows={data.biggest_by_residential_units} rowKey={(r) => r.bbl} initialSortKey="residential_units" />
          </ExtremesSection>

          <ExtremesSection
            id="biggest-footprint"
            title="Biggest by building area"
            description="Largest building footprints in square feet — includes some odd institutional/government records worth a second look."
          >
            <div className="flex justify-end mb-2">
              <ExportButton rows={data.biggest_by_building_area} filename="nyc-biggest-by-area.csv" />
            </div>
            <DataTable columns={areaColumns} rows={data.biggest_by_building_area} rowKey={(r) => r.bbl} initialSortKey="building_area" />
          </ExtremesSection>

          <ExtremesSection
            id="value-per-unit"
            title="Highest value per residential unit"
            description="Total market value divided by residential unit count — limited to lots with 10+ units to avoid single/duo-unit noise."
          >
            <div className="flex justify-end mb-2">
              <ExportButton rows={data.highest_value_per_residential_unit} filename="nyc-value-per-unit.csv" />
            </div>
            <DataTable columns={perUnitColumns} rows={data.highest_value_per_residential_unit} rowKey={(r) => r.bbl} initialSortKey="value_per_residential_unit" />
          </ExtremesSection>

          <ExtremesSection
            id="oldest"
            title="Oldest still standing"
            description="Structures built before 1700 are excluded as near-certain data errors — everything here is a real surviving building."
          >
            <div className="flex justify-end mb-2">
              <ExportButton rows={data.oldest_still_standing} filename="nyc-oldest-buildings.csv" />
            </div>
            <DataTable columns={oldestColumns} rows={data.oldest_still_standing} rowKey={(r) => r.bbl} initialSortKey="year_built" initialSortDesc={false} />
          </ExtremesSection>

          <ExtremesSection
            id="vacant-land-owners"
            title="Largest vacant-land holders"
            description="Entity owner-groups (never individuals) ranked by summed lot area across all their vacant-land parcels citywide."
          >
            <div className="flex justify-end mb-2">
              <ExportButton rows={data.largest_vacant_land_holdings_by_owner_group} filename="nyc-vacant-land-owners.csv" />
            </div>
            <DataTable columns={vacantOwnerColumns} rows={data.largest_vacant_land_holdings_by_owner_group} rowKey={(r) => String(r.owner_group_id)} initialSortKey="total_lot_area_sqft" />
          </ExtremesSection>

          <ExtremesSection
            id="vacant-lots"
            title="Largest single vacant lots"
            description="Individual vacant-land parcels ranked by lot area — not aggregated by owner."
          >
            <div className="flex justify-end mb-2">
              <ExportButton rows={data.largest_single_vacant_lots} filename="nyc-vacant-lots.csv" />
            </div>
            <DataTable columns={vacantLotColumns} rows={data.largest_single_vacant_lots} rowKey={(r) => r.bbl} initialSortKey="lot_area_sqft" />
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
