import { NextRequest } from "next/server";
import { getDb, PROPERTY_COLUMNS, type PropertyRow } from "@/lib/db";
import { parseFilters, ftsQuery, isBblLike, MAX_EXPORT_ROWS } from "@/lib/explorer/query";
import { toListItem } from "../properties/route";

// Streams a CSV of every property matching the current Explorer filter set (same URL param
// convention as /api/properties), capped at MAX_EXPORT_ROWS so a broad/no-op filter can't
// trigger an unbounded 1.17M-row export. Owner names are masked exactly like the list API —
// raw individual names never leave the server here either.
export const dynamic = "force-dynamic";

const CSV_HEADERS = [
  "bbl",
  "bbl_full",
  "address",
  "borough",
  "zip",
  "owner",
  "owner_type",
  "tax_class",
  "building_class",
  "property_type",
  "year_built",
  "residential_units",
  "total_units",
  "commercial_units",
  "lot_area_sqft",
  "building_area_sqft",
  "market_value",
  "assessed_value",
  "taxable_value",
  "exempt_value",
  "value_band",
  "value_per_unit",
  "value_per_sqft",
] as const;

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvRow(item: ReturnType<typeof toListItem>): string {
  const values = [
    item.bbl,
    item.bbl_full,
    item.full_address,
    item.borough,
    item.zip,
    item.owner,
    item.owner_is_entity ? "Entity" : "Individual (redacted)",
    item.tax_class,
    item.building_class,
    item.property_type,
    item.year_built,
    item.residential_units,
    item.total_units,
    item.commercial_units,
    item.lot_area,
    item.building_area,
    item.market_value,
    item.assessed_value,
    item.taxable_value,
    item.exempt_value,
    item.value_band,
    item.value_per_unit,
    item.value_per_sqft,
  ];
  return values.map(csvField).join(",") + "\r\n";
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = parseFilters(sp);
  const db = getDb();

  let baseWhere = parsed.where;
  let baseParams: (string | number)[] = [...parsed.params];
  const fromClause = "properties_v2";

  if (parsed.q) {
    if (isBblLike(parsed.q)) {
      baseWhere = `${baseWhere} AND (bbl LIKE ? OR bbl_full LIKE ?)`;
      baseParams = [...baseParams, `${parsed.q}%`, `${parsed.q}%`];
    } else {
      // Subquery, not a JOIN — see the matching comment in app/api/properties/route.ts.
      baseWhere = `id IN (SELECT rowid FROM properties_fts WHERE properties_fts MATCH ?) AND ${baseWhere}`;
      baseParams = [ftsQuery(parsed.q), ...baseParams];
    }
  }

  const CHUNK = 2000;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(CSV_HEADERS.join(",") + "\r\n"));
      let offset = 0;
      let written = 0;
      try {
        while (written < MAX_EXPORT_ROWS) {
          const limit = Math.min(CHUNK, MAX_EXPORT_ROWS - written);
          const result = await db.execute({
            sql: `SELECT ${PROPERTY_COLUMNS.join(",")} FROM ${fromClause} WHERE ${baseWhere} ORDER BY ${parsed.orderBy}, id ASC LIMIT ? OFFSET ?`,
            args: [...baseParams, limit, offset],
          });
          const rows = result.rows as unknown as PropertyRow[];
          if (rows.length === 0) break;
          let chunkText = "";
          for (const r of rows) chunkText += toCsvRow(toListItem(r));
          controller.enqueue(encoder.encode(chunkText));
          written += rows.length;
          offset += rows.length;
          if (rows.length < limit) break;
        }
      } catch (err) {
        console.error("export stream error", err);
      } finally {
        controller.close();
      }
    },
  });

  const filename = `nyc-property-export-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
