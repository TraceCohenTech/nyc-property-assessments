"use client";

import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORICAL, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE } from "@/lib/colors";
import { formatUSD, formatUSDFull, formatPct, formatNumber } from "@/lib/format";
import type { ValueBand, ConcentrationPoint, OwnershipByType, UnitSizeBand, ResidentialUnitsByBorough } from "@/lib/types";

/** Small sparkline-style bar chart of value-band lot counts, for use inside an InsightCard. */
export function ValueBandsMiniChart({ bands }: { bands: ValueBand[] }) {
  return (
    <div role="img" aria-label="Bar chart of NYC tax lots grouped into market-value bands, showing which value range holds the most properties" className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bands} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="band" hide />
          <YAxis hide />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatNumber(Number(v)), "Lots"]}
            labelFormatter={(l: unknown) => String(l)}
          />
          <Bar dataKey="lots" radius={[4, 4, 0, 0]}>
            {bands.map((b, i) => (
              <Cell key={b.band} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Concentration / Lorenz-style curve: % of lots (x) vs. % of total market value (y). */
export function ConcentrationMiniChart({ curve }: { curve: ConcentrationPoint[] }) {
  const data = curve.map((p) => ({ x: Math.round(p.pct_lots * 100), y: Math.round(p.pct_value * 100) }));
  return (
    <div role="img" aria-label="Area chart showing value concentration: the share of total NYC property market value held by the top share of tax lots" className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="concGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CATEGORICAL.blue} stopOpacity={0.5} />
              <stop offset="100%" stopColor={CATEGORICAL.blue} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis dataKey="x" hide />
          <YAxis hide />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown, _n: unknown, item: unknown) => {
              const payload = (item as { payload?: { x?: number } })?.payload;
              return [`${v}% of value`, `Top ${payload?.x ?? "?"}% of lots`];
            }}
          />
          <Area type="monotone" dataKey="y" stroke={CATEGORICAL.blue} strokeWidth={2.5} fill="url(#concGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const OWNER_TYPE_COLORS = [CATEGORICAL.blue, CATEGORICAL.orange, CATEGORICAL.aqua, CATEGORICAL.yellow, CATEGORICAL.green, CATEGORICAL.red];

export function OwnershipMiniChart({ byType }: { byType: OwnershipByType[] }) {
  const data = byType.filter((t) => !t.type.toLowerCase().includes("individual"));
  return (
    <div role="img" aria-label="Bar chart of total assessed property value by owner entity type — LLC, corporation, trust, government, and nonprofit" className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="type" hide />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatUSDFull(Number(v)), "Total value"]}
            labelFormatter={(l: unknown) => String(l)}
          />
          <Bar dataKey="total_value" radius={[0, 4, 4, 0]}>
            {data.map((t, i) => (
              <Cell key={t.type} fill={OWNER_TYPE_COLORS[i % OWNER_TYPE_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HousingBandsMiniChart({ bands }: { bands: UnitSizeBand[] }) {
  return (
    <div role="img" aria-label="Bar chart of residential units grouped by building size band, from 1-3 unit buildings to 100+ unit buildings" className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bands} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="band" hide />
          <YAxis hide />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatNumber(Number(v)), "Units"]}
            labelFormatter={(l: unknown) => String(l)}
          />
          <Bar dataKey="units" radius={[4, 4, 0, 0]}>
            {bands.map((b, i) => (
              <Cell key={b.band} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ResidentialUnitsByBoroughMiniChart({ rows }: { rows: ResidentialUnitsByBorough[] }) {
  return (
    <div role="img" aria-label="Bar chart of residential housing units by NYC borough" className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis dataKey="borough" hide />
          <YAxis hide />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatNumber(Number(v)), "Units"]}
            labelFormatter={(l: unknown) => String(l)}
          />
          <Bar dataKey="units" radius={[4, 4, 0, 0]}>
            {rows.map((r, i) => (
              <Cell key={r.borough} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export { formatUSD, formatPct };
