import { NextRequest, NextResponse } from "next/server";
import { getDb, PROPERTY_COLUMNS, type PropertyRow } from "@/lib/db";
import { toListItem } from "../route";

// Returns every properties_v2 row sharing a given base BBL (the ordinary parcel row plus any
// easement rows — see DATA_DICTIONARY.md on bbl vs bbl_full). Accepts either a bare 10-digit
// bbl or a full bbl_full (bbl + ease code); either way every row for that base BBL is returned.
//
// FY2027 DOF roll is a static annual snapshot — same ISR idiom as /properties/[bbl]/page.tsx:
// render on first request per BBL, cache indefinitely (force-static + dynamicParams), rather
// than re-querying Turso on every hit.
export const dynamic = "force-static";
export const dynamicParams = true;
export const revalidate = false;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ bbl: string }> }) {
  const { bbl: raw } = await params;
  const bbl = raw.replace(/[^0-9A-Za-z]/g, "").slice(0, 11);
  if (!/^\d{10}/.test(bbl)) {
    return NextResponse.json({ error: "Invalid BBL" }, { status: 400 });
  }
  const baseBbl = bbl.slice(0, 10);

  const db = getDb();
  try {
    const result = await db.execute({
      sql: `SELECT ${PROPERTY_COLUMNS.join(",")} FROM properties_v2 WHERE bbl = ? ORDER BY ease_code IS NOT NULL, ease_code ASC`,
      args: [baseBbl],
    });
    const rows = result.rows as unknown as PropertyRow[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const [primary, ...easements] = rows;
    return NextResponse.json({
      property: toListItem(primary),
      easements: easements.map(toListItem),
    });
  } catch (err) {
    console.error("property detail error", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
