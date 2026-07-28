"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber } from "@/lib/format";

const AGE_ORDER = ["Pre-1900", "1900-1929", "1930-1949", "1950-1973", "1974+", "Unknown"];

function GenericCountBarChart({
  data,
  dataKey,
  countKey = "count",
  ariaLabel,
  colorIndexed = true,
  angled = true,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  countKey?: string;
  ariaLabel: string;
  colorIndexed?: boolean;
  angled?: boolean;
}) {
  return (
    <div role="img" aria-label={ariaLabel} className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: angled ? 34 : 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey={dataKey}
            tick={{ ...AXIS_TICK, fontSize: 11 }}
            angle={angled ? -25 : 0}
            textAnchor={angled ? "end" : "middle"}
            interval={0}
            height={angled ? 50 : 30}
          />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} width={52} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(Number(v)), "Confirmed buildings"]} />
          <Bar dataKey={countKey} radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={String(d[dataKey])} fill={colorIndexed ? CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length] : CATEGORICAL.blue} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConfirmedByBoroughChart({ rows }: { rows: { borough: string; count: number }[] }) {
  return (
    <GenericCountBarChart
      data={rows}
      dataKey="borough"
      ariaLabel="Bar chart of HCR-confirmed rent-stabilized buildings by borough"
      angled={false}
    />
  );
}

export function ConfirmedByAgeChart({ rows }: { rows: { band: string; count: number }[] }) {
  const sorted = [...rows].sort((a, b) => AGE_ORDER.indexOf(a.band) - AGE_ORDER.indexOf(b.band));
  return (
    <GenericCountBarChart
      data={sorted}
      dataKey="band"
      ariaLabel="Bar chart of HCR-confirmed rent-stabilized buildings by construction era"
      colorIndexed={false}
      angled={false}
    />
  );
}

export function ConfirmedByUnitBandChart({ rows }: { rows: { band: string; count: number }[] }) {
  return (
    <GenericCountBarChart
      data={rows}
      dataKey="band"
      ariaLabel="Bar chart of HCR-confirmed rent-stabilized buildings by residential unit count band"
      angled={false}
    />
  );
}

export function ConfirmedByOwnerTypeChart({ rows }: { rows: { type: string; count: number }[] }) {
  const sorted = [...rows].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  return (
    <div
      role="img"
      aria-label="Horizontal bar chart of HCR-confirmed rent-stabilized buildings by owner entity type"
      className="h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} />
          <YAxis type="category" dataKey="type" tick={{ ...AXIS_TICK, fontSize: 11 }} width={130} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(Number(v)), "Confirmed buildings"]} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {sorted.map((d, i) => (
              <Cell key={d.type} fill={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
