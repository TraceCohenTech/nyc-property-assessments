import { NextRequest, NextResponse } from "next/server";
import { getDb, PROPERTY_COLUMNS, type PropertyRow } from "@/lib/db";
import { displayOwner, isEntityOwner } from "@/lib/ownerPrivacy";
import { parseFilters, ftsQuery, isBblLike } from "@/lib/explorer/query";

// The Explorer's workhorse: filters + sort + pagination against the SQLite/Turso
// properties_v2 table. Dynamic — reads request.nextUrl.searchParams on every call, so this
// can't use force-static (that would force searchParams to read empty). Instead the response
// carries a Cache-Control header so Vercel's CDN edge caches each distinct filter-combo URL —
// the FY2027 roll is a static snapshot, so a same-URL repeat request never needs to hit Turso
// again. s-maxage is kept well under "forever" (unlike the per-BBL pages) since this is the
// query surface most likely to get a corrective data patch without a full redeploy.
export const dynamic = "force-dynamic";

const LIST_CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

export type PropertyListItem = {
  bbl: string;
  bbl_full: string;
  ease_code: string | null;
  full_address: string | null;
  borough: string;
  zip: string | null;
  owner: string; // ALWAYS masked (see displayOwner) — raw owner_raw never leaves this route
  owner_is_entity: boolean;
  owner_group_id: number | null;
  tax_class: string | null;
  building_class: string | null;
  property_type: string;
  year_built: number | null;
  residential_units: number | null;
  total_units: number | null;
  commercial_units: number | null;
  lot_area: number | null;
  building_area: number | null;
  market_value: number | null;
  assessed_value: number | null;
  taxable_value: number | null;
  exempt_value: number | null;
  value_band: string;
  value_per_unit: number | null;
  value_per_sqft: number | null;
};

export function toListItem(r: PropertyRow): PropertyListItem {
  const units = r.residential_units || r.total_units || null;
  return {
    bbl: r.bbl,
    bbl_full: r.bbl_full,
    ease_code: r.ease_code,
    full_address: r.full_address,
    borough: r.borough_name,
    zip: r.zip,
    owner: displayOwner(r.owner_raw),
    owner_is_entity: isEntityOwner(r.owner_raw),
    owner_group_id: r.owner_group_id,
    tax_class: r.tax_class,
    building_class: r.building_class,
    property_type: r.property_type,
    year_built: r.year_built,
    residential_units: r.residential_units,
    total_units: r.total_units,
    commercial_units: r.commercial_units,
    lot_area: r.lot_area,
    building_area: r.building_area,
    market_value: r.market_value,
    assessed_value: r.assessed_value,
    taxable_value: r.taxable_value,
    exempt_value: r.exempt_value,
    value_band: r.value_band,
    value_per_unit: r.market_value && units ? Math.round(r.market_value / units) : null,
    value_per_sqft: r.market_value && r.building_area ? Math.round((r.market_value / r.building_area) * 100) / 100 : null,
  };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = parseFilters(sp);
  const db = getDb();

  try {
    let baseWhere = parsed.where;
    let baseParams: (string | number)[] = [...parsed.params];
    const fromClause = "properties_v2";

    if (parsed.q) {
      if (isBblLike(parsed.q)) {
        baseWhere = `${baseWhere} AND (bbl LIKE ? OR bbl_full LIKE ?)`;
        baseParams = [...baseParams, `${parsed.q}%`, `${parsed.q}%`];
      } else {
        // Subquery (not a JOIN) — avoids the ambiguous-column error from properties_fts'
        // own bbl_full column colliding with properties_v2.bbl_full, and keeps column
        // references in the outer query unqualified everywhere else.
        baseWhere = `id IN (SELECT rowid FROM properties_fts WHERE properties_fts MATCH ?) AND ${baseWhere}`;
        baseParams = [ftsQuery(parsed.q), ...baseParams];
      }
    }

    const countSql = `SELECT count(*) as c FROM ${fromClause} WHERE ${baseWhere}`;
    const countResult = await db.execute({ sql: countSql, args: baseParams });
    const total = Number((countResult.rows[0] as unknown as { c: number }).c);

    const offset = (parsed.page - 1) * parsed.pageSize;
    const dataSql = `SELECT ${PROPERTY_COLUMNS.join(",")} FROM ${fromClause} WHERE ${baseWhere} ORDER BY ${parsed.orderBy}, id ASC LIMIT ? OFFSET ?`;
    const dataResult = await db.execute({ sql: dataSql, args: [...baseParams, parsed.pageSize, offset] });

    const rows = dataResult.rows as unknown as PropertyRow[];
    const results = rows.map(toListItem);

    return NextResponse.json(
      {
        total,
        page: parsed.page,
        page_size: parsed.pageSize,
        total_pages: Math.max(1, Math.ceil(total / parsed.pageSize)),
        results,
      },
      { headers: { "Cache-Control": LIST_CACHE_CONTROL } }
    );
  } catch (err) {
    console.error("properties list error", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
