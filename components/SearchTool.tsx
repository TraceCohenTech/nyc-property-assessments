"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { formatUSDFull, formatNumber } from "@/lib/format";

type SearchRow = {
  bbl: string;
  borough: string;
  owner: string | null;
  address: string | null;
  zip: string | null;
  bldg_class: string | null;
  tax_class: string | null;
  market_value: number | null;
  assessed_value: number | null;
  year_built: number | null;
  sqft: number | null;
  units: number | null;
};

export function SearchTool() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchRow[] | null>(null);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) {
      setError("Enter at least 2 characters — an address, owner name, or BBL (e.g. 1008710031).");
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSearchedFor(query);
    } catch {
      setError("Search failed — try again in a moment.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={runSearch} className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="property-search" className="sr-only">
          Search by address, owner name, or BBL
        </label>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            id="property-search"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Address, owner name, or BBL (e.g. 1008710031)"
            aria-label="Search by address, owner name, or BBL"
            className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.97] disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {results && !error && (
        <div className="mt-5">
          <p className="text-xs text-slate-500 mb-3">
            {results.length === 0
              ? `No properties matched "${searchedFor}".`
              : `${results.length} result${results.length === 1 ? "" : "s"} for "${searchedFor}"${results.length === 25 ? " (showing first 25)" : ""}`}
          </p>
          {results.length > 0 && (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-3">Address</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Borough</th>
                    <th className="py-2 pr-3">Bldg class</th>
                    <th className="py-2 pr-3">Tax class</th>
                    <th className="py-2 pr-3 text-right">Market value</th>
                    <th className="py-2 pr-3 text-right">Assessed value</th>
                    <th className="py-2 pr-3 text-right">Year built</th>
                    <th className="py-2 pr-3 text-right">Sqft</th>
                    <th className="py-2 pr-3 text-right">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.bbl} className="border-b border-slate-100 hover:bg-blue-50/30">
                      <td className="py-2 pr-3 font-semibold text-slate-900">{r.address || "—"}</td>
                      <td className="py-2 pr-3 text-slate-700">{r.owner || "—"}</td>
                      <td className="py-2 pr-3 text-slate-700">{r.borough}</td>
                      <td className="py-2 pr-3 text-slate-700">{r.bldg_class || "—"}</td>
                      <td className="py-2 pr-3 text-slate-700">{r.tax_class || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-900">
                        {r.market_value != null ? formatUSDFull(r.market_value) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-900">
                        {r.assessed_value != null ? formatUSDFull(r.assessed_value) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{r.year_built || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-700">
                        {r.sqft != null ? formatNumber(r.sqft) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{r.units ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
