"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatUSDAuto } from "@/lib/format";

export type StorySeriesPoint = { label: string; value: number };
export type StoryFormatKind = "pct" | "usdAuto" | "num" | "acres";

// A function prop can't cross the server -> client boundary (React can't serialize it), and
// buildConfig() in app/story/page.tsx is server-side, so this takes a formatter *kind* string
// instead of a formatter function and resolves the actual function in here, client-side.
const FORMATTERS: Record<StoryFormatKind, (v: number) => string> = {
  pct: (v) => `${v}%`,
  usdAuto: (v) => formatUSDAuto(v),
  num: (v) => formatNumber(v),
  acres: (v) => `${(v / 43560).toFixed(0)} ac`,
};

/**
 * Small supporting bar chart for a /story finding. Every bar gets a distinct color from the
 * shared categorical palette (never a single-color-with-one-highlight scheme — see the
 * "kill monochrome-highlight anti-pattern" design note) so this reads consistently with every
 * other ranked bar chart on the site.
 */
export function StoryChart({
  series,
  formatKind,
  ariaLabel,
  horizontal = false,
}: {
  series: StorySeriesPoint[];
  formatKind: StoryFormatKind;
  ariaLabel: string;
  horizontal?: boolean;
}) {
  if (series.length === 0) return null;
  const valueFormatter = FORMATTERS[formatKind];

  if (horizontal) {
    return (
      <div role="img" aria-label={ariaLabel} className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} tickFormatter={valueFormatter} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ ...AXIS_TICK, fontSize: 10 }}
              width={110}
              tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)}
            />
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => valueFormatter(Number(v))} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} animationDuration={800}>
              {series.map((s, i) => (
                <Cell key={s.label} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div role="img" aria-label={ariaLabel} className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="label" tick={{ ...AXIS_TICK, fontSize: 11 }} interval={0} angle={series.length > 6 ? -35 : 0} textAnchor={series.length > 6 ? "end" : "middle"} height={series.length > 6 ? 56 : 30} />
          <YAxis tick={AXIS_TICK} tickFormatter={valueFormatter} width={56} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => valueFormatter(Number(v))} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>
            {series.map((s, i) => (
              <Cell key={s.label} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
