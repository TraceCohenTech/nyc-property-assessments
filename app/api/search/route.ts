import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { displayOwner } from "@/lib/ownerPrivacy";

// Route is inherently dynamic (reads request.url + hits the DB) — no caching.
export const dynamic = "force-dynamic";

const sql = neon(process.env.DATABASE_URL!);

type Row = {
  bbl: string;
  borough: string;
  owner: string | null;
  address: string | null;
  zip: string | null;
  bldg_class: string | null;
  tax_class: string | null;
  market_value: string | number | null;
  assessed_value: string | number | null;
  year_built: number | null;
  sqft: number | null;
  units: number | null;
};

const LIMIT = 25;

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ query: q, count: 0, results: [] });
  }
  if (q.length > 120) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  try {
    const digitsOnly = /^\d+$/.test(q);
    let rows: Row[];

    if (digitsOnly && q.length <= 10) {
      // BBL search — borough digit + 5-digit block + 4-digit lot, prefix match.
      rows = (await sql`
        SELECT bbl, borough, owner, address, zip, bldg_class, tax_class,
               market_value, assessed_value, year_built, sqft, units
        FROM properties
        WHERE bbl LIKE ${q + "%"}
        ORDER BY bbl ASC
        LIMIT ${LIMIT}
      `) as Row[];
    } else {
      // Address / owner text search using trigram similarity + ILIKE fallback.
      const like = `%${q}%`;
      rows = (await sql`
        SELECT bbl, borough, owner, address, zip, bldg_class, tax_class,
               market_value, assessed_value, year_built, sqft, units
        FROM properties
        WHERE address ILIKE ${like} OR owner ILIKE ${like}
        ORDER BY GREATEST(similarity(address, ${q}), similarity(owner, ${q})) DESC
        LIMIT ${LIMIT}
      `) as Row[];
    }

    // Individual owners' real names never leave this route — only business/institutional/
    // government owners (per lib/ownerPrivacy.isEntityOwner) are passed through as-is.
    const results = rows.map((r) => ({
      ...r,
      owner: displayOwner(r.owner),
      market_value: r.market_value === null ? null : Number(r.market_value),
      assessed_value: r.assessed_value === null ? null : Number(r.assessed_value),
    }));

    return NextResponse.json({ query: q, count: results.length, results });
  } catch (err) {
    console.error("search error", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
