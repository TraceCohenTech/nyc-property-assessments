"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import type { ConcentrationPoint } from "@/lib/types";

/**
 * Full-size Lorenz-style concentration curve: x = cumulative % of tax lots (sorted by value,
 * largest first), y = cumulative % of total market value they hold. A perfectly even
 * distribution would trace the diagonal; NYC's actual curve bows sharply above it because a
 * small share of lots (large commercial/institutional parcels) hold most of the value.
 */
export function ConcentrationCurveChart({ curve }: { curve: ConcentrationPoint[] }) {
  const data = curve.map((p) => ({ x: Math.round(p.pct_lots * 1000) / 10, y: Math.round(p.pct_value * 1000) / 10 }));
  return (
    <div
      role="img"
      aria-label="Lorenz curve showing that a small percentage of NYC's highest-value tax lots account for the majority of total property market value, far above the diagonal line of perfectly even distribution"
      className="h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 4, bottom: 24 }}>
          <defs>
            <linearGradient id="lorenzGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CATEGORICAL.blue} stopOpacity={0.45} />
              <stop offset="100%" stopColor={CATEGORICAL.blue} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="x" tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} label={{ value: "% of tax lots (largest value first)", position: "insideBottom", offset: -18, fontSize: 12, fill: "#475569" }} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} width={44} label={{ value: "% of total value", angle: -90, position: "insideLeft", fontSize: 12, fill: "#475569" }} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [`${v}% of total value`, undefined]}
            labelFormatter={(l: unknown) => `Top ${l}% of lots`}
          />
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{ value: "Perfectly even distribution", position: "insideTopLeft", fontSize: 10, fill: "#94a3b8" }}
          />
          <Area type="monotone" dataKey="y" stroke={CATEGORICAL.blue} strokeWidth={2.5} fill="url(#lorenzGrad)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
