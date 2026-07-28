// Data-access layer for properties_v2 / owner_groups / owner_aliases.
//
// Backed by libSQL (Turso in production, a local SQLite file in dev). This is a DIFFERENT
// engine/table from the live Neon-backed `properties` table that app/api/search/route.ts
// still reads — that route is untouched; this module is for the Explorer rebuild and its
// new API routes only. A later wave cuts the whole app over once this is proven out.
//
// Env vars (set in .env.local / Vercel project envs):
//   TURSO_DATABASE_URL  — e.g. libsql://nyc-property-explorer-<org>.turso.io
//   TURSO_AUTH_TOKEN    — Turso auth token for that database
// Falls back to a local file DB (db/properties.db, built by scripts/etl/06_build_sqlite.ts)
// when those aren't set, so local dev / build works without any Turso account.

import path from "node:path";
import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;

export function getDb(): Client {
  if (_client) return _client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    _client = createClient({ url, authToken });
  } else {
    // NOTE: deliberately NOT `new URL("../db/properties.db", import.meta.url)` — Next's
    // bundler (webpack/Turbopack) intercepts that pattern as a static-asset reference and
    // rewrites it to a bundled asset path (e.g. /_next/static/media/properties.<hash>.db),
    // which doesn't exist as a real file at runtime. process.cwd() is the project root in
    // both `next dev` and `next start`, so this resolves correctly in both.
    const dbPath = path.join(process.cwd(), "db", "properties.db");
    _client = createClient({ url: `file:${dbPath}` });
  }
  return _client;
}

// ---- Shared row/type contracts -------------------------------------------------------------

export type PropertyRow = {
  id: number;
  bbl: string;
  ease_code: string | null;
  bbl_full: string;
  borough_code: string;
  borough_name: string;
  block: string;
  lot: string;
  house_number_lo: string | null;
  house_number_hi: string | null;
  street_name: string | null;
  full_address: string | null;
  zip: string | null;
  owner_raw: string | null;
  owner_normalized: string | null;
  owner_entity_type: string;
  owner_group_id: number | null;
  tax_class: string | null;
  building_class: string | null;
  building_class_description: string | null;
  property_type: string;
  residential_units: number | null;
  total_units: number | null;
  commercial_units: number | null;
  year_built: number | null;
  lot_area: number | null;
  building_area: number | null;
  market_value: number | null;
  assessed_value: number | null;
  taxable_value: number | null;
  exempt_value: number | null;
  value_band: string;
  latitude: number | null;
  longitude: number | null;
  geocoding_status: string;
  coop_number: number | null;
  source_year: string;
  source_dataset: string;
};

export type OwnerGroupRow = {
  owner_group_id: number;
  canonical_name: string;
  owner_type: string;
  display_name: string;
  confidence: string;
  evidence_type: string;
  notes: string | null;
};

/** Every column on properties_v2, for SELECT * convenience in typed call sites. */
export const PROPERTY_COLUMNS = [
  "id",
  "bbl",
  "ease_code",
  "bbl_full",
  "borough_code",
  "borough_name",
  "block",
  "lot",
  "house_number_lo",
  "house_number_hi",
  "street_name",
  "full_address",
  "zip",
  "owner_raw",
  "owner_normalized",
  "owner_entity_type",
  "owner_group_id",
  "tax_class",
  "building_class",
  "building_class_description",
  "property_type",
  "residential_units",
  "total_units",
  "commercial_units",
  "year_built",
  "lot_area",
  "building_area",
  "market_value",
  "assessed_value",
  "taxable_value",
  "exempt_value",
  "value_band",
  "latitude",
  "longitude",
  "geocoding_status",
  "coop_number",
  "source_year",
  "source_dataset",
] as const;
