"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatPct, formatUSD, formatUSDFull } from "@/lib/format";
import type { ZipRow } from "@/components/analytics-b/ZipLeagueTable";

/** Pick-two ZIP comparison — mirrors components/boroughs/BoroughCompareTool.tsx's pattern, but
 * synchronous (no dynamic import needed) since all 185 ZIPs are already in one small JSON file. */
export function ZipCompareTool({ zips }: { zips: ZipRow[] }) {
  const sorted = [...zips].sort((a, b) => a.zip.localeCompare(b.zip));
  const [leftZip, setLeftZip] = useState(sorted[0]?.zip ?? "");
  const [rightZip, setRightZip] = useState(sorted[1]?.zip ?? "");

  const l = zips.find((z) => z.zip === leftZip);
  const r = zips.find((z) => z.zip === rightZip);

  const chartData = l && r ? [{ metric: "Lots", [leftZip]: l.lots, [rightZip]: r.lots }] : [];
  const valueChartData =
    l && r ? [{ metric: "Total market value", [leftZip]: l.total_market_value, [rightZip]: r.total_market_value }] : [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
      <h2 className="font-bold text-slate-900 mb-1">Compare two ZIPs</h2>
      <p className="text-xs text-slate-500 mb-4">Side-by-side on value, $/sqft, units, and ownership mix.</p>

      <div className="grid grid-cols-2 gap-3 mb-6 max-w-md">
        <div className="flex flex-col gap-1">
          <label htmlFor="zip-compare-a" className="text-xs font-semibold text-slate-500">
            ZIP A
          </label>
          <select
            id="zip-compare-a"
            value={leftZip}
            onChange={(e) => setLeftZip(e.target.value)}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            {sorted.map((z) => (
              <option key={z.zip} value={z.zip} disabled={z.zip === rightZip}>
                {z.zip} — {z.borough}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="zip-compare-b" className="text-xs font-semibold text-slate-500">
            ZIP B
          </label>
          <select
            id="zip-compare-b"
            value={rightZip}
            onChange={(e) => setRightZip(e.target.value)}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
          >
            {sorted.map((z) => (
              <option key={z.zip} value={z.zip} disabled={z.zip === leftZip}>
                {z.zip} — {z.borough}
              </option>
            ))}
          </select>
        </div>
      </div>

      {l && r && (
        <>
          <p className="sm:hidden text-[11px] text-slate-400 mb-1.5">Swipe to see all columns &rarr;</p>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full min-w-[560px] text-sm mb-6">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Metric</th>
                  <th className="py-2 pr-3 text-right">
                    {leftZip} ({l.borough})
                  </th>
                  <th className="py-2 pr-3 text-right">
                    {rightZip} ({r.borough})
                  </th>
                </tr>
              </thead>
              <tbody>
                <Row label="Tax lots" a={formatNumber(l.lots)} b={formatNumber(r.lots)} />
                <Row label="Total market value" a={formatUSD(l.total_market_value, 1)} b={formatUSD(r.total_market_value, 1)} />
                <Row label="Median market value" a={formatUSDFull(l.median_market_value)} b={formatUSDFull(r.median_market_value)} />
                <Row label="Median $/sqft" a={`$${l.median_price_per_sqft.toFixed(0)}`} b={`$${r.median_price_per_sqft.toFixed(0)}`} />
                <Row label="Residential units" a={formatNumber(l.residential_units)} b={formatNumber(r.residential_units)} />
                <Row label="LLC share" a={formatPct(l.llc_share, 1)} b={formatPct(r.llc_share, 1)} />
                <Row label="Government share" a={formatPct(l.government_share, 1)} b={formatPct(r.government_share, 1)} />
                <Row label="Dominant type" a={l.dominant_property_type} b={r.dominant_property_type} />
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div style={{ height: 240 }}>
              <p className="text-xs font-semibold text-slate-500 mb-1">Tax lots</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 4, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="metric" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} width={56} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => formatNumber(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={leftZip} fill={CATEGORICAL.blue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={rightZip} fill={CATEGORICAL.orange} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ height: 240 }}>
              <p className="text-xs font-semibold text-slate-500 mb-1">Total market value</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={valueChartData} margin={{ top: 10, right: 10, left: 4, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="metric" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatUSD(v, 1)} width={56} />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => formatUSDFull(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={leftZip} fill={CATEGORICAL.blue} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={rightZip} fill={CATEGORICAL.orange} radius={[4, 4, 0, 0]} />
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
