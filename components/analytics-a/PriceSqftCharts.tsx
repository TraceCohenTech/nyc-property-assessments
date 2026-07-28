"use client";

import { Bar, BarChart, CartesianGrid, ErrorBar, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";

type PercentileRow = { property_type: string; borough: string; n: number; p10: number; p25: number; median: number; p75: number; p90: number };

/**
 * Percentile "band" chart for a single property type across all 5 boroughs: a floating bar from
 * p10-p90 (the range) with a marker dot at the median. Built from Recharts primitives only
 * (ErrorBar on a Scatter median point) — deliberately NOT a fake box-plot, per site chart rules.
 */
export function PercentileBandChart({ rows, propertyType }: { rows: PercentileRow[]; propertyType: string }) {
  const filtered = rows.filter((r) => r.property_type === propertyType);
  const BOROUGH_ORDER = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
  const data = filtered
    .sort((a, b) => BOROUGH_ORDER.indexOf(a.borough) - BOROUGH_ORDER.indexOf(b.borough))
    .map((r, i) => ({
      borough: r.borough,
      x: i,
      median: r.median,
      low: r.median - r.p10,
      high: r.p90 - r.median,
      p10: r.p10,
      p25: r.p25,
      p75: r.p75,
      p90: r.p90,
      n: r.n,
    }));

  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-8 text-center">No data for this property type.</p>;
  }

  return (
    <div
      role="img"
      className="h-full"
      aria-label={`Percentile range chart of dollars per square foot for ${propertyType} properties across NYC boroughs, showing p10 through p90 range with the median marked`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 20, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[-0.5, data.length - 0.5]}
            ticks={data.map((d) => d.x)}
            tickFormatter={(v) => data[v as number]?.borough ?? ""}
            tick={AXIS_TICK}
          />
          <YAxis type="number" dataKey="median" tick={AXIS_TICK} tickFormatter={(v) => `$${v}`} width={56} />
          <ZAxis range={[80, 80]} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(_value: unknown, _name: unknown, item: unknown) => {
              const p = item as { payload?: (typeof data)[number] };
              const d = p?.payload;
              if (!d) return ["", ""];
              return [`p10 $${d.p10} · p25 $${d.p25} · median $${d.median} · p75 $${d.p75} · p90 $${d.p90}`, `${d.n.toLocaleString()} lots`];
            }}
            labelFormatter={() => ""}
          />
          <Scatter data={data} fill={CATEGORICAL.blue}>
            <ErrorBar dataKey="low" width={0} strokeWidth={8} stroke={CATEGORICAL.blue} direction="y" opacity={0.35} />
            <ErrorBar dataKey="high" width={0} strokeWidth={8} stroke={CATEGORICAL.blue} direction="y" opacity={0.35} />
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

type CountByType = { property_type: string; n: number };

/** Simple bar chart of sample size (n) by property type, to pick a sensible default tab. */
export function PropertyTypeCoverageChart({ data }: { data: CountByType[] }) {
  return (
    <div role="img" className="h-full" aria-label="Bar chart of the number of lots per property type in the $/sqft dataset">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="property_type" tick={{ ...AXIS_TICK, fontSize: 11 }} angle={-20} textAnchor="end" interval={0} height={44} />
          <YAxis tick={AXIS_TICK} width={48} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [Number(v).toLocaleString(), "Lots"]} />
          <Bar dataKey="n" fill={CATEGORICAL.aqua} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
