import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { displayOwner } from "@/lib/ownerPrivacy";
import { ftsQuery, isBblLike } from "@/lib/explorer/query";

// Legacy homepage quick-search endpoint (consumed by components/SearchTool.tsx). Originally
// Neon-backed (see git history); cut over to the same SQLite/Turso properties_v2 table + FTS5
// index that /api/properties uses, keeping this route's existing response shape unchanged so
// SearchTool doesn't need to change. Route is inherently dynamic (reads request.url + hits the
// DB) — no caching.
export const dynamic = "force-dynamic";

type Row = {
  bbl: string;
  bbl_full: string;
  borough_name: string;
  owner_raw: string | null;
  full_address: string | null;
  zip: string | null;
  building_class: string | null;
  tax_class: string | null;
  market_value: number | null;
  assessed_value: number | null;
  year_built: number | null;
  building_area: number | null;
  total_units: number | null;
};

type ResultRow = {
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

const LIMIT = 25;

const COLUMNS =
  "bbl, bbl_full, borough_name, owner_raw, full_address, zip, building_class, tax_class, market_value, assessed_value, year_built, building_area, total_units";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ query: q, count: 0, results: [] });
  }
  if (q.length > 120) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  try {
    const db = getDb();
    let rows: Row[];

    if (isBblLike(q) && q.length <= 10) {
      // BBL search — borough digit + 5-digit block + 4-digit lot, prefix match.
      const result = await db.execute({
        sql: `SELECT ${COLUMNS} FROM properties_v2 WHERE bbl LIKE ? OR bbl_full LIKE ? ORDER BY bbl ASC LIMIT ?`,
        args: [`${q}%`, `${q}%`, LIMIT],
      });
      rows = result.rows as unknown as Row[];
    } else {
      // Address / owner text search using the FTS5 trigram index (replaces the old
      // Neon pg_trgm ILIKE-plus-similarity-sort query — same intent, ~2 orders of
      // magnitude faster; see PRODUCT_AUDIT.md for the prior 611ms seq-scan baseline).
      const result = await db.execute({
        sql: `SELECT ${COLUMNS} FROM properties_v2 WHERE id IN (SELECT rowid FROM properties_fts WHERE properties_fts MATCH ?) ORDER BY market_value DESC LIMIT ?`,
        args: [ftsQuery(q), LIMIT],
      });
      rows = result.rows as unknown as Row[];
    }

    // Individual owners' real names never leave this route — only business/institutional/
    // government owners (per lib/ownerPrivacy.displayOwner) are passed through as-is.
    const results: ResultRow[] = rows.map((r) => ({
      bbl: r.bbl,
      borough: r.borough_name,
      owner: displayOwner(r.owner_raw),
      address: r.full_address,
      zip: r.zip,
      bldg_class: r.building_class,
      tax_class: r.tax_class,
      market_value: r.market_value === null ? null : Number(r.market_value),
      assessed_value: r.assessed_value === null ? null : Number(r.assessed_value),
      year_built: r.year_built,
      sqft: r.building_area,
      units: r.total_units,
    }));

    return NextResponse.json({ query: q, count: results.length, results });
  } catch (err) {
    console.error("search error", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
