"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { AXIS_TICK, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatPct, formatUSDFull } from "@/lib/format";

export const FAMILY_LABEL: Record<string, string> = {
  "1": "Class 1 — 1-3 family homes",
  "2": "Class 2 — Rentals, co-ops & condos",
  "3": "Class 3 — Utility",
  "4": "Class 4 — Commercial & industrial",
};

type FamilyRow = {
  base_class_family: string;
  label: string;
  count: number;
  total_market_value: number;
  citywide_assessed_to_market_ratio: number;
  citywide_taxable_to_market_ratio: number;
};

/** Grouped bar chart: assessed-to-market ratio for each of the 4 statutory tax class families. */
export function RatioByClassFamilyChart({ rows }: { rows: FamilyRow[] }) {
  const data = rows.map((r) => ({
    name: `Class ${r.base_class_family}`,
    fullName: FAMILY_LABEL[r.base_class_family] ?? r.label,
    ratio: Math.round(r.citywide_assessed_to_market_ratio * 1000) / 10,
    taxableRatio: Math.round(r.citywide_taxable_to_market_ratio * 1000) / 10,
  }));

  return (
    <div
      role="img"
      className="h-full"
      aria-label="Bar chart of the effective assessed-to-market-value ratio for each of NYC's four statutory tax classes, showing Class 1 at roughly 6% versus Class 2, 3, and 4 at roughly 45%"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} width={48} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value: unknown) => [`${value}%`, "Assessed / market value"]}
            labelFormatter={(label: unknown, payload: unknown) => {
              const p = payload as Array<{ payload?: { fullName?: string } }> | undefined;
              return p?.[0]?.payload?.fullName ?? String(label ?? "");
            }}
          />
          <Bar dataKey="ratio" radius={[6, 6, 0, 0]} animationDuration={900}>
            {data.map((d, i) => (
              <Cell key={d.name} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type MatrixRow = {
  base_class_family: string;
  borough: string;
  citywide_assessed_to_market_ratio: number;
  count: number;
  total_market_value: number;
};

const BOROUGH_ORDER = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const FAMILY_ORDER = ["1", "2", "3", "4"];

function heatBg(ratio: number): string {
  // Magnitude scale 0 -> ~0.5, single hue (blue), per dataviz rule: single-hue OK for magnitude.
  const t = Math.min(1, ratio / 0.5);
  const alpha = 0.08 + t * 0.42;
  return `rgba(42, 120, 214, ${alpha.toFixed(2)})`;
}

/** Heatmap-style ratio matrix: tax class family (rows) x borough (columns). */
export function RatioMatrixTable({ rows }: { rows: MatrixRow[] }) {
  const byKey = new Map(rows.map((r) => [`${r.base_class_family}|${r.borough}`, r]));

  return (
    <div className="overflow-x-auto -mx-2 px-2">
      <table className="w-full min-w-[560px] text-sm border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="text-left text-xs uppercase tracking-wider text-slate-500 py-2 pr-3">Tax class</th>
            {BOROUGH_ORDER.map((b) => (
              <th key={b} className="text-center text-xs uppercase tracking-wider text-slate-500 py-2 px-2">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FAMILY_ORDER.map((f) => (
            <tr key={f} className="border-t border-slate-100">
              <td className="py-2 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                <Link href={`/explorer?tax_class=${f}`} className="hover:text-blue-700 hover:underline">
                  Class {f}
                </Link>
              </td>
              {BOROUGH_ORDER.map((b) => {
                const cell = byKey.get(`${f}|${b}`);
                return (
                  <td key={b} className="p-0">
                    <div
                      className="m-1 rounded-lg py-2.5 text-center tabular-nums font-semibold text-slate-900"
                      style={{ background: cell ? heatBg(cell.citywide_assessed_to_market_ratio) : "transparent" }}
                    >
                      {cell ? formatPct(cell.citywide_assessed_to_market_ratio, 1) : "—"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-slate-500 mt-3">
        Cell shading is a magnitude scale (darker = higher effective assessment ratio) — the pattern is nearly flat
        across all five boroughs within each class, confirming this is a statutory rule, not a borough-specific
        market effect.
      </p>
    </div>
  );
}

/** A $1M home (Class 1) vs. a $1M slice of a Class 2 condo building, side by side. */
export function TaxBurdenExampleCards({
  class1Ratio,
  class2Ratio,
}: {
  class1Ratio: number;
  class2Ratio: number;
}) {
  const homeAssessed = 1_000_000 * class1Ratio;
  const condoAssessed = 1_000_000 * class2Ratio;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">Class 1 — $1M home</div>
        <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatUSDFull(homeAssessed)}</div>
        <p className="text-xs text-slate-500 mt-1">Assessed value, at the citywide Class 1 ratio ({formatPct(class1Ratio, 1)})</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="text-xs font-semibold uppercase tracking-wider text-orange-600 mb-1">
          Class 2 — $1M condo/co-op slice
        </div>
        <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatUSDFull(condoAssessed)}</div>
        <p className="text-xs text-slate-500 mt-1">Assessed value, at the citywide Class 2 ratio ({formatPct(class2Ratio, 1)})</p>
      </div>
    </div>
  );
}

export function formatCount(v: number): string {
  return formatNumber(v);
}
