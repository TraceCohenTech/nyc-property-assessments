"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExternalLink } from "lucide-react";

import { AXIS_TICK, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatUSD, formatUSDFull } from "@/lib/format";
import { decadeToYearRange } from "@/components/analytics-b/decadeRange";

export type DecadeBorough = { borough: string; lots: number; market_value: number };
export type DecadeRow = {
  decade: string;
  lots: number;
  residential_units: number;
  total_market_value: number;
  by_borough: DecadeBorough[];
  dominant_property_type: { property_type: string; lots: number };
};

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const BOROUGH_COLOR: Record<string, string> = {
  Manhattan: CATEGORICAL_ORDER[0],
  Brooklyn: CATEGORICAL_ORDER[1],
  Queens: CATEGORICAL_ORDER[2],
  Bronx: CATEGORICAL_ORDER[3],
  "Staten Island": CATEGORICAL_ORDER[4],
};

type Metric = "lots" | "market_value" | "residential_units";

const METRIC_LABEL: Record<Metric, string> = {
  lots: "Lots built",
  market_value: "Market value (current)",
  residential_units: "Residential units",
};

export function TimelineClient({ decades }: { decades: DecadeRow[] }) {
  const [metric, setMetric] = useState<Metric>("lots");

  const chartData = useMemo(
    () =>
      decades.map((d) => {
        const row: Record<string, number | string> = { decade: d.decade };
        if (metric === "residential_units") {
          row.residential_units = d.residential_units;
        } else {
          for (const b of d.by_borough) {
            row[b.borough] = metric === "lots" ? b.lots : b.market_value;
          }
          for (const b of BOROUGHS) if (!(b in row)) row[b] = 0;
        }
        return row;
      }),
    [decades, metric]
  );

  const tickFormatter = metric === "market_value" ? (v: number) => formatUSD(v, 1) : (v: number) => formatNumber(v);
  const tooltipFormatter = metric === "market_value" ? formatUSDFull : formatNumber;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">Metric</span>
        {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold border active:scale-[0.97] ${
              metric === m ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
            }`}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>

      <div
        role="img"
        aria-label={`Stacked bar chart of NYC ${METRIC_LABEL[metric].toLowerCase()} by construction decade${metric !== "residential_units" ? ", stacked by borough" : ""}, from pre-1900 through the 2020s, with the 1920s the tallest bar`}
        style={{ height: 380 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="decade" tick={{ ...AXIS_TICK, fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={56} />
            <YAxis tick={AXIS_TICK} tickFormatter={tickFormatter} width={56} />
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown, name: unknown) => [tooltipFormatter(Number(v)), String(name)]} />
            {metric !== "residential_units" && <Legend wrapperStyle={{ fontSize: 11, color: "#475569" }} />}
            {metric === "residential_units" ? (
              <Bar dataKey="residential_units" name="Residential units" fill={CATEGORICAL_ORDER[0]} radius={[4, 4, 0, 0]} animationDuration={800} />
            ) : (
              BOROUGHS.map((b) => (
                <Bar key={b} dataKey={b} name={b} stackId="stack" fill={BOROUGH_COLOR[b]} animationDuration={800} />
              ))
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {metric === "residential_units" && (
        <p className="text-xs text-slate-500 mt-2">Per-borough breakdown isn&apos;t available for residential units — this series is citywide only.</p>
      )}

      {/* Dominant property type strip */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Dominant property type, by decade</h3>
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
          {decades
            .filter((d) => d.decade !== "Unknown")
            .map((d, i) => {
              const range = decadeToYearRange(d.decade);
              const content = (
                <div className="min-w-[92px] rounded-lg border border-slate-200 p-2 text-center shrink-0 hover:border-blue-400 transition-colors">
                  <div className="text-[10px] font-semibold text-slate-500">{d.decade}</div>
                  <div
                    className="mt-1 h-1.5 rounded-full"
                    style={{ background: CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length] }}
                    aria-hidden="true"
                  />
                  <div className="mt-1 text-[11px] font-semibold text-slate-800 capitalize">{d.dominant_property_type.property_type}</div>
                </div>
              );
              return range ? (
                <Link key={d.decade} href={`/explorer?year_built_min=${range.min}&year_built_max=${range.max}`}>
                  {content}
                </Link>
              ) : (
                <div key={d.decade}>{content}</div>
              );
            })}
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
        <ExternalLink className="h-3 w-3" aria-hidden="true" /> Click any decade tile to open it in the Property Explorer.
      </div>
    </div>
  );
}
