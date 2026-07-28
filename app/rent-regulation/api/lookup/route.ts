import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { LookupResult, RentStatus } from "@/components/rent-regulation/types";

// Address/BBL -> HCR rent-stabilized-building-list lookup. Queries the `rent_stabilized` table
// (built by scripts/etl/08_ingest_hcr.ts) plus a live structural-candidate check against
// properties_v2, rather than shipping the full 16MB hcr_buildings.json to the client.
//
// Takes `q` as a search param (not a path param), so this can't use force-static the way
// /properties/[bbl] does — same Cache-Control approach as /api/properties instead. All lookups
// here are already index-backed (bbl equality, FTS match) so this route was never part of the
// 8-11s /properties/[bbl] regression; the header is a CDN-hit-rate win on top of already-fast
// queries, not a fix for a measured slowdown.
export const dynamic = "force-dynamic";

const LOOKUP_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

const CANDIDATE_WHERE = `
  year_built IS NOT NULL AND year_built > 0 AND year_built < 1974
  AND residential_units IS NOT NULL AND residential_units >= 6
  AND tax_class LIKE '2%'
  AND (building_class LIKE 'C%' OR building_class LIKE 'D%' OR building_class LIKE 'S%')
  AND building_class NOT LIKE 'R%'
`;

function isBblLike(q: string): boolean {
  return /^\d{9,10}$/.test(q.trim());
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ error: "Missing ?q= (address or BBL)" }, { status: 400 });

  const db = getDb();

  try {
    let propRow: Record<string, unknown> | null = null;

    if (isBblLike(q)) {
      const bbl = q.padStart(10, "0");
      const res = await db.execute({
        sql: "SELECT bbl, borough_name, full_address, year_built, residential_units, tax_class, building_class FROM properties_v2 WHERE bbl = ? LIMIT 1",
        args: [bbl],
      });
      propRow = (res.rows[0] as unknown as Record<string, unknown>) ?? null;
    } else {
      const res = await db.execute({
        sql: "SELECT bbl, borough_name, full_address, year_built, residential_units, tax_class, building_class FROM properties_v2 WHERE id IN (SELECT rowid FROM properties_fts WHERE properties_fts MATCH ?) LIMIT 1",
        args: [`"${q.replace(/"/g, '""')}"`],
      });
      propRow = (res.rows[0] as unknown as Record<string, unknown>) ?? null;
    }

    if (!propRow) {
      return NextResponse.json(
        { found: false, status: "not_identified", hcr_listed: false } satisfies LookupResult,
        { headers: { "Cache-Control": LOOKUP_CACHE_CONTROL } }
      );
    }

    const bbl = String(propRow.bbl);
    const hcrRes = await db.execute({
      sql: "SELECT * FROM rent_stabilized WHERE bbl = ? LIMIT 1",
      args: [bbl],
    });
    const hcrRow = hcrRes.rows[0] as unknown as Record<string, unknown> | undefined;

    let status: RentStatus;
    if (hcrRow) {
      status = hcrRow.y421a || hcrRow.j51 ? "tax_benefit_regulated" : "hcr_confirmed";
    } else {
      const candRes = await db.execute({
        sql: `SELECT count(*) as c FROM properties_v2 WHERE bbl = ? AND ${CANDIDATE_WHERE}`,
        args: [bbl],
      });
      const isCandidate = Number((candRes.rows[0] as unknown as { c: number }).c) > 0;
      if (isCandidate) status = "likely_structural_candidate";
      else if (propRow.year_built == null || propRow.residential_units == null) status = "unknown";
      else status = "not_identified";
    }

    const result: LookupResult = {
      found: true,
      bbl,
      address: (propRow.full_address as string) ?? null,
      borough: propRow.borough_name as string,
      status,
      hcr_listed: !!hcrRow,
      status_codes: hcrRow ? (JSON.parse(String(hcrRow.status_codes)) as string[]) : undefined,
      y421a: hcrRow ? !!hcrRow.y421a : undefined,
      j51: hcrRow ? !!hcrRow.j51 : undefined,
      coop_condo_conversion: hcrRow ? !!hcrRow.coop_condo_conversion : undefined,
      hotel_sro: hcrRow ? !!hcrRow.hotel_sro : undefined,
      garden_complex: hcrRow ? !!hcrRow.garden_complex : undefined,
      join_confidence: hcrRow ? (hcrRow.join_confidence as string) : undefined,
      source_year: hcrRow ? (hcrRow.source_year as string) : undefined,
    };
    return NextResponse.json(result, { headers: { "Cache-Control": LOOKUP_CACHE_CONTROL } });
  } catch (err) {
    console.error("rent-regulation lookup error", err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
