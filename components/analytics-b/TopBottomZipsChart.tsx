"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatUSD, formatUSDFull } from "@/lib/format";
import type { ZipRow } from "@/components/analytics-b/ZipLeagueTable";

export function TopBottomZipsChart({ zips, direction, metricLabel }: { zips: ZipRow[]; direction: "top" | "bottom"; metricLabel: string }) {
  const sorted = [...zips].sort((a, b) => b.median_market_value - a.median_market_value);
  const slice = direction === "top" ? sorted.slice(0, 10) : sorted.slice(-10).reverse();
  const data = slice.map((z) => ({ zip: `${z.zip}`, borough: z.borough, value: z.median_market_value }));

  return (
    <div
      role="img"
      aria-label={`Bar chart of the ${direction} 10 NYC ZIP codes by ${metricLabel.toLowerCase()}`}
      style={{ height: 300 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatUSD(v, 1)} />
          <YAxis type="category" dataKey="zip" tick={{ ...AXIS_TICK, fontSize: 11 }} width={48} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown, _name: unknown, item: unknown) => {
              const p = (item as { payload?: { borough?: string } })?.payload;
              return [formatUSDFull(Number(v)), p?.borough ?? metricLabel];
            }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={800}>
            {data.map((d, i) => (
              <Cell key={d.zip} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
