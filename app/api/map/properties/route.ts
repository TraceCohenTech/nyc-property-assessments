import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { displayOwner, isEntityOwner } from "@/lib/ownerPrivacy";
import { parseFilters } from "@/lib/explorer/query";

// Bbox-gated point layer for /map's high-zoom regime. Individual property points are only
// ever returned when the estimated result count is small enough to render sanely
// (<= MAX_POINTS) — otherwise the client gets an aggregate-hint response telling it to zoom
// in or narrow filters, and should keep showing the borough/ZIP choropleth instead. This
// keeps the endpoint cheap: worst case is one COUNT(*) query, and the point query never scans
// more than MAX_POINTS rows.
export const dynamic = "force-dynamic";

const MAX_POINTS = 2500;
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

export type MapPoint = {
  bbl: string;
  lat: number;
  lon: number;
  full_address: string | null;
  owner: string;
  owner_is_entity: boolean;
  tax_class: string | null;
  property_type: string;
  market_value: number | null;
  residential_units: number | null;
};

function parseBbox(sp: URLSearchParams): { w: number; s: number; e: number; n: number } | null {
  const raw = sp.get("bbox");
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) return null;
  const [w, s, e, n] = parts;
  if (w >= e || s >= n) return null;
  return { w, s, e, n };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const bbox = parseBbox(sp);
  if (!bbox) {
    return NextResponse.json({ error: "bbox=w,s,e,n query param is required" }, { status: 400 });
  }

  const parsed = parseFilters(sp, { pageSize: MAX_POINTS });
  const db = getDb();

  // Filters' free-text `q` isn't supported on the map layer (no FTS join here) — ignored
  // deliberately rather than erroring, so a stray leftover q= from the Explorer URL state
  // doesn't break the map.
  const where = `${parsed.where} AND latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`;
  const params = [...parsed.params, bbox.s, bbox.n, bbox.w, bbox.e];

  try {
    const countSql = `SELECT count(*) as c FROM properties_v2 WHERE ${where}`;
    const countResult = await db.execute({ sql: countSql, args: params });
    const total = Number((countResult.rows[0] as unknown as { c: number }).c);

    if (total > MAX_POINTS) {
      return NextResponse.json(
        {
          mode: "aggregate-hint" as const,
          total,
          max_points: MAX_POINTS,
          message: "Too many properties in view — zoom in or narrow filters to see individual points.",
        },
        { headers: { "Cache-Control": CACHE_CONTROL } }
      );
    }

    const dataSql = `SELECT bbl, full_address, owner_raw, tax_class, property_type, market_value, residential_units, latitude, longitude
                      FROM properties_v2 WHERE ${where} LIMIT ?`;
    const dataResult = await db.execute({ sql: dataSql, args: [...params, MAX_POINTS] });

    type Row = {
      bbl: string;
      full_address: string | null;
      owner_raw: string | null;
      tax_class: string | null;
      property_type: string;
      market_value: number | null;
      residential_units: number | null;
      latitude: number;
      longitude: number;
    };

    const points: MapPoint[] = (dataResult.rows as unknown as Row[]).map((r) => ({
      bbl: r.bbl,
      lat: r.latitude,
      lon: r.longitude,
      full_address: r.full_address,
      owner: displayOwner(r.owner_raw),
      owner_is_entity: isEntityOwner(r.owner_raw),
      tax_class: r.tax_class,
      property_type: r.property_type,
      market_value: r.market_value,
      residential_units: r.residential_units,
    }));

    return NextResponse.json(
      { mode: "points" as const, total, points },
      { headers: { "Cache-Control": CACHE_CONTROL } }
    );
  } catch (err) {
    console.error("map properties bbox query error", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
