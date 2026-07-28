"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Area,
  AreaChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, CATEGORICAL, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatUSD, formatUSDFull, formatNumber } from "@/lib/format";

type TaxClassRow = {
  tax_class: string;
  count: number;
  total_market_value: number;
  total_assessed_value: number;
  assessment_ratio: number;
  mean_market_value: number;
};

const TAX_CLASS_LABEL: Record<string, string> = {
  "1": "Class 1 — 1-3 family homes",
  "2": "Class 2 — Rentals & co-ops/condos",
  "3": "Class 3 — Utility",
  "4": "Class 4 — Commercial",
};

export function TaxEquityChart({ taxClasses }: { taxClasses: TaxClassRow[] }) {
  const data = taxClasses.map((t) => ({
    name: `Class ${t.tax_class}`,
    fullName: TAX_CLASS_LABEL[t.tax_class] ?? `Class ${t.tax_class}`,
    market: t.total_market_value,
    assessed: t.total_assessed_value,
    ratio: t.assessment_ratio,
  }));

  return (
    <div role="img" className="h-full" aria-label="Grouped bar chart comparing total market value to total assessed value for each of the four NYC property tax classes, showing Class 1 homes assessed at a far smaller share of market value than Classes 2 through 4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="name" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatUSD(v, 1)} width={56} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [
              formatUSDFull(Number(value)),
              name === "market" ? "Total market value" : "Total assessed value",
            ]}
            labelFormatter={(label: unknown, payload: unknown) => {
              const p = payload as Array<{ payload?: { fullName?: string } }> | undefined;
              return p?.[0]?.payload?.fullName ?? String(label ?? "");
            }}
          />
          <Legend
            formatter={(value: string) => (value === "market" ? "Total market value" : "Total assessed value")}
            wrapperStyle={{ fontSize: 12, color: "#475569" }}
          />
          <Bar dataKey="market" name="market" fill={CATEGORICAL.blue} radius={[6, 6, 0, 0]} animationDuration={900} />
          <Bar dataKey="assessed" name="assessed" fill={CATEGORICAL.orange} radius={[6, 6, 0, 0]} animationDuration={900} animationBegin={150} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type BoroughRow = {
  borough: string;
  count: number;
  total_market_value: number;
  total_assessed_value: number;
  assessment_ratio: number;
};

const BOROUGH_COLORS = [CATEGORICAL.blue, CATEGORICAL.orange, CATEGORICAL.aqua, CATEGORICAL.yellow, CATEGORICAL.green];

export function BoroughValueChart({ boroughs }: { boroughs: BoroughRow[] }) {
  const data = [...boroughs].sort((a, b) => b.total_market_value - a.total_market_value);
  return (
    <div role="img" className="h-full" aria-label="Bar chart of total property market value by NYC borough, one bar per borough in a distinct color, Manhattan highest">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="borough" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatUSD(v, 1)} width={56} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatUSDFull(Number(v)), "Total market value"]}
          />
          <Bar dataKey="total_market_value" radius={[6, 6, 0, 0]} animationDuration={900}>
            {data.map((d, i) => (
              <Cell key={d.borough} fill={BOROUGH_COLORS[i % BOROUGH_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type BuildingClassRow = { building_class: string; count: number; total_assessed_value: number };

export function BuildingClassChart({ classes }: { classes: BuildingClassRow[] }) {
  return (
    <div role="img" className="h-full" aria-label="Horizontal-style bar chart ranking the top NYC building classes by property count, each bar a distinct color">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={classes} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} />
          <YAxis type="category" dataKey="building_class" tick={{ ...AXIS_TICK, fontSize: 11 }} width={40} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatNumber(Number(v)), "Properties"]}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} animationDuration={900}>
            {classes.map((c, i) => (
              <Cell key={c.building_class} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type OwnerRow = { owner: string; property_count: number; total_assessed_value: number };

export function TopOwnersChart({ owners }: { owners: OwnerRow[] }) {
  return (
    <div role="img" className="h-full" aria-label="Horizontal-style bar chart ranking the largest private property owners in NYC by total assessed value, each bar a distinct color">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={owners} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatUSD(v, 1)} />
          <YAxis
            type="category"
            dataKey="owner"
            tick={{ ...AXIS_TICK, fontSize: 10 }}
            width={140}
            tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v)}
          />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatUSDFull(Number(v)), "Total assessed value"]}
          />
          <Bar dataKey="total_assessed_value" radius={[0, 6, 6, 0]} animationDuration={900}>
            {owners.map((o, i) => (
              <Cell key={o.owner} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type AgeRow = { bucket: string; count: number; total_assessed_value: number };

export function AgeDistributionChart({ buckets }: { buckets: AgeRow[] }) {
  return (
    <div role="img" className="h-full" aria-label="Area chart of NYC property counts by decade built, from pre-1900 through the 2020s, showing construction booms in the 1920s and 2000s">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={buckets} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="ageGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CATEGORICAL.aqua} stopOpacity={0.55} />
              <stop offset="100%" stopColor={CATEGORICAL.aqua} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="bucket" tick={{ ...AXIS_TICK, fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={60} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} width={48} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatNumber(Number(v)), "Properties"]}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={CATEGORICAL.aqua}
            strokeWidth={3}
            fill="url(#ageGrad)"
            dot={{ r: 3, fill: CATEGORICAL.aqua }}
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
