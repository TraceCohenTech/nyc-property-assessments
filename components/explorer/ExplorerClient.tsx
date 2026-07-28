"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, Search, Download, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";

import { FilterPanel, type FilterField } from "@/components/ui/FilterPanel";
import { OwnerBadge } from "@/components/ui/OwnerBadge";
import { ShareButton } from "@/components/ui/ShareButton";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatUSDFull, formatNumber } from "@/lib/format";
import { PROPERTY_TYPES, VALUE_BANDS, ENTITY_OPTIONS, SORT_OPTIONS, TAX_CLASSES } from "@/lib/explorer/constants";
import type { PropertyListItem } from "@/app/api/properties/route";

type Borough = { borough: string };

const FILTER_KEYS = [
  "value_min",
  "value_max",
  "borough",
  "entity",
  "tax_class",
  "bldg_class",
  "zip",
  "year_built_min",
  "year_built_max",
  "units_min",
  "units_max",
  "property_type",
  "value_band",
  "q",
  "sort",
  "page",
] as const;

type FilterState = Record<(typeof FILTER_KEYS)[number], string>;

const EMPTY_FILTERS: FilterState = FILTER_KEYS.reduce((acc, k) => {
  acc[k] = "";
  return acc;
}, {} as FilterState);

type ColumnKey =
  | "address"
  | "borough"
  | "owner"
  | "tax_class"
  | "bldg_class"
  | "property_type"
  | "year_built"
  | "res_units"
  | "total_units"
  | "market_value"
  | "assessed_value"
  | "value_per_unit"
  | "value_per_sqft"
  | "bbl";

const ALL_COLUMNS: { key: ColumnKey; label: string; defaultOn: boolean; sort?: string }[] = [
  { key: "address", label: "Address", defaultOn: true, sort: "address_asc" },
  { key: "borough", label: "Borough", defaultOn: true },
  { key: "owner", label: "Owner", defaultOn: true },
  { key: "tax_class", label: "Tax class", defaultOn: true },
  { key: "bldg_class", label: "Bldg class", defaultOn: true },
  { key: "property_type", label: "Property type", defaultOn: false },
  { key: "year_built", label: "Year built", defaultOn: true, sort: "year_desc" },
  { key: "res_units", label: "Resid. units", defaultOn: false },
  { key: "total_units", label: "Total units", defaultOn: true, sort: "units_desc" },
  { key: "market_value", label: "Market value", defaultOn: true, sort: "value_desc" },
  { key: "assessed_value", label: "Assessed value", defaultOn: false },
  { key: "value_per_unit", label: "Value/unit", defaultOn: false },
  { key: "value_per_sqft", label: "Value/sqft", defaultOn: false },
  { key: "bbl", label: "BBL", defaultOn: true },
];

function readFilters(sp: URLSearchParams): FilterState {
  const out = { ...EMPTY_FILTERS };
  for (const k of FILTER_KEYS) {
    const v = sp.get(k);
    if (v) out[k] = v;
  }
  return out;
}

export function ExplorerClient({ boroughs }: { boroughs: Borough[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FilterState>(() => readFilters(searchParams));
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(
    () => new Set(ALL_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key))
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);

  const [results, setResults] = useState<PropertyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state synced when the URL changes via back/forward navigation (an external
  // system — the browser history stack — which is exactly the documented legitimate use of
  // an effect for setState: https://react.dev/learn/you-might-not-need-an-effect). Local
  // `filters` state still has to exist separately from `searchParams` so debounced inputs
  // (typing in a number field) can render every keystroke without waiting on the URL to
  // update 350ms later.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from an external system (URL/history), see comment above
    setFilters(readFilters(searchParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const pushUrl = useCallback(
    (next: FilterState) => {
      const params = new URLSearchParams();
      for (const k of FILTER_KEYS) {
        if (next[k]) params.set(k, next[k]);
      }
      const qs = params.toString();
      router.push(qs ? `/explorer?${qs}` : "/explorer", { scroll: false });
    },
    [router]
  );

  function updateFilter(key: string, value: string, opts?: { immediate?: boolean; resetPage?: boolean }) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (opts?.resetPage !== false) next.page = "";
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (opts?.immediate) {
        pushUrl(next);
      } else {
        debounceRef.current = setTimeout(() => pushUrl(next), 350);
      }
      return next;
    });
  }

  function setSort(sortValue: string) {
    updateFilter("sort", sortValue, { immediate: true });
  }

  function goToPage(p: number) {
    setFilters((prev) => {
      const next = { ...prev, page: String(p) };
      pushUrl(next);
      return next;
    });
  }

  // Fetch whenever the URL's query string changes (source of truth), with abort-on-change —
  // a data fetch tied to an external trigger (navigation) is the other documented legitimate
  // use of setState-in-effect; there's no render-time equivalent for "start a network request
  // and reflect its in-flight state" in React.
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch triggered by URL change, see comment above
    setLoading(true);
    setError(null);

    const qs = searchParams.toString();
    fetch(`/api/properties${qs ? `?${qs}` : ""}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        setResults(data.results ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.total_pages ?? 1);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError("Couldn't load properties — try again in a moment.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [searchParams]);

  const fields: FilterField[] = useMemo(
    () => [
      { key: "value_min", label: "Min market value", type: "number", placeholder: "$0" },
      { key: "value_max", label: "Max market value", type: "number", placeholder: "Any" },
      {
        key: "borough",
        label: "Borough",
        type: "select",
        options: boroughs.map((b) => ({ value: b.borough, label: b.borough })),
      },
      { key: "tax_class", label: "Tax class", type: "select", options: TAX_CLASSES.map((t) => ({ value: t, label: `Class ${t}` })) },
      { key: "bldg_class", label: "Building class", type: "text", placeholder: "e.g. R4 or R" },
      {
        key: "property_type",
        label: "Property type",
        type: "select",
        options: PROPERTY_TYPES.map((t) => ({ value: t, label: t })),
      },
      { key: "entity", label: "Owner type", type: "select", options: ENTITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
      { key: "zip", label: "Zip code", type: "text", placeholder: "e.g. 10001" },
      { key: "year_built_min", label: "Year built (from)", type: "number", placeholder: "e.g. 1900" },
      { key: "year_built_max", label: "Year built (to)", type: "number", placeholder: "e.g. 2026" },
      { key: "units_min", label: "Min total units", type: "number", placeholder: "0" },
      { key: "units_max", label: "Max total units", type: "number", placeholder: "Any" },
      { key: "value_band", label: "Value band", type: "select", options: VALUE_BANDS.map((v) => ({ value: v, label: v })) },
    ],
    [boroughs]
  );

  const filterValues = useMemo(() => {
    const v: Record<string, string> = {};
    for (const f of fields) v[f.key] = filters[f.key as keyof FilterState] ?? "";
    return v;
  }, [fields, filters]);

  function clearAll() {
    pushUrl({ ...EMPTY_FILTERS });
  }

  const activeFilterCount = FILTER_KEYS.filter((k) => k !== "sort" && k !== "page" && filters[k]).length;
  const currentPage = filters.page ? parseInt(filters.page, 10) || 1 : 1;
  const exportHref = `/api/export${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <div>
      {/* Search + filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <label htmlFor="explorer-q" className="sr-only">
          Search address, owner, or BBL
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            id="explorer-q"
            type="text"
            defaultValue={filters.q}
            onChange={(e) => updateFilter("q", e.target.value)}
            placeholder="Search address, owner name, or BBL (e.g. 1008710031)"
            className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
        </div>

        <div className="mt-4">
          <FilterPanel fields={fields} values={filterValues} onChange={(k, v) => updateFilter(k, v)} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-semibold text-blue-700 hover:underline min-h-[32px]"
            >
              Clear all filters ({activeFilterCount})
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="explorer-sort" className="text-xs font-semibold text-slate-500">
              Sort
            </label>
            <select
              id="explorer-sort"
              value={filters.sort || "value_desc"}
              onChange={(e) => setSort(e.target.value)}
              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600">
          {loading ? "Searching…" : `${formatNumber(total)} propert${total === 1 ? "y" : "ies"} match`}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setColMenuOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setColMenuOpen(false);
              }}
              aria-haspopup="true"
              aria-expanded={colMenuOpen}
              aria-controls="explorer-column-menu"
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.97]"
            >
              <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
              Columns
            </button>
            {colMenuOpen && (
              <div
                id="explorer-column-menu"
                role="group"
                aria-label="Toggle visible columns"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setColMenuOpen(false);
                }}
                className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-modal"
              >
                {ALL_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 py-1 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={visibleCols.has(c.key)}
                      onChange={(e) => {
                        setVisibleCols((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(c.key);
                          else next.delete(c.key);
                          return next;
                        });
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.97]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export CSV
          </a>
          <ShareButton label="Share view" />
        </div>
      </div>

      {/* Results */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5 shadow-card">
        {loading ? (
          <LoadingState label="Loading properties…" />
        ) : error ? (
          <ErrorState description={error} onRetry={() => pushUrl(filters)} />
        ) : results.length === 0 ? (
          <EmptyState
            title="No properties match these filters"
            description="Try widening the value range, clearing a filter, or removing the search term."
            action={
              activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-sm font-semibold text-blue-700 hover:underline"
                >
                  Clear all filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                    {ALL_COLUMNS.filter((c) => visibleCols.has(c.key)).map((c) => (
                      <th key={c.key} className={`py-2 pr-3 ${c.key.includes("value") || c.key.includes("units") ? "text-right" : ""}`}>
                        {c.sort ? (
                          <button
                            type="button"
                            onClick={() => setSort(filters.sort === c.sort ? oppositeSort(c.sort) : c.sort!)}
                            className="inline-flex items-center gap-1 hover:text-blue-600"
                          >
                            {c.label}
                            {filters.sort === c.sort && <ArrowDown className="h-3 w-3" aria-hidden="true" />}
                            {filters.sort === oppositeSort(c.sort) && <ArrowUp className="h-3 w-3" aria-hidden="true" />}
                          </button>
                        ) : (
                          c.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.bbl_full} className="border-b border-slate-100 hover:bg-blue-50/30">
                      {visibleCols.has("address") && (
                        <td className="py-2 pr-3 font-semibold text-slate-900">
                          <Link href={`/properties/${r.bbl}`} className="hover:underline hover:text-blue-700">
                            {r.full_address || "—"}
                          </Link>
                        </td>
                      )}
                      {visibleCols.has("borough") && <td className="py-2 pr-3 text-slate-700">{r.borough}</td>}
                      {visibleCols.has("owner") && (
                        <td className="py-2 pr-3">
                          <OwnerBadge owner={r.owner_is_entity ? r.owner : null} />
                        </td>
                      )}
                      {visibleCols.has("tax_class") && <td className="py-2 pr-3 text-slate-700">{r.tax_class || "—"}</td>}
                      {visibleCols.has("bldg_class") && <td className="py-2 pr-3 text-slate-700">{r.building_class || "—"}</td>}
                      {visibleCols.has("property_type") && <td className="py-2 pr-3 text-slate-700">{r.property_type}</td>}
                      {visibleCols.has("year_built") && (
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{r.year_built || "—"}</td>
                      )}
                      {visibleCols.has("res_units") && (
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{r.residential_units ?? "—"}</td>
                      )}
                      {visibleCols.has("total_units") && (
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{r.total_units ?? "—"}</td>
                      )}
                      {visibleCols.has("market_value") && (
                        <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-900">
                          {r.market_value != null ? formatUSDFull(r.market_value) : "—"}
                        </td>
                      )}
                      {visibleCols.has("assessed_value") && (
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                          {r.assessed_value != null ? formatUSDFull(r.assessed_value) : "—"}
                        </td>
                      )}
                      {visibleCols.has("value_per_unit") && (
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                          {r.value_per_unit != null ? formatUSDFull(r.value_per_unit) : "—"}
                        </td>
                      )}
                      {visibleCols.has("value_per_sqft") && (
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                          {r.value_per_sqft != null ? `$${r.value_per_sqft.toFixed(0)}` : "—"}
                        </td>
                      )}
                      {visibleCols.has("bbl") && (
                        <td className="py-2 pr-3 text-slate-500 font-mono text-xs">{r.bbl}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {results.map((r) => (
                <Link
                  key={r.bbl_full}
                  href={`/properties/${r.bbl}`}
                  className="block rounded-xl border border-slate-200 p-3 hover:border-blue-300"
                >
                  <div className="font-semibold text-slate-900">{r.full_address || "—"}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {r.borough} · {r.tax_class ? `Class ${r.tax_class}` : "—"} · {r.building_class || "—"}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <OwnerBadge owner={r.owner_is_entity ? r.owner : null} />
                    <span className="font-bold text-slate-900 tabular-nums">
                      {r.market_value != null ? formatUSDFull(r.market_value) : "—"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {r.year_built ? `Built ${r.year_built}` : "Year unknown"}
                    {r.total_units ? ` · ${r.total_units} units` : ""}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Previous
              </button>
              <span className="text-xs text-slate-500">
                Page {currentPage} of {formatNumber(totalPages)}
              </span>
              <button
                type="button"
                onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 min-h-[36px] px-3 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function oppositeSort(sort?: string): string {
  if (!sort) return "";
  if (sort.endsWith("_desc")) return sort.replace("_desc", "_asc");
  if (sort.endsWith("_asc")) return sort.replace("_asc", "_desc");
  return sort;
}
