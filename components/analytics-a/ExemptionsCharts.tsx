"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatPct, formatUSD, formatUSDFull } from "@/lib/format";

type BoroughRow = { borough: string; exempt_value: number; taxable_value: number; share_of_value_exempt: number };

const BOROUGH_ORDER = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

/** Stacked bar: exempt vs. taxable value by borough. */
export function ExemptVsTaxableByBoroughChart({ rows }: { rows: BoroughRow[] }) {
  const data = [...rows].sort((a, b) => BOROUGH_ORDER.indexOf(a.borough) - BOROUGH_ORDER.indexOf(b.borough));
  return (
    <div
      role="img"
      className="h-full"
      aria-label="Stacked bar chart of exempt versus taxable assessed value by NYC borough"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="borough" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatUSD(v, 0)} width={56} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [
              formatUSDFull(Number(value)),
              name === "exempt_value" ? "Exempt value" : "Taxable value",
            ]}
          />
          <Legend
            formatter={(v: string) => (v === "exempt_value" ? "Exempt value" : "Taxable value")}
            wrapperStyle={{ fontSize: 12, color: "#475569" }}
          />
          <Bar dataKey="taxable_value" stackId="v" name="taxable_value" fill={CATEGORICAL.blue} radius={[0, 0, 0, 0]} />
          <Bar dataKey="exempt_value" stackId="v" name="exempt_value" fill={CATEGORICAL.red} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type ClassRow = { tax_class: string; share_of_value_exempt: number };

/** Share of value exempt, by tax class. */
export function ExemptShareByClassChart({ rows }: { rows: ClassRow[] }) {
  const data = [...rows]
    .filter((r) => !r.tax_class.match(/^(1A|1B|1C|1D|2A|2B|2C)$/)) // keep the 4 headline classes readable
    .sort((a, b) => a.tax_class.localeCompare(b.tax_class))
    .map((r) => ({ name: `Class ${r.tax_class}`, pct: Math.round(r.share_of_value_exempt * 1000) / 10 }));
  return (
    <div role="img" className="h-full" aria-label="Bar chart of the share of assessed value that is tax-exempt, by tax class">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} width={44} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}%`, "Share of value exempt"]} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type EntityTypeRow = { owner_entity_type: string; share_of_value_exempt: number; exempt_value: number };

/** Horizontal bar: share of value exempt, by owner entity type. */
export function ExemptShareByOwnerTypeChart({ rows }: { rows: EntityTypeRow[] }) {
  const data = [...rows].filter((r) => r.exempt_value > 0).sort((a, b) => b.share_of_value_exempt - a.share_of_value_exempt);
  return (
    <div
      role="img"
      className="h-full"
      aria-label="Horizontal bar chart of the share of assessed value that is tax-exempt, by owner entity type"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatPct(v, 0)} />
          <YAxis type="category" dataKey="owner_entity_type" tick={{ ...AXIS_TICK, fontSize: 11 }} width={150} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [formatPct(Number(v), 1), "Share of value exempt"]} />
          <Bar dataKey="share_of_value_exempt" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={d.owner_entity_type} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function fmtN(v: number) {
  return formatNumber(v);
}
