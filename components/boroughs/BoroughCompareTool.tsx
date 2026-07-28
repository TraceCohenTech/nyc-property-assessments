"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatPct, formatUSD, formatUSDFull } from "@/lib/format";
import type { Aggregates, BoroughProfile } from "@/lib/types";

type BoroughLite = Aggregates["boroughs"][number];

async function loadBoroughProfile(name: string): Promise<BoroughProfile> {
  switch (name) {
    case "Manhattan":
      return ((await import("@/data/borough/manhattan.json")) as { default: BoroughProfile }).default;
    case "Brooklyn":
      return ((await import("@/data/borough/brooklyn.json")) as { default: BoroughProfile }).default;
    case "Queens":
      return ((await import("@/data/borough/queens.json")) as { default: BoroughProfile }).default;
    case "Bronx":
      return ((await import("@/data/borough/bronx.json")) as { default: BoroughProfile }).default;
    case "Staten Island":
      return ((await import("@/data/borough/staten-island.json")) as { default: BoroughProfile }).default;
    default:
      throw new Error(`Unknown borough: ${name}`);
  }
}

const BOROUGH_NAMES = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

function llcShare(entityMix: { type: string; total_value: number }[]): number {
  const total = entityMix.reduce((s, t) => s + t.total_value, 0);
  const llc = entityMix.find((t) => t.type === "LLC")?.total_value ?? 0;
  return total > 0 ? llc / total : 0;
}

/**
 * Client-side pick-two comparison tool. Borough profile JSON files are dynamically imported on
 * selection (not bundled up front) since only 5 exist and are small, but there's no reason to
 * ship all 5 in the initial /boroughs bundle when a visitor may only ever compare one pair.
 */
export function BoroughCompareTool({ boroughs }: { boroughs: BoroughLite[] }) {
  const [left, setLeft] = useState(boroughs[0]?.borough ?? "Manhattan");
  const [right, setRight] = useState(boroughs[1]?.borough ?? "Brooklyn");
  const [profiles, setProfiles] = useState<Record<string, BoroughProfile>>({});
  const [loading, setLoading] = useState(false);

  const names = BOROUGH_NAMES;

  useMemo(() => {
    const need = [left, right].filter((n) => !profiles[n]);
    if (need.length === 0) return;
    setLoading(true);
    Promise.all(need.map((n) => loadBoroughProfile(n).then((p) => [n, p] as const)))
      .then((pairs) => setProfiles((prev) => ({ ...prev, ...Object.fromEntries(pairs) })))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, right]);

  const l = profiles[left];
  const r = profiles[right];

  const chartData = l && r
    ? [
        { metric: "Total lots", [left]: l.totals.count, [right]: r.totals.count },
        { metric: "Resid. units", [left]: l.totals.residential_units, [right]: r.totals.residential_units },
      ]
    : [];

  const valueChartData = l && r
    ? [{ metric: "Total market value", [left]: l.totals.total_market_value, [right]: r.totals.total_market_value }]
    : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
      <h2 className="font-bold text-slate-900 mb-1">Compare two boroughs</h2>
      <p className="text-xs text-slate-500 mb-4">Side-by-side on lots, value, units, LLC share, and property mix.</p>

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Borough A</label>
          <select value={left} onChange={(e) => setLeft(e.target.value)} className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
            {names.map((n) => (
              <option key={n} value={n} disabled={n === right}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500">Borough B</label>
          <select value={right} onChange={(e) => setRight(e.target.value)} className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
            {names.map((n) => (
              <option key={n} value={n} disabled={n === left}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !l && !r && <p className="text-sm text-slate-500">Loading...</p>}

      {l && r && (
        <>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[560px] text-sm mb-6">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Metric</th>
                  <th className="py-2 pr-3 text-right">{left}</th>
                  <th className="py-2 pr-3 text-right">{right}</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Tax lots" a={formatNumber(l.totals.count)} b={formatNumber(r.totals.count)} />
                <Row label="Total market value" a={formatUSD(l.totals.total_market_value, 1)} b={formatUSD(r.totals.total_market_value, 1)} />
                <Row
                  label="Value per lot"
                  a={formatUSDFull(l.totals.total_market_value / l.totals.count)}
                  b={formatUSDFull(r.totals.total_market_value / r.totals.count)}
                />
                <Row label="Residential units" a={formatNumber(l.totals.residential_units)} b={formatNumber(r.totals.residential_units)} />
                <Row
                  label="Value per resid. unit"
                  a={formatUSDFull(l.medians.median_value_per_resid_unit)}
                  b={formatUSDFull(r.medians.median_value_per_resid_unit)}
                />
                <Row label="Median market value" a={formatUSDFull(l.medians.median_market_value)} b={formatUSDFull(r.medians.median_market_value)} />
                <Row label="Avg. year built" a={String(l.medians.avg_year_built)} b={String(r.medians.avg_year_built)} />
                <Row label="LLC share of value" a={formatPct(llcShare(l.entity_mix))} b={formatPct(llcShare(r.entity_mix))} />
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div style={{ height: 260 }}>
              <p className="text-xs font-semibold text-slate-500 mb-1">Lots &amp; residential units</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 4, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="metric" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} width={56} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => formatNumber(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={left} fill={CATEGORICAL.blue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={right} fill={CATEGORICAL.orange} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ height: 260 }}>
              <p className="text-xs font-semibold text-slate-500 mb-1">Total market value</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valueChartData} margin={{ top: 10, right: 10, left: 4, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="metric" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatUSD(v, 1)} width={56} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => formatUSDFull(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={left} fill={CATEGORICAL.blue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={right} fill={CATEGORICAL.orange} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2 pr-3 font-semibold text-slate-700">{label}</td>
      <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{a}</td>
      <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{b}</td>
    </tr>
  );
}
