import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ExternalLink, MapPin, Building2 } from "lucide-react";

import { getPropertyDetail } from "@/lib/explorer/getProperty";
import { isEntityOwner } from "@/lib/ownerPrivacy";
import { buildingClassDescription } from "@/lib/buildingClass";
import { formatUSDFull, formatNumber } from "@/lib/format";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { MetricCard } from "@/components/ui/MetricCard";
import { OwnerBadge } from "@/components/ui/OwnerBadge";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { DefinitionTooltip } from "@/components/ui/DefinitionTooltip";
import { ShareButton } from "@/components/ui/ShareButton";

export const dynamic = "force-dynamic"; // 1.17M possible BBLs — no SSG

const CONFIDENCE_MAP: Record<string, "high" | "medium" | "low"> = {
  Confirmed: "high",
  High: "high",
  Medium: "medium",
  Low: "low",
  Unresolved: "low",
};

export async function generateMetadata({ params }: { params: Promise<{ bbl: string }> }): Promise<Metadata> {
  const { bbl } = await params;
  const detail = await getPropertyDetail(bbl);
  if (!detail) return { title: "Property not found | NYC Property Assessment Explorer" };
  const { primary } = detail;
  const address = primary.full_address || `BBL ${primary.bbl}`;
  return {
    title: `${address}, ${primary.borough_name} | NYC Property Assessment Explorer`,
    description: `FY2027 DOF assessment record for ${address} (BBL ${primary.bbl}): tax class ${primary.tax_class ?? "—"}, building class ${primary.building_class ?? "—"}, market value ${primary.market_value != null ? formatUSDFull(primary.market_value) : "unavailable"}.`,
  };
}

function valuePerUnit(marketValue: number | null, units: number | null): number | null {
  if (!marketValue || !units) return null;
  return Math.round(marketValue / units);
}

function valuePerSqft(marketValue: number | null, sqft: number | null): number | null {
  if (!marketValue || !sqft) return null;
  return Math.round((marketValue / sqft) * 100) / 100;
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ bbl: string }> }) {
  const { bbl: bblParam } = await params;
  const detail = await getPropertyDetail(bblParam);
  if (!detail) notFound();

  const { primary, easements, ownerGroup, otherByOwnerGroup, otherAtAddress, nearby } = detail;
  const isEntity = isEntityOwner(primary.owner_raw);
  const bldgDesc = buildingClassDescription(primary.building_class);
  const perUnit = valuePerUnit(primary.market_value, primary.residential_units || primary.total_units);
  const perSqft = valuePerSqft(primary.market_value, primary.building_area);

  const boroughCodeMap: Record<string, string> = { "1": "1", "2": "2", "3": "3", "4": "4", "5": "5" };
  const dofBoro = boroughCodeMap[primary.borough_code] ?? primary.borough_code;

  return (
    <div className="pt-24 sm:pt-28 pb-16 sm:pb-24">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SourceBadge />
          <Link href="/explorer" className="text-xs font-semibold text-blue-700 hover:underline">
            ← Property Explorer
          </Link>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900">
              {primary.full_address || `BBL ${primary.bbl}`}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
              {primary.borough_name}
              {primary.zip ? `, NY ${primary.zip}` : ""} · BBL {primary.bbl}
            </p>
          </div>
          <ShareButton label="Copy link" />
        </div>

        {/* Owner + confidence */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card flex items-center gap-3">
            <Building2 className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Owner of record</div>
              <OwnerBadge owner={isEntity ? primary.owner_raw : null} />
            </div>
          </div>
          {ownerGroup && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Consolidated owner group</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-sm">{ownerGroup.canonical_name}</span>
                <ConfidenceBadge level={CONFIDENCE_MAP[ownerGroup.confidence] ?? "low"} label={ownerGroup.confidence} />
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Owner type</div>
            <div className="mt-1 font-semibold text-slate-900 text-sm">{primary.owner_entity_type}</div>
          </div>
        </div>

        {/* Core metrics */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard label="Market value" value={primary.market_value != null ? formatUSDFull(primary.market_value) : "—"} />
          <MetricCard label="Assessed value" value={primary.assessed_value != null ? formatUSDFull(primary.assessed_value) : "—"} />
          <MetricCard label="Taxable value" value={primary.taxable_value != null ? formatUSDFull(primary.taxable_value) : "—"} />
          <MetricCard label="Exempt value" value={primary.exempt_value != null ? formatUSDFull(primary.exempt_value) : "—"} />
          <MetricCard label="Value band" value={primary.value_band} />
          <MetricCard label="Value / unit" value={perUnit != null ? formatUSDFull(perUnit) : "—"} />
          <MetricCard label="Value / sqft" value={perSqft != null ? `$${perSqft.toFixed(0)}` : "—"} />
          <MetricCard label="Year built" value={primary.year_built ?? "—"} />
        </div>

        {/* Classification + units */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-bold text-slate-900 mb-3">Classification</h2>
            <dl className="space-y-2 text-sm">
              <Row label={<DefinitionTooltip term="Tax class">The DOF tax classification (1, 2, 3, or 4, with A/B/C/D sub-classes for Class 1/2) — determines assessment methodology and cap rules.</DefinitionTooltip>} value={primary.tax_class ?? "—"} />
              <Row
                label={<DefinitionTooltip term="Building class">DOF&rsquo;s two-character building type code.</DefinitionTooltip>}
                value={primary.building_class ? `${primary.building_class}${bldgDesc ? ` — ${bldgDesc}` : ""}` : "—"}
              />
              <Row label="Property type" value={primary.property_type} />
              <Row label="Lot" value={`Block ${primary.block}, Lot ${primary.lot}`} />
            </dl>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-bold text-slate-900 mb-3">Units &amp; size</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Residential units" value={primary.residential_units ?? "—"} />
              <Row label="Commercial units" value={primary.commercial_units ?? "—"} />
              <Row label="Total units" value={primary.total_units ?? "—"} />
              <Row label="Lot area" value={primary.lot_area != null ? `${formatNumber(primary.lot_area)} sqft` : "—"} />
              <Row label="Building area" value={primary.building_area != null ? `${formatNumber(primary.building_area)} sqft` : "—"} />
              {primary.coop_number != null && <Row label="Co-op number" value={primary.coop_number} />}
            </dl>
          </div>
        </div>

        {/* Easement records */}
        {easements.length > 0 && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-bold text-slate-900 mb-1">Easement records on this BBL</h2>
            <p className="text-xs text-slate-500 mb-3">
              {easements.length} additional PTS record{easements.length === 1 ? "" : "s"} share this base BBL — ROW / utility
              easement parcels (see BBL vs. BBL-full in the methodology page).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2 pr-3">Ease code</th>
                    <th className="py-2 pr-3">Owner</th>
                    <th className="py-2 pr-3">Building class</th>
                    <th className="py-2 pr-3 text-right">Market value</th>
                  </tr>
                </thead>
                <tbody>
                  {easements.map((e) => (
                    <tr key={e.bbl_full} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-mono text-xs">{e.ease_code}</td>
                      <td className="py-2 pr-3">
                        <OwnerBadge owner={isEntityOwner(e.owner_raw) ? e.owner_raw : null} />
                      </td>
                      <td className="py-2 pr-3">{e.building_class || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {e.market_value != null ? formatUSDFull(e.market_value) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Other properties by this owner — ENTITY OWNERS ONLY, see getPropertyDetail() doc. */}
        {isEntity && ownerGroup && otherByOwnerGroup.length > 0 && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-bold text-slate-900 mb-1">
              Other properties owned by {ownerGroup.canonical_name}
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              {otherByOwnerGroup.length} other tax lot{otherByOwnerGroup.length === 1 ? "" : "s"} linked to this
              consolidated owner group, by market value.
            </p>
            <ul className="divide-y divide-slate-100">
              {otherByOwnerGroup.map((p) => (
                <li key={p.bbl} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <Link href={`/properties/${p.bbl}`} className="text-slate-900 hover:text-blue-700 hover:underline">
                    {p.full_address || `BBL ${p.bbl}`}
                  </Link>
                  <span className="tabular-nums text-slate-600 shrink-0">
                    {p.market_value != null ? formatUSDFull(p.market_value) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Other lots at this address */}
        {otherAtAddress.length > 0 && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-bold text-slate-900 mb-3">Other lots at this address</h2>
            <ul className="divide-y divide-slate-100">
              {otherAtAddress.map((p) => (
                <li key={p.bbl_full} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <Link href={`/properties/${p.bbl}`} className="text-slate-900 hover:text-blue-700 hover:underline">
                    BBL {p.bbl}
                    {p.ease_code ? ` (easement ${p.ease_code})` : ""} — {p.building_class || "—"}
                  </Link>
                  <span className="tabular-nums text-slate-600 shrink-0">
                    {p.market_value != null ? formatUSDFull(p.market_value) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Nearby properties */}
        {nearby.length > 0 && (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="font-bold text-slate-900 mb-1">Nearby properties</h2>
            <p className="text-xs text-slate-500 mb-3">Same zip code ({primary.zip}), closest by market value.</p>
            <ul className="divide-y divide-slate-100">
              {nearby.map((p) => (
                <li key={p.bbl} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <Link href={`/properties/${p.bbl}`} className="text-slate-900 hover:text-blue-700 hover:underline">
                    {p.full_address || `BBL ${p.bbl}`}
                    <span className="text-slate-400"> · {p.building_class || "—"}</span>
                  </Link>
                  <span className="tabular-nums text-slate-600 shrink-0">
                    {p.market_value != null ? formatUSDFull(p.market_value) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Methodology + sources */}
        <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-5 text-sm text-slate-700">
          <p>
            DOF <DefinitionTooltip term="market value">DOF&rsquo;s estimate of full market value for tax administration — not necessarily current sale price.</DefinitionTooltip> is
            an assessment figure, not an appraisal or a sale price. Owner-of-record names for individual people are
            never shown publicly on this site — only business, institutional, and government owners are displayed
            (see the <Link href="/methodology" className="font-semibold text-blue-700 hover:underline">methodology page</Link>).
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <a
              href={`https://webapps.nyc.gov:8446/CICS/fin1/find001i?FBORO=${dofBoro}&FBLOCK=${primary.block}&FLOT=${primary.lot}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline"
            >
              DOF Property Tax Lookup <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href={`https://zola.planning.nyc.gov/lot/${dofBoro}/${primary.block}/${primary.lot}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline"
            >
              NYC Zoning Map (ZoLa) <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900 text-right">{value}</dd>
    </div>
  );
}
