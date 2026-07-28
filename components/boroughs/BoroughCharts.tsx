"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatUSD, formatUSDFull } from "@/lib/format";
import { entityTypeColor } from "@/components/owners/entityTypeColors";
import type { BoroughProfile } from "@/lib/types";

function CountBarChart({
  data,
  dataKey,
  colorIndexed = true,
}: {
  data: { lots?: number; count?: number; [k: string]: unknown }[];
  dataKey: string;
  colorIndexed?: boolean;
}) {
  const valueKey = data[0] && "count" in data[0] ? "count" : "lots";
  return (
    <div role="img" aria-label={`Bar chart by ${dataKey}`} className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey={dataKey} tick={{ ...AXIS_TICK, fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={54} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} width={48} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(Number(v)), "Lots"]} />
          <Bar dataKey={valueKey} radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={String(d[dataKey])} fill={colorIndexed ? CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length] : CATEGORICAL_ORDER[0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TaxClassDistChart({ rows }: { rows: BoroughProfile["tax_class_distribution"] }) {
  const sorted = [...rows].sort((a, b) => a.tax_class.localeCompare(b.tax_class));
  return <CountBarChart data={sorted} dataKey="tax_class" />;
}

export function PropertyTypeDistChart({ rows }: { rows: BoroughProfile["property_type_distribution"] }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count).slice(0, 10);
  return <CountBarChart data={sorted} dataKey="property_type" />;
}

export function ValueBandDistChart({ rows }: { rows: BoroughProfile["value_band_distribution"] }) {
  const order = ["<$500K", "$500K–1M", "$1M–2M", "$2M–5M", "$5M–10M", "$10M–20M", "$20M–50M", "$50M+"];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.band) - order.indexOf(b.band));
  return <CountBarChart data={sorted} dataKey="band" colorIndexed={false} />;
}

export function EntityMixChart({ rows }: { rows: BoroughProfile["entity_mix"] }) {
  const sorted = [...rows].sort((a, b) => b.total_value - a.total_value);
  return (
    <div role="img" aria-label="Bar chart of total property value by owner entity type in this borough" className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatUSD(v, 1)} />
          <YAxis type="category" dataKey="type" tick={{ ...AXIS_TICK, fontSize: 11 }} width={140} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown) => [formatUSDFull(Number(v)), "Total value"]}
            labelFormatter={(l: unknown) => String(l)}
          />
          <Bar dataKey="total_value" radius={[0, 4, 4, 0]}>
            {sorted.map((t) => (
              <Cell key={t.type} fill={entityTypeColor(t.type)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
