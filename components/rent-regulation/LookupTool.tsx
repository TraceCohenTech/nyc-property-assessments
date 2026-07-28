"use client";

import { useState } from "react";
import { Search, CheckCircle2, Building2, Landmark, HelpCircle, XCircle, Loader2 } from "lucide-react";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import type { LookupResult, RentStatus } from "@/components/rent-regulation/types";

const STATUS_META: Record<RentStatus, { label: string; icon: React.ReactNode; badgeLevel: "high" | "medium" | "low" | "planned"; badgeLabel: string }> = {
  hcr_confirmed: {
    label: "HCR confirmed",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />,
    badgeLevel: "high",
    badgeLabel: "Verified — in official list",
  },
  tax_benefit_regulated: {
    label: "Tax-benefit regulated (421-a / J-51)",
    icon: <Landmark className="h-5 w-5 text-blue-600" aria-hidden="true" />,
    badgeLevel: "high",
    badgeLabel: "Verified — HCR + tax-benefit flag",
  },
  likely_structural_candidate: {
    label: "Likely structural candidate",
    icon: <Building2 className="h-5 w-5 text-orange-600" aria-hidden="true" />,
    badgeLevel: "medium",
    badgeLabel: "Estimate — not a registration",
  },
  unknown: {
    label: "Unknown",
    icon: <HelpCircle className="h-5 w-5 text-slate-500" aria-hidden="true" />,
    badgeLevel: "low",
    badgeLabel: "Insufficient data",
  },
  not_identified: {
    label: "Not identified",
    icon: <XCircle className="h-5 w-5 text-slate-400" aria-hidden="true" />,
    badgeLevel: "planned",
    badgeLabel: "Not on the current list",
  },
};

export function LookupTool() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/rent-regulation/api/lookup?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) throw new Error("Lookup failed");
      const data = (await res.json()) as LookupResult;
      setResult(data);
    } catch {
      setError("Couldn't complete the lookup. Try a BBL (e.g. 1008710031) or a street address.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by address or 10-digit BBL (e.g. 1008710031)"
            className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          Look up
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          {!result.found ? (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <XCircle className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
              No matching property found in the FY2027 assessment roll for &ldquo;{q}&rdquo;. Try a full street address or a 10-digit BBL.
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-bold text-slate-900">{result.address || result.bbl}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {result.borough} · BBL {result.bbl}
                  </div>
                </div>
                <ConfidenceBadge level={STATUS_META[result.status].badgeLevel} label={STATUS_META[result.status].badgeLabel} />
              </div>

              <div className="mt-4 flex items-center gap-2">
                {STATUS_META[result.status].icon}
                <span className="font-semibold text-sm text-slate-900">{STATUS_META[result.status].label}</span>
              </div>

              {result.hcr_listed && (
                <div className="mt-3 text-xs text-slate-600 space-y-1">
                  <p>
                    This building appears in the {result.source_year} HCR registration file (join confidence:{" "}
                    <strong>{result.join_confidence}</strong>). It has at least one registered stabilized unit —{" "}
                    <strong>not</strong> a count of how many units are stabilized, and not a claim about any specific apartment.
                  </p>
                  {result.status_codes && result.status_codes.length > 0 && (
                    <p>Status codes on file: {result.status_codes.join(", ")}</p>
                  )}
                </div>
              )}

              {result.status === "likely_structural_candidate" && (
                <p className="mt-3 text-xs text-slate-600">
                  Not in the current HCR building list, but this building&apos;s age, size, and building class match the
                  structural profile of rent-stabilized housing under NYC law. This is an <strong>estimate only</strong> —
                  not a registration record.
                </p>
              )}

              {result.status === "not_identified" && (
                <p className="mt-3 text-xs text-slate-600">
                  Not in the current HCR list and doesn&apos;t match the structural-candidate profile. This does not mean the
                  building is definitely unregulated — see the caveats above.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
