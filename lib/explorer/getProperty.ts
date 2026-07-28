// Server-only module (uses @libsql/client directly) — never imported from a "use client"
// component. Only called from Server Components / Route Handlers.
import { cache } from "react";
import { getDb, PROPERTY_COLUMNS, type PropertyRow, type OwnerGroupRow } from "@/lib/db";

export type PropertyDetail = {
  primary: PropertyRow;
  easements: PropertyRow[];
  ownerGroup: OwnerGroupRow | null;
  otherByOwnerGroup: { bbl: string; full_address: string | null; market_value: number | null }[];
  otherAtAddress: { bbl: string; bbl_full: string; ease_code: string | null; building_class: string | null; market_value: number | null }[];
  nearby: { bbl: string; full_address: string | null; market_value: number | null; building_class: string | null }[];
};

/**
 * Server-side property lookup for /properties/[bbl]. Accepts either a bare 10-digit BBL or a
 * bbl_full (bbl + ease code) and returns every row sharing that base BBL, plus related-property
 * lists for the detail page.
 *
 * PRIVACY: "other properties by this owner" is ONLY populated for entity owners (owner_group_id
 * present on a business/institutional/government owner). Individual owners never get this
 * section — surfacing every property tied to a private person's identity is a doxxing vector,
 * so the query is skipped entirely (not just filtered client-side) when the owner is an
 * individual. See lib/ownerPrivacy.ts for the underlying classification.
 *
 * PERFORMANCE: wrapped in React's `cache()` so a single request only ever runs this once, even
 * though the page calls it from both `generateMetadata` and the page body (Next.js does not
 * dedupe plain async functions across those two call sites on its own — without `cache()` this
 * function's ~4 sequential Turso round trips ran TWICE per request, which was measured to 504
 * intermittently against the production Turso instance under cold-start conditions). The
 * independent lookups (owner-group siblings, same-address siblings, nearby-by-value) are also
 * run concurrently via Promise.all rather than serially, since none of them depend on each
 * other's results — only on `primary`.
 */
export const getPropertyDetail = cache(async function getPropertyDetail(
  bblParam: string
): Promise<PropertyDetail | null> {
  const cleaned = bblParam.replace(/[^0-9]/g, "");
  if (!/^\d{10}/.test(cleaned)) return null;
  const baseBbl = cleaned.slice(0, 10);

  const db = getDb();

  const result = await db.execute({
    sql: `SELECT ${PROPERTY_COLUMNS.join(",")} FROM properties_v2 WHERE bbl = ? ORDER BY ease_code IS NOT NULL, ease_code ASC`,
    args: [baseBbl],
  });
  const rows = result.rows as unknown as PropertyRow[];
  if (rows.length === 0) return null;
  const [primary, ...easements] = rows;

  const ownerGroupPromise: Promise<OwnerGroupRow | null> = primary.owner_group_id
    ? db
        .execute({
          sql: `SELECT owner_group_id, canonical_name, owner_type, display_name, confidence, evidence_type, notes FROM owner_groups WHERE owner_group_id = ?`,
          args: [primary.owner_group_id],
        })
        .then((r) => (r.rows.length > 0 ? (r.rows[0] as unknown as OwnerGroupRow) : null))
    : Promise.resolve(null);

  // Individual owners: intentionally no query at all — see function doc comment above.
  const otherByOwnerGroupPromise: Promise<PropertyDetail["otherByOwnerGroup"]> = primary.owner_group_id
    ? db
        .execute({
          sql: `SELECT bbl, full_address, market_value FROM properties_v2 WHERE owner_group_id = ? AND bbl != ? GROUP BY bbl ORDER BY market_value DESC LIMIT 25`,
          args: [primary.owner_group_id, baseBbl],
        })
        .then((r) => (r.rows as unknown as PropertyDetail["otherByOwnerGroup"]) ?? [])
    : Promise.resolve([]);

  const otherAtAddressPromise: Promise<PropertyDetail["otherAtAddress"]> = primary.full_address
    ? db
        .execute({
          sql: `SELECT bbl, bbl_full, ease_code, building_class, market_value FROM properties_v2 WHERE full_address = ? AND bbl != ? LIMIT 25`,
          args: [primary.full_address, baseBbl],
        })
        .then((r) => (r.rows as unknown as PropertyDetail["otherAtAddress"]) ?? [])
    : Promise.resolve([]);

  const nearbyPromise: Promise<PropertyDetail["nearby"]> = primary.zip
    ? db
        .execute({
          sql: `SELECT bbl, full_address, market_value, building_class FROM properties_v2
              WHERE zip = ? AND bbl != ? AND market_value IS NOT NULL AND ? IS NOT NULL
              ORDER BY ABS(market_value - ?) ASC LIMIT 8`,
          args: [primary.zip, baseBbl, primary.market_value, primary.market_value ?? 0],
        })
        .then((r) => (r.rows as unknown as PropertyDetail["nearby"]) ?? [])
    : Promise.resolve([]);

  const [ownerGroup, otherByOwnerGroup, otherAtAddress, nearby] = await Promise.all([
    ownerGroupPromise,
    otherByOwnerGroupPromise,
    otherAtAddressPromise,
    nearbyPromise,
  ]);

  return { primary, easements, ownerGroup, otherByOwnerGroup, otherAtAddress, nearby };
});
