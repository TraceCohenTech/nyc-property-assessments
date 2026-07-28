"use client";

import Link from "next/link";
import { formatNumber, formatUSD, formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { OwnerGroupCell } from "@/components/analytics-b/OwnerGroupCell";

// Column-definition objects hold render/sortValue functions, which React cannot serialize
// across the server -> client component boundary. Every leaderboard table on /analytics/extremes
// therefore lives in this "use client" file — columns are built here, not in the server page,
// and the page only ever passes plain JSON row arrays as props.

export type PropertyRow = {
  bbl: string;
  address: string;
  borough: string;
  zip: string | null;
  property_type: string;
  building_class: string;
  owner_entity_type: string;
  owner_group_name: string | null;
};

export type UnitsRow = PropertyRow & { residential_units: number; market_value: number };
export type AreaRow = PropertyRow & { building_area: number; market_value: number };
export type ValueRow = PropertyRow & { market_value: number };
export type PerUnitRow = PropertyRow & { residential_units: number; market_value: number; value_per_residential_unit: number };
export type OldestRow = PropertyRow & { year_built: number };
export type VacantLotRow = PropertyRow & { lot_area_sqft: number };
export type OwnerHoldingRow = { owner_group_id: number; name: string; owner_type: string; lots: number; total_lot_area_sqft: number; total_market_value: number };

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

function TableHeader({ rows, filename }: { rows: Record<string, unknown>[]; filename: string }) {
  return (
    <div className="flex justify-end mb-2">
      <ExportButton rows={rows} filename={filename} />
    </div>
  );
}

export function ValueLeaderboardTable({ rows }: { rows: ValueRow[] }) {
  const columns: DataTableColumn<ValueRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "property_type", label: "Type", sortable: true, sortValue: (r) => r.property_type, render: (r) => <span className="capitalize">{r.property_type}</span> },
    { key: "market_value", label: "Market value", align: "right", sortable: true, render: (r) => formatUSDFull(r.market_value), sortValue: (r) => r.market_value },
    propCols.owner(),
  ];
  return (
    <>
      <TableHeader rows={rows} filename="nyc-most-valuable-lots.csv" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.bbl} initialSortKey="market_value" />
    </>
  );
}

export function UnitsLeaderboardTable({ rows }: { rows: UnitsRow[] }) {
  const columns: DataTableColumn<UnitsRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "residential_units", label: "Units", align: "right", sortable: true, render: (r) => formatNumber(r.residential_units), sortValue: (r) => r.residential_units },
    { key: "market_value", label: "Value", align: "right", sortable: true, render: (r) => formatUSD(r.market_value, 1), sortValue: (r) => r.market_value },
    propCols.owner(),
  ];
  return (
    <>
      <TableHeader rows={rows} filename="nyc-biggest-by-units.csv" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.bbl} initialSortKey="residential_units" />
    </>
  );
}

export function AreaLeaderboardTable({ rows }: { rows: AreaRow[] }) {
  const columns: DataTableColumn<AreaRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "building_area", label: "Building area (sqft)", align: "right", sortable: true, render: (r) => formatNumber(r.building_area), sortValue: (r) => r.building_area },
    { key: "market_value", label: "Value", align: "right", sortable: true, render: (r) => formatUSD(r.market_value, 1), sortValue: (r) => r.market_value },
    propCols.owner(),
  ];
  return (
    <>
      <TableHeader rows={rows} filename="nyc-biggest-by-area.csv" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.bbl} initialSortKey="building_area" />
    </>
  );
}

export function PerUnitLeaderboardTable({ rows }: { rows: PerUnitRow[] }) {
  const columns: DataTableColumn<PerUnitRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "residential_units", label: "Units", align: "right", sortable: true, render: (r) => formatNumber(r.residential_units), sortValue: (r) => r.residential_units },
    { key: "value_per_residential_unit", label: "$ / unit", align: "right", sortable: true, render: (r) => formatUSDFull(r.value_per_residential_unit), sortValue: (r) => r.value_per_residential_unit },
    propCols.owner(),
  ];
  return (
    <>
      <TableHeader rows={rows} filename="nyc-value-per-unit.csv" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.bbl} initialSortKey="value_per_residential_unit" />
    </>
  );
}

export function OldestLeaderboardTable({ rows }: { rows: OldestRow[] }) {
  const columns: DataTableColumn<OldestRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "year_built", label: "Year built", align: "right", sortable: true, render: (r) => r.year_built, sortValue: (r) => r.year_built },
    { key: "property_type", label: "Type", sortable: true, sortValue: (r) => r.property_type, render: (r) => <span className="capitalize">{r.property_type}</span> },
    propCols.owner(),
  ];
  return (
    <>
      <TableHeader rows={rows} filename="nyc-oldest-buildings.csv" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.bbl} initialSortKey="year_built" initialSortDesc={false} />
    </>
  );
}

export function VacantOwnerLeaderboardTable({ rows }: { rows: OwnerHoldingRow[] }) {
  const columns: DataTableColumn<OwnerHoldingRow>[] = [
    { key: "name", label: "Owner", sortable: true, sortValue: (r) => r.name, render: (r) => <OwnerGroupCell name={r.name} /> },
    { key: "owner_type", label: "Type", sortable: true, sortValue: (r) => r.owner_type, render: (r) => r.owner_type },
    { key: "lots", label: "Vacant lots", align: "right", sortable: true, render: (r) => formatNumber(r.lots), sortValue: (r) => r.lots },
    { key: "total_lot_area_sqft", label: "Total lot area (sqft)", align: "right", sortable: true, render: (r) => formatNumber(r.total_lot_area_sqft), sortValue: (r) => r.total_lot_area_sqft },
    { key: "total_market_value", label: "Total value", align: "right", sortable: true, render: (r) => formatUSD(r.total_market_value, 1), sortValue: (r) => r.total_market_value },
  ];
  return (
    <>
      <TableHeader rows={rows} filename="nyc-vacant-land-owners.csv" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => String(r.owner_group_id)} initialSortKey="total_lot_area_sqft" />
    </>
  );
}

export function VacantLotLeaderboardTable({ rows }: { rows: VacantLotRow[] }) {
  const columns: DataTableColumn<VacantLotRow>[] = [
    propCols.address(),
    propCols.borough(),
    { key: "lot_area_sqft", label: "Lot area (sqft)", align: "right", sortable: true, render: (r) => formatNumber(r.lot_area_sqft), sortValue: (r) => r.lot_area_sqft },
    propCols.owner(),
  ];
  return (
    <>
      <TableHeader rows={rows} filename="nyc-vacant-lots.csv" />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.bbl} initialSortKey="lot_area_sqft" />
    </>
  );
}
