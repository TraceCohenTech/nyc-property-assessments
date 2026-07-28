"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatPct } from "@/lib/format";

export function TopNChart({ breakdown }: { breakdown: { n: number; total_value: number; share: number }[] }) {
  const data = breakdown.map((b) => ({ label: `Top ${formatNumber(b.n)}`, share: Math.round(b.share * 1000) / 10 }));
  return (
    <div
      role="img"
      aria-label="Bar chart showing what share of total NYC property market value is held by the top 100, 1,000, 10,000, and 50,000 highest-value tax lots"
      className="h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} width={44} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}%`, "Share of total value"]} />
          <Bar dataKey="share" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={d.label} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function formatPctLabel(v: number) {
  return formatPct(v, 1);
}
