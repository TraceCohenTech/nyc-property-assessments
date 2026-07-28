"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import type { TreemapNode } from "recharts/types/chart/Treemap";

import { CATEGORICAL_ORDER, CHART_TOOLTIP_STYLE } from "@/lib/colors";
import { formatNumber, formatPct, formatUSD, formatUSDFull } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";

export type TreemapLeaf = {
  name: string;
  lots: number;
  market_value: number;
  children?: TreemapLeaf[];
};

export type TreemapRoot = {
  name: string;
  lots: number;
  market_value: number;
  children: TreemapLeaf[];
};

type LevelRow = { name: string; market_value: number; lots: number; share: number; drillable: boolean };

function toLevelRows(nodes: TreemapLeaf[], total: number): LevelRow[] {
  return nodes
    .map((n) => ({
      name: n.name,
      market_value: n.market_value,
      lots: n.lots,
      share: total > 0 ? n.market_value / total : 0,
      drillable: !!n.children && n.children.length > 0,
    }))
    .sort((a, b) => b.market_value - a.market_value);
}

/** Custom SVG rect + label content for the Treemap — Recharts' default doesn't label cells. */
function CellContent(props: TreemapNode & { colorFor: (name: string, index: number) => string }) {
  const { x, y, width, height, name, depth, index, colorFor } = props;
  const value = (props as unknown as { market_value?: number }).market_value ?? props.value;
  if (width <= 0 || height <= 0) return null;
  const fill = depth === 1 ? colorFor(name, index) : "rgba(15, 23, 42, 0.85)";
  const showLabel = width > 56 && height > 30;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill,
          stroke: "#fff",
          strokeWidth: 2,
          cursor: "pointer",
        }}
      />
      {showLabel && (
        <text x={x + 6} y={y + 16} fontSize={12} fontWeight={700} fill="#fff" style={{ pointerEvents: "none" }}>
          {name.length > Math.floor(width / 7) ? name.slice(0, Math.max(3, Math.floor(width / 7) - 1)) + "…" : name}
        </text>
      )}
      {showLabel && height > 46 && (
        <text x={x + 6} y={y + 32} fontSize={11} fill="rgba(255,255,255,0.85)" style={{ pointerEvents: "none" }}>
          {formatUSD(value as number, 1)}
        </text>
      )}
    </g>
  );
}

export function TreemapClient({ root }: { root: TreemapRoot }) {
  const [borough, setBorough] = useState<string | null>(null);
  const [propertyType, setPropertyType] = useState<string | null>(null);

  const boroughNode = borough ? root.children.find((c) => c.name === borough) ?? null : null;
  const propertyTypeNode =
    boroughNode && propertyType ? boroughNode.children?.find((c) => c.name === propertyType) ?? null : null;

  const { currentNodes, currentTotal, levelLabel } = useMemo(() => {
    if (propertyTypeNode) {
      return {
        currentNodes: propertyTypeNode.children ?? [],
        currentTotal: propertyTypeNode.market_value,
        levelLabel: "Building class",
      };
    }
    if (boroughNode) {
      return { currentNodes: boroughNode.children ?? [], currentTotal: boroughNode.market_value, levelLabel: "Property type" };
    }
    return { currentNodes: root.children, currentTotal: root.market_value, levelLabel: "Borough" };
  }, [root, boroughNode, propertyTypeNode]);

  const rows = useMemo(() => toLevelRows(currentNodes, currentTotal), [currentNodes, currentTotal]);

  const chartData = currentNodes.map((n) => ({ ...n, size: n.market_value }));

  function colorFor(name: string) {
    if (!borough) {
      const i = root.children.findIndex((c) => c.name === name);
      return CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length];
    }
    const i = rows.findIndex((r) => r.name === name);
    return CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length];
  }

  function handleClick(node: TreemapNode) {
    if (!borough) {
      setBorough(node.name);
      setPropertyType(null);
    } else if (!propertyType) {
      const isDrillable = boroughNode?.children?.find((c) => c.name === node.name)?.children?.length;
      if (isDrillable) setPropertyType(node.name);
    }
    // Deepest level (building class) — no further drill, table row link handles navigation.
  }

  const columns: DataTableColumn<LevelRow>[] = [
    {
      key: "name",
      label: levelLabel,
      sortable: true,
      render: (r) =>
        r.drillable ? (
          <button
            type="button"
            onClick={() => {
              if (!borough) {
                setBorough(r.name);
                setPropertyType(null);
              } else if (!propertyType) {
                setPropertyType(r.name);
              }
            }}
            className="font-semibold text-blue-700 hover:underline text-left"
          >
            {r.name}
          </button>
        ) : (
          <span className="font-medium text-slate-900">{r.name}</span>
        ),
      sortValue: (r) => r.name,
    },
    { key: "market_value", label: "Market value", align: "right", sortable: true, render: (r) => formatUSDFull(r.market_value), sortValue: (r) => r.market_value },
    { key: "share", label: "Share", align: "right", sortable: true, render: (r) => formatPct(r.share, 1), sortValue: (r) => r.share },
    { key: "lots", label: "Lots", align: "right", sortable: true, render: (r) => formatNumber(r.lots), sortValue: (r) => r.lots },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => {
            setBorough(null);
            setPropertyType(null);
          }}
          className={`inline-flex items-center gap-1 min-h-[32px] px-2 rounded-md font-semibold ${!borough ? "text-slate-900" : "text-blue-700 hover:underline"}`}
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          NYC
        </button>
        {borough && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setPropertyType(null)}
              className={`min-h-[32px] px-2 rounded-md font-semibold ${!propertyType ? "text-slate-900" : "text-blue-700 hover:underline"}`}
            >
              {borough}
            </button>
          </>
        )}
        {propertyType && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span className="min-h-[32px] px-2 flex items-center font-semibold text-slate-900 capitalize">{propertyType}</span>
          </>
        )}
      </div>

      {/* Treemap — hidden on mobile, table below is primary there */}
      <div
        className="hidden sm:block rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-card mb-6"
        role="img"
        aria-label={`Treemap of NYC property market value broken down by ${levelLabel.toLowerCase()}, tile area proportional to total value, currently showing ${borough ? `${borough}${propertyType ? " > " + propertyType : ""}` : "all five boroughs"}`}
      >
        <div style={{ height: 440 }}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={chartData}
              dataKey="size"
              nameKey="name"
              aspectRatio={4 / 3}
              stroke="#fff"
              isAnimationActive
              animationDuration={500}
              onClick={handleClick}
              content={(props) => <CellContent {...(props as TreemapNode)} colorFor={colorFor} />}
            >
              <Tooltip
                {...CHART_TOOLTIP_STYLE}
                formatter={(_value: unknown, _name: unknown, item: unknown) => {
                  const p = (item as { payload?: { market_value?: number; lots?: number } })?.payload;
                  return [p ? `${formatUSDFull(p.market_value ?? 0)} · ${formatNumber(p.lots ?? 0)} lots` : "", "Value"];
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {borough ? "Click a tile to drill further, or use the breadcrumb above to zoom out." : "Click a borough to drill into its property types."}
        </p>
      </div>

      {/* Companion table — primary view on mobile */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="font-bold text-slate-900">
            {levelLabel} breakdown{borough ? ` — ${borough}${propertyType ? ` / ${propertyType}` : ""}` : ""}
          </h3>
          <ExportButton
            rows={rows.map((r) => ({ [levelLabel]: r.name, market_value: r.market_value, share: r.share, lots: r.lots }))}
            filename={`nyc-treemap-${(borough ?? "nyc").toLowerCase()}${propertyType ? `-${propertyType}` : ""}.csv`}
          />
        </div>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.name} initialSortKey="market_value" />
      </div>
    </div>
  );
}
