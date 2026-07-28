"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

export type FilterField = {
  key: string;
  label: string;
  type: "select" | "text" | "number";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

/**
 * Presentational filter shell — a later wave wires these fields to real query-param state
 * and live results. Renders controlled inputs if `values`/`onChange` are supplied, otherwise
 * renders disabled placeholders so the shell is honest about not being wired up yet.
 */
export function FilterPanel({
  fields,
  values,
  onChange,
  footer,
}: {
  fields: FilterField[];
  values?: Record<string, string>;
  onChange?: (key: string, value: string) => void;
  footer?: ReactNode;
}) {
  const wired = !!values && !!onChange;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal className="h-4 w-4 text-blue-600" aria-hidden="true" />
        <h3 className="font-bold text-slate-900 text-sm">Filters</h3>
        {!wired && (
          <span className="ml-auto text-[11px] font-medium text-slate-500 uppercase tracking-wider">Coming soon</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {fields.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label htmlFor={`filter-${f.key}`} className="text-xs font-semibold text-slate-500">
              {f.label}
            </label>
            {f.type === "select" ? (
              <select
                id={`filter-${f.key}`}
                disabled={!wired}
                value={values?.[f.key] ?? ""}
                onChange={(e) => onChange?.(f.key, e.target.value)}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:opacity-50 disabled:bg-slate-50"
              >
                <option value="">Any</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`filter-${f.key}`}
                type={f.type === "number" ? "number" : "text"}
                disabled={!wired}
                placeholder={f.placeholder}
                value={values?.[f.key] ?? ""}
                onChange={(e) => onChange?.(f.key, e.target.value)}
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-50"
              />
            )}
          </div>
        ))}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
