"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatUSDFull } from "@/lib/format";
import { entityTypeColor } from "@/components/owners/entityTypeColors";
import type { OwnershipByType, UnitSizeBand } from "@/lib/types";

/** Dual-series view of unit-size bands: lots (buildings) vs. residential units they contain.
 * The two diverge sharply at the top end — a single 1000+ unit building is still just one lot,
 * so this is the chart that makes the properties-vs-units distinction visually obvious. */
export function UnitBandsDualChart({ bands }: { bands: UnitSizeBand[] }) {
  return (
    <div
      role="img"
      aria-label="Grouped bar chart comparing the number of buildings (lots) to the number of residential units they contain, across building-size bands from 1-unit buildings to 1000+ unit buildings — showing units concentrate in large buildings even though most lots are small"
      className="h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bands} margin={{ top: 10, right: 10, left: 4, bottom: 24 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="band" tick={{ ...AXIS_TICK, fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={50} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} width={56} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown, n: unknown) => [formatNumber(Number(v)), n === "lots" ? "Buildings (lots)" : "Residential units"]} />
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "lots" ? "Buildings (lots)" : "Residential units")} />
          <Bar dataKey="lots" fill={CATEGORICAL.blue} radius={[4, 4, 0, 0]} />
          <Bar dataKey="units" fill={CATEGORICAL.orange} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Housing stock composition — building/property types, from summed borough
 * property_type_distribution rollups (residential-relevant types only, largest first). */
export function StockCompositionChart({ rows }: { rows: { property_type: string; count: number }[] }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count).slice(0, 12);
  return (
    <div role="img" aria-label="Bar chart of NYC properties by building/property type — condo, one-family, elevator apartment, walk-up, coop, and more" className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} />
          <YAxis type="category" dataKey="property_type" tick={{ ...AXIS_TICK, fontSize: 11 }} width={140} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(Number(v)), "Lots"]} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {sorted.map((d, i) => (
              <Cell key={d.property_type} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function UnitsByEntityTypeChart({ byType }: { byType: OwnershipByType[] }) {
  const data = [...byType].filter((t) => t.residential_units > 0).sort((a, b) => b.residential_units - a.residential_units);
  return (
    <div role="img" aria-label="Bar chart of residential units held by owner entity type — individual, LLC, corporation, government, and others" className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} />
          <YAxis type="category" dataKey="type" tick={{ ...AXIS_TICK, fontSize: 11 }} width={140} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(Number(v)), "Residential units"]} />
          <Bar dataKey="residential_units" radius={[0, 4, 4, 0]}>
            {data.map((t) => (
              <Cell key={t.type} fill={entityTypeColor(t.type)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ValuePerUnitByBoroughChart({ rows }: { rows: { borough: string; value_per_unit: number }[] }) {
  return (
    <div role="img" aria-label="Bar chart of median property market value per residential unit by NYC borough" className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="borough" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => `$${Math.round(v / 1000)}K`} width={56} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [formatUSDFull(Number(v)), "Median value / resid. unit"]} />
          <Bar dataKey="value_per_unit" radius={[4, 4, 0, 0]}>
            {rows.map((r, i) => (
              <Cell key={r.borough} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
