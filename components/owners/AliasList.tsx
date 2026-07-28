"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatNumber } from "@/lib/format";
import type { OwnerAlias } from "@/lib/types";

/** Collapsible list of the raw DOF filing spellings that were merged into this owner group. */
export function AliasList({ aliases }: { aliases: OwnerAlias[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 max-w-3xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 min-h-[32px] text-xs font-semibold text-blue-700 hover:text-blue-800"
        aria-expanded={open}
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
        {open ? "Hide" : "Show"} {aliases.length} known filing spellings
      </button>
      {open && (
        <ul className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs text-slate-600 max-h-64 overflow-y-auto">
          {aliases.map((a) => (
            <li key={a.raw} className="flex items-baseline justify-between gap-3">
              <span>{a.raw}</span>
              <span className="tabular-nums text-slate-500 shrink-0">{formatNumber(a.lots)} lot{a.lots === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
