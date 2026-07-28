"use client";

import { useState } from "react";
import { PercentileBandChart } from "@/components/analytics-a/PriceSqftCharts";

type PercentileRow = { property_type: string; borough: string; n: number; p10: number; p25: number; median: number; p75: number; p90: number };

const FEATURED_TYPES = ["one-family", "two-family", "condo", "coop", "small multifamily", "walk-up apt", "elevator apt", "retail", "office", "mixed-use residential"];

export function PropertyTypeTabs({ rows }: { rows: PercentileRow[] }) {
  const available = FEATURED_TYPES.filter((t) => rows.some((r) => r.property_type === t));
  const [active, setActive] = useState(available[0] ?? rows[0]?.property_type ?? "one-family");

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Select a property type">
        {available.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active === t}
            onClick={() => setActive(t)}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold capitalize active:scale-[0.97] ${
              active === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ height: 360 }}>
        <PercentileBandChart rows={rows} propertyType={active} />
      </div>
    </div>
  );
}
