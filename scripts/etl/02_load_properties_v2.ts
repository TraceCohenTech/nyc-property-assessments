// Step 2 of the ETL: create properties_v2 + owner_groups + owner_aliases in Neon, classify &
// consolidate owners, and bulk-load properties_v2 with owner_group_id resolved INLINE (owner
// consolidation happens in a first CSV pass, entirely in memory, before any DB write — this
// deliberately avoids a follow-up bulk UPDATE on properties_v2, which under this Neon project's
// tight storage cap (~512MB shared with the still-live `properties` table) was observed to fail
// with "could not extend file because project size limit exceeded" even for a metadata-only
// backfill, because Postgres MVCC needs headroom to write new row versions for an UPDATE. Baking
// owner_group_id into the original INSERT sidesteps that entirely.
//
// Usage: node --env-file=.env.local --import tsx scripts/etl/02_load_properties_v2.ts
//
// Does NOT touch or drop the live `properties` table.
//
// STORAGE CONSTRAINT (see DATA_QUALITY_REPORT.md): this Neon project has a ~512MB total storage
// cap shared with the live `properties` table (currently ~298MB). The full citywide CSV
// (1,167,962 rows) does not fit in the remaining headroom at properties_v2's required column
// width + indexes. Set ETL_CSV_PATH to a filtered subset CSV to load what fits; see
// scripts/etl/README.md for the exact commands used for the current partial load and how to
// complete the citywide load once storage increases.

import pg from "pg";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { classifyOwnerEntityType } from "../../lib/owners/classify";
import { normalizeOwnerName } from "../../lib/owners/normalize";
import { matchGovernmentGroup } from "./governmentGroups";

const CSV_PATH =
  process.env.ETL_CSV_PATH ||
  "/private/tmp/claude-501/-Users-tracecohen/53b5d2a0-92e3-47c6-8be9-1fa515de539f/scratchpad/nyc_property_etl_v2/properties_v2.csv";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set — run with node --env-file=.env.local");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

const COLUMNS = [
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
  "coop_number",
  "source_year",
  "source_dataset",
] as const;
// value_per_resid_unit / value_per_total_unit / value_per_bldg_sqft exist in the CSV (computed
// by transform.ts) but are deliberately NOT loaded as properties_v2 columns — see the storage
// constraint note above the properties_v2 CREATE TABLE statement below.

const INT_COLS = new Set([
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
  "coop_number",
  "owner_group_id",
]);

function coerce(col: string, v: string | null): unknown {
  if (v === "" || v === null || v === undefined) return null;
  if (INT_COLS.has(col)) return parseInt(v, 10);
  return v;
}

const GENERIC_GOV_KEY = "other-gov";
const GENERIC_GOV_NAME = "Other NYC / NY / US Government Agency";

type GroupBucket = {
  canonicalName: string;
  ownerType: string;
  confidence: string;
  evidenceType: string;
  notes: string;
  members: Set<string>;
};

async function main() {
  await client.connect();
  console.log("Connected.");

  // ---- Pass 1: stream the CSV once, collect distinct owner_raw values only (cheap) ----
  console.log("Pass 1/3: scanning CSV for distinct owner_raw values...");
  const ownerIdx = { owner_raw: -1 };
  const distinctOwners = new Set<string>();
  {
    const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
    let header: string[] | null = null;
    let rowCount = 0;
    for await (const line of rl) {
      if (!header) {
        header = parseCsvLine(line);
        ownerIdx.owner_raw = header.indexOf("owner_raw");
        continue;
      }
      if (!line.trim()) continue;
      rowCount++;
      const f = parseCsvLine(line);
      const owner = f[ownerIdx.owner_raw];
      if (owner) distinctOwners.add(owner);
    }
    console.log(`  Scanned ${rowCount} rows, ${distinctOwners.size} distinct owner_raw values.`);
  }

  // ---- Classify + consolidate in memory (mirrors 03_build_owner_groups.ts policy) ----
  console.log("Classifying + consolidating owners in memory...");
  const govGroups = new Map<string, GroupBucket>();
  const privateGroups = new Map<string, GroupBucket>();
  const ownerToGroupKey = new Map<string, string | null>();
  const ownerToNormalized = new Map<string, string>();
  const entityTypeCounts: Record<string, number> = {};

  for (const owner of distinctOwners) {
    const type = classifyOwnerEntityType(owner);
    entityTypeCounts[type] = (entityTypeCounts[type] ?? 0) + 1;
    const normalized = normalizeOwnerName(owner);
    ownerToNormalized.set(owner, normalized);

    if (type === "Government") {
      const upper = owner.toUpperCase();
      const match = matchGovernmentGroup(upper);
      const key = `gov:${match ? match.key : GENERIC_GOV_KEY}`;
      const canonicalName = match ? match.canonicalName : GENERIC_GOV_NAME;
      if (!govGroups.has(key)) {
        govGroups.set(key, {
          canonicalName,
          ownerType: "Government",
          confidence: match ? "Confirmed" : "Medium",
          evidenceType: "curated-agency-list",
          notes: match
            ? "Matched a curated government agency name-pattern list."
            : "Classified as Government by general phrase match; no specific curated agency matched, bucketed generically.",
          members: new Set(),
        });
      }
      govGroups.get(key)!.members.add(owner);
      ownerToGroupKey.set(owner, key);
    } else if (type === "Individual" || type === "Unknown/Other") {
      ownerToGroupKey.set(owner, null);
    } else {
      const key = `priv:${normalized}`;
      if (!privateGroups.has(key)) {
        privateGroups.set(key, {
          canonicalName: normalized,
          ownerType: type,
          confidence: "Unresolved",
          evidenceType: "exact-normalized-match",
          notes: "",
          members: new Set(),
        });
      }
      privateGroups.get(key)!.members.add(owner);
      ownerToGroupKey.set(owner, key);
    }
  }
  // Drop private "groups" that only ever had one distinct raw spelling — no consolidation
  // actually happened, so no group should exist (privacy/product rule: singleton != a group).
  let privateSingletons = 0;
  for (const [key, bucket] of [...privateGroups.entries()]) {
    if (bucket.members.size < 2) {
      privateGroups.delete(key);
      privateSingletons++;
      for (const m of bucket.members) ownerToGroupKey.set(m, null);
    } else {
      bucket.confidence = "High";
      bucket.notes = `${bucket.members.size} distinct raw spellings collapsed to one normalized name.`;
    }
  }
  console.log(
    `  Government groups: ${govGroups.size}, private groups (2+ variants): ${privateGroups.size}, private singletons (no group): ${privateSingletons}`
  );
  console.log("  Entity type distribution (distinct owners):", entityTypeCounts);

  console.log("Creating owner_groups / properties_v2 / owner_aliases (fresh)...");
  await client.query("DROP TABLE IF EXISTS properties_v2 CASCADE");
  await client.query("DROP TABLE IF EXISTS owner_aliases CASCADE");
  await client.query("DROP TABLE IF EXISTS owner_groups CASCADE");

  await client.query(`
    CREATE TABLE owner_groups (
      owner_group_id SERIAL PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      owner_type VARCHAR(24) NOT NULL,
      display_name TEXT NOT NULL,
      confidence VARCHAR(10) NOT NULL,
      evidence_type VARCHAR(32) NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  console.log("Inserting owner_groups...");
  const groupIdByKey = new Map<string, number>();
  for (const [key, bucket] of [...govGroups, ...privateGroups]) {
    const { rows } = await client.query(
      `INSERT INTO owner_groups (canonical_name, owner_type, display_name, confidence, evidence_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING owner_group_id`,
      [bucket.canonicalName, bucket.ownerType, bucket.canonicalName, bucket.confidence, bucket.evidenceType, bucket.notes]
    );
    groupIdByKey.set(key, rows[0].owner_group_id);
  }
  console.log(`  Inserted ${groupIdByKey.size} owner_groups rows.`);

  await client.query(`
    CREATE TABLE properties_v2 (
      id SERIAL PRIMARY KEY,
      bbl VARCHAR(10) NOT NULL,
      ease_code VARCHAR(1),
      bbl_full VARCHAR(11) NOT NULL UNIQUE,
      borough_code VARCHAR(1) NOT NULL,
      borough_name VARCHAR(13) NOT NULL,
      block VARCHAR(5) NOT NULL,
      lot VARCHAR(4) NOT NULL,
      house_number_lo VARCHAR(12),
      house_number_hi VARCHAR(12),
      street_name VARCHAR(30),
      full_address VARCHAR(60),
      zip VARCHAR(5),
      owner_raw TEXT,
      owner_normalized TEXT,
      owner_entity_type VARCHAR(24) NOT NULL,
      owner_group_id INTEGER REFERENCES owner_groups(owner_group_id),
      tax_class VARCHAR(2),
      building_class VARCHAR(4),
      building_class_description TEXT,
      property_type VARCHAR(32) NOT NULL,
      residential_units INTEGER,
      total_units INTEGER,
      commercial_units INTEGER,
      year_built SMALLINT,
      lot_area INTEGER,
      building_area INTEGER,
      market_value BIGINT,
      assessed_value BIGINT,
      taxable_value BIGINT,
      exempt_value BIGINT,
      value_band VARCHAR(16) NOT NULL,
      -- value_per_resid_unit / value_per_total_unit / value_per_bldg_sqft intentionally NOT
      -- stored (Neon storage cap trade-off) -- compute on read from market_value / units /
      -- building_area, or use the precomputed values in data/aggregates.json + insights.json.
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      geocoding_status VARCHAR(16) NOT NULL DEFAULT 'pending',
      coop_number INTEGER,
      source_year VARCHAR(8) NOT NULL,
      source_dataset VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE owner_aliases (
      id SERIAL PRIMARY KEY,
      owner_name_raw TEXT NOT NULL,
      owner_name_normalized TEXT NOT NULL,
      owner_group_id INTEGER REFERENCES owner_groups(owner_group_id),
      match_type VARCHAR(24) NOT NULL,
      confidence VARCHAR(10) NOT NULL,
      source VARCHAR(32) NOT NULL DEFAULT 'fy2027-pts',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Only store alias rows for owners that ARE part of a group -- singleton individuals/unknowns
  // add no analytical value (owner_group_id is null; owner_raw/normalized already live on
  // properties_v2 directly) and were the dominant cost that originally blew the storage budget.
  console.log("Inserting owner_aliases for grouped owners only...");
  const groupedOwners = [...ownerToGroupKey.entries()].filter(([, k]) => k !== null) as [string, string][];
  {
    const BATCH = 800;
    for (let i = 0; i < groupedOwners.length; i += BATCH) {
      const chunk = groupedOwners.slice(i, i + BATCH);
      const values: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      for (const [owner, key] of chunk) {
        const gid = groupIdByKey.get(key) ?? null;
        const matchType = key.startsWith("gov:") ? "curated-agency" : "exact-normalized";
        const confidence = key.startsWith("gov:")
          ? govGroups.get(key)!.confidence
          : "High";
        values.push(`($${p++},$${p++},$${p++},$${p++},$${p++})`);
        params.push(owner, ownerToNormalized.get(owner), gid, matchType, confidence);
      }
      await client.query(
        `INSERT INTO owner_aliases (owner_name_raw, owner_name_normalized, owner_group_id, match_type, confidence) VALUES ${values.join(",")}`,
        params
      );
    }
    console.log(`  Inserted ${groupedOwners.length} owner_aliases rows.`);
  }

  // ---- Pass 2: stream the CSV again and bulk INSERT properties_v2, owner_group_id resolved inline ----
  console.log("Pass 2/3: bulk loading properties_v2 (owner_group_id resolved inline)...");
  const rl2 = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  let header2: string[] | null = null;
  let batch: string[][] = [];
  let total = 0;
  const BATCH_SIZE = 900; // 34 columns * 900 = 30600 params, under the 65535 pg limit

  async function flush() {
    if (batch.length === 0) return;
    const rows = batch;
    batch = [];
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (const r of rows) {
      const placeholders = COLUMNS.map(() => `$${p++}`);
      values.push(`(${placeholders.join(",")})`);
      const ownerRaw = r[header2!.indexOf("owner_raw")] || null;
      for (const col of COLUMNS) {
        if (col === "owner_group_id") {
          const key = ownerRaw ? ownerToGroupKey.get(ownerRaw) : null;
          params.push(key ? (groupIdByKey.get(key) ?? null) : null);
          continue;
        }
        const idx = header2!.indexOf(col);
        params.push(coerce(col, r[idx] ?? null));
      }
    }
    const q = `INSERT INTO properties_v2 (${COLUMNS.join(",")}) VALUES ${values.join(",")}`;
    let attempts = 0;
    while (true) {
      try {
        await client.query(q, params);
        break;
      } catch (e) {
        attempts++;
        console.error(`Batch failed (attempt ${attempts}):`, (e as Error).message);
        if (attempts >= 5) throw e;
        await new Promise((res) => setTimeout(res, 1000 * attempts));
      }
    }
    total += rows.length;
    if (total % 50000 < BATCH_SIZE) console.log(`  Loaded ${total} rows...`);
  }

  for await (const line of rl2) {
    if (!header2) {
      header2 = parseCsvLine(line);
      continue;
    }
    if (!line.trim()) continue;
    batch.push(parseCsvLine(line));
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  console.log(`Total properties_v2 rows loaded: ${total}`);

  console.log("Pass 3/3: creating indexes (btree + GIN trigram)...");
  const schemaSql = readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8");
  const schemaSqlNoComments = schemaSql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const indexStatements = schemaSqlNoComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => /^CREATE INDEX/i.test(s));
  for (const stmt of indexStatements) {
    console.log(" ", stmt.split("\n")[0].slice(0, 90));
    await client.query(stmt);
  }

  const countRes = await client.query("SELECT count(*) FROM properties_v2");
  const linkedRes = await client.query("SELECT count(*) FROM properties_v2 WHERE owner_group_id IS NOT NULL");
  console.log("Final properties_v2 row count:", countRes.rows[0].count);
  console.log("Rows linked to an owner_group:", linkedRes.rows[0].count);

  await client.end();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
