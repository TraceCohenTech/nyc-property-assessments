"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE, GRID_STROKE } from "@/lib/colors";
import { formatNumber, formatUSD, formatUSDFull } from "@/lib/format";
import { entityTypeColor } from "./entityTypeColors";
import type { OwnershipByType } from "@/lib/types";

type Named = { lots: number };

function GenericLotsBarChart({
  data,
  dataKey,
  label,
  colorIndexed = true,
}: {
  data: (Named & Record<string, string | number>)[];
  dataKey: string;
  label: string;
  colorIndexed?: boolean;
}) {
  return (
    <div role="img" aria-label={`Bar chart of ${label} by lot count`} className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey={dataKey} tick={{ ...AXIS_TICK, fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={50} />
          <YAxis tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} width={44} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: unknown) => [formatNumber(Number(v)), "Lots"]} />
          <Bar dataKey="lots" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={String(d[dataKey])} fill={colorIndexed ? CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length] : CATEGORICAL_ORDER[0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BoroughDistChart({ rows }: { rows: { borough: string; lots: number; total_market_value: number }[] }) {
  return <GenericLotsBarChart data={rows} dataKey="borough" label="properties by borough" />;
}

export function PropertyTypeDistChart({ rows }: { rows: { property_type: string; lots: number }[] }) {
  return <GenericLotsBarChart data={rows.slice(0, 10)} dataKey="property_type" label="properties by property type" />;
}

export function TaxClassDistChart({ rows }: { rows: { tax_class: string; lots: number }[] }) {
  return <GenericLotsBarChart data={rows} dataKey="tax_class" label="properties by tax class" />;
}

export function ValueBandDistChart({ rows }: { rows: { band: string; lots: number }[] }) {
  return <GenericLotsBarChart data={rows} dataKey="band" label="properties by value band" />;
}

export function YearBuiltDistChart({ rows }: { rows: { bucket: string; lots: number }[] }) {
  const order = ["Pre-1900", "1900-1929", "1930-1944", "1945-1960", "1961-1973", "1974-1999", "2000+", "Unknown"];
  const sorted = [...rows].sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket));
  return <GenericLotsBarChart data={sorted} dataKey="bucket" label="properties by construction era" colorIndexed={false} />;
}

/** Entity-type overview for the Owners directory: total value held by each owner entity type,
 * INCLUDING Individual as a muted, non-clickable aggregate slice (privacy rule: individuals are
 * never ranked/named, but the aggregate total is public information and belongs on this chart). */
export function EntityTypeOverviewChart({ byType }: { byType: OwnershipByType[] }) {
  const data = [...byType].sort((a, b) => b.total_value - a.total_value);
  return (
    <div
      role="img"
      aria-label="Bar chart of total NYC property market value by owner entity type — LLC, corporation, government, individual, and others"
      className="h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => formatUSD(v, 1)} />
          <YAxis type="category" dataKey="type" tick={{ ...AXIS_TICK, fontSize: 11 }} width={140} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(v: unknown, _n: unknown, item: unknown) => {
              const payload = (item as { payload?: OwnershipByType })?.payload;
              return [`${formatUSDFull(Number(v))} · ${formatNumber(payload?.lots ?? 0)} lots`, "Total value"];
            }}
          />
          <Bar dataKey="total_value" radius={[0, 4, 4, 0]}>
            {data.map((t) => (
              <Cell key={t.type} fill={entityTypeColor(t.type)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
