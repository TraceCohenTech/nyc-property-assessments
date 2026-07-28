"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatPct } from "@/lib/format";

type CumRow = { top_n: number | string; owner_groups: number; cumulative_value: number; share_of_citywide_market_value: number };

/** Cumulative value share held by the top 10/50/100/500/all tracked entity owner-groups. */
export function CumulativeShareChart({ rows }: { rows: CumRow[] }) {
  const data = rows.map((r) => ({ label: typeof r.top_n === "number" ? `Top ${formatNumber(r.top_n)}` : "All 3,282", pct: Math.round(r.share_of_citywide_market_value * 1000) / 10 }));
  return (
    <div
      role="img"
      className="h-full"
      aria-label="Bar chart of cumulative share of citywide market value held by the top 10, 50, 100, 500, and all tracked entity owner-groups"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} width={44} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}%`, "Share of citywide value"]} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={d.label} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type SplitRow = { type: string; lots: number; market_value: number; share_of_citywide_value: number };

/** Government / private-entity / individual / unknown-other value & lot-count splits, side by side. */
export function OwnershipSplitChart({ rows }: { rows: SplitRow[] }) {
  const byValue = rows.map((r) => ({ type: r.type, metric: "value", pct: Math.round(r.share_of_citywide_value * 1000) / 10 }));
  return (
    <div role="img" className="h-full" aria-label="Bar chart of share of citywide property value by ownership type: government, private entity aggregate, individual, and unknown/other">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={byValue} margin={{ top: 10, right: 10, left: 4, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="type" tick={{ ...AXIS_TICK, fontSize: 11 }} angle={-15} textAnchor="end" interval={0} height={44} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} width={44} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}%`, "Share of citywide market value"]} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {byValue.map((d, i) => (
              <Cell key={d.type} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type LlcBoroughRow = { borough: string; llc_share_of_value: number; llc_share_of_lots: number };

const BOROUGH_ORDER = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

/** LLC share of value vs. share of lots, by borough — grouped bars. */
export function LlcShareByBoroughChart({ rows }: { rows: LlcBoroughRow[] }) {
  const data = [...rows]
    .sort((a, b) => BOROUGH_ORDER.indexOf(a.borough) - BOROUGH_ORDER.indexOf(b.borough))
    .map((r) => ({ borough: r.borough, value_share: Math.round(r.llc_share_of_value * 1000) / 10, lot_share: Math.round(r.llc_share_of_lots * 1000) / 10 }));
  return (
    <div role="img" className="h-full" aria-label="Grouped bar chart of LLC share of property value versus LLC share of lot count, by borough">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="borough" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} width={44} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [`${value}%`, name === "value_share" ? "Share of value" : "Share of lots"]}
          />
          <Legend
            formatter={(value: string) => (value === "value_share" ? "Share of value" : "Share of lots")}
            wrapperStyle={{ fontSize: 12, color: "#475569" }}
          />
          <Bar dataKey="value_share" name="value_share" fill={CATEGORICAL.blue} radius={[4, 4, 0, 0]} />
          <Bar dataKey="lot_share" name="lot_share" fill={CATEGORICAL.orange} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function pctLabel(v: number) {
  return formatPct(v, 1);
}
