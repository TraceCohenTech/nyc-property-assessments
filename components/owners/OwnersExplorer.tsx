"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";

import type { Owner, OwnerIndexRow } from "@/lib/types";
import { formatNumber, formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { OwnerBadge } from "@/components/ui/OwnerBadge";
import { entityTypeColor } from "./entityTypeColors";

type Metric = "total_market_value" | "lots" | "residential_units" | "total_units";

const METRIC_LABEL: Record<Metric, string> = {
  total_market_value: "Total market value",
  lots: "Lots owned",
  residential_units: "Residential units",
  total_units: "Total units",
};

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const OWNER_TYPES = [
  "LLC",
  "Corporation",
  "Government",
  "Trust/Estate",
  "Nonprofit/Institution",
  "Partnership",
  "Cooperative corporation",
  "Housing company",
];

const RAW_METRICS: Metric[] = ["total_market_value", "lots"];
const CONSOLIDATED_METRICS: Metric[] = ["total_market_value", "lots", "residential_units", "total_units"];

/**
 * Full interactive Owners directory. Two data modes:
 *  - "consolidated" (default): the 500 owner groups from data/owners/index.json — formatting
 *    variants of the same entity (e.g. "123 MAIN ST LLC" vs "123 Main St. L.L.C.") merged into
 *    one row, plus curated government-agency consolidation. Rows link to a full /owners/[slug]
 *    profile.
 *  - "raw" ("owners of record"): data/aggregates.json's top_owners, filtered to entity owners
 *    only, exactly as the strings appear on the DOF roll — every spelling variant is its own
 *    row. No profile page exists per raw row, so nothing links out.
 * Both modes are entity-only: individual owners are never included (enforced upstream — see
 * lib/ownerPrivacy.ts / the ETL's ENTITY-ONLY guard).
 */
export function OwnersExplorer({ consolidated, rawOwners }: { consolidated: OwnerIndexRow[]; rawOwners: Owner[] }) {
  const [mode, setMode] = useState<"consolidated" | "raw">("consolidated");
  const [metric, setMetric] = useState<Metric>("total_market_value");
  const [ownerType, setOwnerType] = useState("");
  const [borough, setBorough] = useState("");
  const [minValue, setMinValue] = useState("");

  const availableMetrics = mode === "raw" ? RAW_METRICS : CONSOLIDATED_METRICS;
  const effectiveMetric: Metric = availableMetrics.includes(metric) ? metric : "total_market_value";

  const filteredConsolidated = useMemo(() => {
    let rows = consolidated;
    if (ownerType) rows = rows.filter((r) => r.owner_type === ownerType);
    if (borough) rows = rows.filter((r) => r.boroughs.includes(borough));
    const min = Number(minValue);
    if (min > 0) rows = rows.filter((r) => r.total_market_value >= min);
    return [...rows].sort((a, b) => (b[effectiveMetric] as number) - (a[effectiveMetric] as number));
  }, [consolidated, ownerType, borough, minValue, effectiveMetric]);

  const filteredRaw = useMemo(() => {
    let rows = rawOwners;
    const min = Number(minValue);
    if (min > 0) rows = rows.filter((r) => r.total_market_value >= min);
    const sortKey = effectiveMetric === "lots" ? "property_count" : "total_market_value";
    return [...rows].sort((a, b) => (b[sortKey as "property_count" | "total_market_value"] as number) - (a[sortKey as "property_count" | "total_market_value"] as number));
  }, [rawOwners, minValue, effectiveMetric]);

  const consolidatedColumns: DataTableColumn<OwnerIndexRow>[] = [
    { key: "rank", label: "#", sortable: false, render: (r) => filteredConsolidated.indexOf(r) + 1 },
    {
      key: "name",
      label: "Owner",
      sortable: false,
      render: (r) => (
        <Link href={`/owners/${r.slug}`} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">
          {r.name}
        </Link>
      ),
    },
    {
      key: "owner_type",
      label: "Type",
      sortable: false,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: entityTypeColor(r.owner_type) }} aria-hidden="true" />
          {r.owner_type}
        </span>
      ),
    },
    {
      key: "confidence",
      label: "Confidence",
      sortable: false,
      render: (r) => <ConfidenceBadge level={r.confidence} />,
    },
    {
      key: "lots",
      label: "Lots",
      align: "right",
      sortable: true,
      sortValue: (r) => r.lots,
      render: (r) => formatNumber(r.lots),
    },
    {
      key: "residential_units",
      label: "Resid. units",
      align: "right",
      sortable: true,
      sortValue: (r) => r.residential_units,
      render: (r) => formatNumber(r.residential_units),
    },
    {
      key: "total_market_value",
      label: "Total market value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_market_value,
      render: (r) => formatUSDFull(r.total_market_value),
    },
  ];

  const rawColumns: DataTableColumn<Owner>[] = [
    { key: "rank", label: "#", sortable: false, render: (r) => filteredRaw.indexOf(r) + 1 },
    { key: "owner", label: "Owner (as filed)", sortable: false, render: (r) => <OwnerBadge owner={r.owner} /> },
    {
      key: "property_count",
      label: "Properties",
      align: "right",
      sortable: true,
      sortValue: (r) => r.property_count,
      render: (r) => formatNumber(r.property_count),
    },
    {
      key: "total_assessed_value",
      label: "Total assessed value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_assessed_value,
      render: (r) => formatUSDFull(r.total_assessed_value),
    },
    {
      key: "total_market_value",
      label: "Total market value",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total_market_value,
      render: (r) => formatUSDFull(r.total_market_value),
    },
  ];

  return (
    <div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50">
            <button
              type="button"
              onClick={() => setMode("consolidated")}
              className={`min-h-[36px] px-3 rounded-md text-xs font-semibold ${mode === "consolidated" ? "bg-blue-600 text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              Consolidated groups
            </button>
            <button
              type="button"
              onClick={() => setMode("raw")}
              className={`min-h-[36px] px-3 rounded-md text-xs font-semibold ${mode === "raw" ? "bg-blue-600 text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              Owners of record
            </button>
          </div>

          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <span className="text-xs font-semibold text-slate-500">Rank by</span>
            <select
              value={effectiveMetric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-900"
            >
              {availableMetrics.map((m) => (
                <option key={m} value={m}>
                  {METRIC_LABEL[m]}
                </option>
              ))}
            </select>
          </div>

          <ExportButton
            rows={
              mode === "consolidated"
                ? filteredConsolidated.map((r, i) => ({ rank: i + 1, name: r.name, owner_type: r.owner_type, confidence: r.confidence, lots: r.lots, residential_units: r.residential_units, total_units: r.total_units, total_market_value: r.total_market_value, total_assessed_value: r.total_assessed_value, boroughs: r.boroughs.join("; ") }))
                : filteredRaw.map((r, i) => ({ rank: i + 1, owner: r.owner, properties: r.property_count, total_assessed_value: r.total_assessed_value, total_market_value: r.total_market_value }))
            }
            filename={mode === "consolidated" ? "nyc-owner-groups.csv" : "nyc-owners-of-record.csv"}
            label="Export CSV"
          />
        </div>

        <p className="text-xs text-slate-500 flex items-start gap-1.5 mb-4">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-500" aria-hidden="true" />
          {mode === "consolidated" ? (
            <span>
              <strong className="text-slate-700">Consolidated groups</strong> merge exact formatting-variant spellings of the
              same legal entity (e.g. "123 MAIN ST LLC" vs "123 Main St., L.L.C.") and government agencies under one
              canonical name — never by shared address or partial name match. See the{" "}
              <Link href="/methodology#owner-consolidation" className="font-semibold text-blue-700 hover:underline">
                consolidation methodology
              </Link>
              .
            </span>
          ) : (
            <span>
              <strong className="text-slate-700">Owners of record</strong> shows entity owners exactly as filed with DOF — every
              spelling variant is its own row, unconsolidated. Compare against the consolidated view to see how much
              fragmentation formatting variants cause.
            </span>
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mode === "consolidated" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Owner type</label>
                <select
                  value={ownerType}
                  onChange={(e) => setOwnerType(e.target.value)}
                  className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  <option value="">All types</option>
                  {OWNER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-500">Borough</label>
                <select
                  value={borough}
                  onChange={(e) => setBorough(e.target.value)}
                  className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  <option value="">All boroughs</option>
                  {BOROUGHS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Minimum total market value</label>
            <input
              type="number"
              min={0}
              placeholder="e.g. 100000000"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {mode === "consolidated" ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">{filteredConsolidated.length} owner groups</h2>
          </div>
          <DataTable
            columns={consolidatedColumns}
            rows={filteredConsolidated}
            rowKey={(r) => r.slug}
            initialSortKey={effectiveMetric}
            initialSortDesc
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">{filteredRaw.length} owners of record</h2>
          </div>
          <DataTable columns={rawColumns} rows={filteredRaw} rowKey={(r) => r.owner} initialSortKey={effectiveMetric === "lots" ? "property_count" : "total_market_value"} initialSortDesc />
        </>
      )}
    </div>
  );
}
