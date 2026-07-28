"use client";

import { useState } from "react";
import { formatUSDFull, formatNumber } from "@/lib/format";

type OwnerRow = { owner: string; property_count: number; total_assessed_value: number; total_market_value: number };

export function OwnersTable({ owners }: { owners: OwnerRow[] }) {
  const [limit, setLimit] = useState(25);
  const visible = owners.slice(0, limit);

  return (
    <div>
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-3">Rank</th>
              <th className="py-2 pr-3">Owner</th>
              <th className="py-2 pr-3 text-right">Properties</th>
              <th className="py-2 pr-3 text-right">Total assessed value</th>
              <th className="py-2 pr-3 text-right">Total market value</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o, i) => (
              <tr key={o.owner} className="border-b border-slate-100 hover:bg-orange-50/30">
                <td className="py-2 pr-3 text-slate-500 tabular-nums">{i + 1}</td>
                <td className="py-2 pr-3 font-semibold text-slate-900">{o.owner}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatNumber(o.property_count)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-900 font-semibold">{formatUSDFull(o.total_assessed_value)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{formatUSDFull(o.total_market_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit < owners.length && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + 25)}
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-md text-sm font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 active:scale-[0.97]"
          >
            Show 25 more owners ({owners.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
