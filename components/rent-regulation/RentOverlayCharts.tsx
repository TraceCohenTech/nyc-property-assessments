"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatPct } from "@/lib/format";

const BOROUGH_ORDER = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];

type BoroughStabRow = { borough: string; structural_candidates: number; hcr_registered: number; stabilized_share: number };

/** Stabilized share of pre-1974 6+ unit structural-candidate stock, by borough. */
export function StabilizedShareByBoroughChart({ rows }: { rows: BoroughStabRow[] }) {
  const data = [...rows]
    .sort((a, b) => BOROUGH_ORDER.indexOf(a.borough) - BOROUGH_ORDER.indexOf(b.borough))
    .map((r) => ({ borough: r.borough, pct: Math.round(r.stabilized_share * 1000) / 10, candidates: r.structural_candidates, registered: r.hcr_registered }));

  return (
    <div
      role="img"
      className="h-full"
      aria-label="Bar chart of the HCR-registered stabilized share of pre-1974, 6-plus-unit structural-candidate buildings, by borough"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="borough" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}%`} width={44} domain={[0, 100]} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown, _n: unknown, item: unknown) => {
              const p = item as { payload?: (typeof data)[number] };
              const d = p?.payload;
              return [`${v}% (${d ? formatNumber(d.registered) : ""} of ${d ? formatNumber(d.candidates) : ""} candidates)`, "Stabilized share"];
            }}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={d.borough} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type DecadeAbatementRow = { decade: string; hcr_buildings: number; count_421a: number; count_j51: number };

const DECADE_ORDER = ["<1900", "1900s", "1910s", "1920s", "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s", "Unknown"];

/** 421-a vs. J-51 abatement counts among HCR-registered buildings, by construction decade. */
export function AbatementsByDecadeChart({ rows }: { rows: DecadeAbatementRow[] }) {
  const data = [...rows]
    .filter((r) => r.count_421a > 0 || r.count_j51 > 0)
    .sort((a, b) => DECADE_ORDER.indexOf(a.decade) - DECADE_ORDER.indexOf(b.decade))
    .map((r) => ({ decade: r.decade, "421-a": r.count_421a, "J-51": r.count_j51 }));

  return (
    <div
      role="img"
      className="h-full"
      aria-label="Grouped bar chart of 421-a versus J-51 tax abatement counts among HCR-registered rent-stabilized buildings, by construction decade"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 30 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="decade" tick={{ ...AXIS_TICK, fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={50} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} width={48} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown, name: unknown) => [formatNumber(Number(v)), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#475569" }} />
          <Bar dataKey="421-a" fill={CATEGORICAL.blue} radius={[4, 4, 0, 0]} />
          <Bar dataKey="J-51" fill={CATEGORICAL.orange} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type OwnerTypeStockRow = { owner_entity_type: string; hcr_registered_buildings: number };

/** Stabilized stock by owner entity type (a classification, never an individual's name). */
export function StabilizedStockByOwnerTypeChart({ rows }: { rows: OwnerTypeStockRow[] }) {
  const data = [...rows].filter((r) => r.hcr_registered_buildings > 0).sort((a, b) => b.hcr_registered_buildings - a.hcr_registered_buildings);
  return (
    <div
      role="img"
      className="h-full"
      aria-label="Horizontal bar chart of HCR-registered rent-stabilized building counts by owner entity type"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} />
          <YAxis type="category" dataKey="owner_entity_type" tick={{ ...AXIS_TICK, fontSize: 11 }} width={140} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(Number(v)), "Stabilized buildings"]} />
          <Bar dataKey="hcr_registered_buildings" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={d.owner_entity_type} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function pctFmt(v: number) {
  return formatPct(v, 1);
}
