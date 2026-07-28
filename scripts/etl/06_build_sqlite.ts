// Step 6 of the ETL: build the full-city SQLite (libSQL-compatible) database that the
// Explorer/API layer reads from — the target of the Neon -> Turso migration.
//
// Loads the same clean CSV that 02_load_properties_v2.ts loads into Neon, but writes to a
// local SQLite file at db/properties.db using better-sqlite3 (fast synchronous bulk insert,
// no Neon storage cap to work around, so ALL 1,167,962 rows load in one shot — no partial
// load, no ETL_CSV_PATH subset workaround needed).
//
// Owner consolidation (owner_groups / owner_aliases) mirrors 02_load_properties_v2.ts exactly
// (same classify.ts / normalize.ts / governmentGroups.ts modules) so the two databases agree
// on every owner_group_id-bearing property, even though they're on different engines.
//
// Usage: node --import tsx scripts/etl/06_build_sqlite.ts
//
// Does NOT touch Neon. Safe to re-run — drops and rebuilds db/properties.db from scratch.

import Database from "better-sqlite3";
import { createReadStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline";
import { classifyOwnerEntityType } from "../../lib/owners/classify";
import { normalizeOwnerName } from "../../lib/owners/normalize";
import { matchGovernmentGroup } from "./governmentGroups";

const CSV_PATH =
  process.env.ETL_CSV_PATH ||
  "/private/tmp/claude-501/-Users-tracecohen/53b5d2a0-92e3-47c6-8be9-1fa515de539f/scratchpad/nyc_property_etl_v2/properties_v2.csv";

const DB_PATH = new URL("../../db/properties.db", import.meta.url).pathname;

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

function coerce(col: string, v: string | null): number | string | null {
  if (v === "" || v === null || v === undefined) return null;
  if (INT_COLS.has(col)) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  }
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
  if (!existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at ${CSV_PATH}. Run scripts/etl/01_parse_raw_to_csv.ts first.`);
  }
  mkdirSync(new URL("../../db", import.meta.url).pathname, { recursive: true });
  if (existsSync(DB_PATH)) {
    console.log(`Removing existing ${DB_PATH}...`);
    unlinkSync(DB_PATH);
    for (const suffix of ["-wal", "-shm"]) {
      if (existsSync(DB_PATH + suffix)) unlinkSync(DB_PATH + suffix);
    }
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = OFF");
  db.pragma("temp_store = MEMORY");
  db.pragma("cache_size = -200000"); // ~200MB page cache while building

  // ---- Pass 1: scan CSV for distinct owner_raw values ----
  console.log("Pass 1/4: scanning CSV for distinct owner_raw values...");
  const distinctOwners = new Set<string>();
  {
    const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
    let header: string[] | null = null;
    let ownerIdx = -1;
    let rowCount = 0;
    for await (const line of rl) {
      if (!header) {
        header = parseCsvLine(line);
        ownerIdx = header.indexOf("owner_raw");
        continue;
      }
      if (!line.trim()) continue;
      rowCount++;
      const f = parseCsvLine(line);
      const owner = f[ownerIdx];
      if (owner) distinctOwners.add(owner);
    }
    console.log(`  Scanned ${rowCount} rows, ${distinctOwners.size} distinct owner_raw values.`);
  }

  // ---- Classify + consolidate in memory (identical policy to 02_load_properties_v2.ts) ----
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

  // ---- Schema ----
  console.log("Creating schema...");
  db.exec(`
    CREATE TABLE owner_groups (
      owner_group_id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_name TEXT NOT NULL,
      owner_type TEXT NOT NULL,
      display_name TEXT NOT NULL,
      confidence TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE properties_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bbl TEXT NOT NULL,
      ease_code TEXT,
      bbl_full TEXT NOT NULL UNIQUE,
      borough_code TEXT NOT NULL,
      borough_name TEXT NOT NULL,
      block TEXT NOT NULL,
      lot TEXT NOT NULL,
      house_number_lo TEXT,
      house_number_hi TEXT,
      street_name TEXT,
      full_address TEXT,
      zip TEXT,
      owner_raw TEXT,
      owner_normalized TEXT,
      owner_entity_type TEXT NOT NULL,
      owner_group_id INTEGER REFERENCES owner_groups(owner_group_id),
      tax_class TEXT,
      building_class TEXT,
      building_class_description TEXT,
      property_type TEXT NOT NULL,
      residential_units INTEGER,
      total_units INTEGER,
      commercial_units INTEGER,
      year_built INTEGER,
      lot_area INTEGER,
      building_area INTEGER,
      market_value INTEGER,
      assessed_value INTEGER,
      taxable_value INTEGER,
      exempt_value INTEGER,
      value_band TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      geocoding_status TEXT NOT NULL DEFAULT 'pending',
      coop_number INTEGER,
      source_year TEXT NOT NULL,
      source_dataset TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE owner_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_name_raw TEXT NOT NULL,
      owner_name_normalized TEXT NOT NULL,
      owner_group_id INTEGER REFERENCES owner_groups(owner_group_id),
      match_type TEXT NOT NULL,
      confidence TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'fy2027-pts',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log("Inserting owner_groups...");
  const insertGroup = db.prepare(
    `INSERT INTO owner_groups (canonical_name, owner_type, display_name, confidence, evidence_type, notes)
     VALUES (?,?,?,?,?,?)`
  );
  const groupIdByKey = new Map<string, number>();
  const insertGroupsTxn = db.transaction((entries: [string, GroupBucket][]) => {
    for (const [key, bucket] of entries) {
      const info = insertGroup.run(
        bucket.canonicalName,
        bucket.ownerType,
        bucket.canonicalName,
        bucket.confidence,
        bucket.evidenceType,
        bucket.notes
      );
      groupIdByKey.set(key, info.lastInsertRowid as number);
    }
  });
  insertGroupsTxn([...govGroups, ...privateGroups]);
  console.log(`  Inserted ${groupIdByKey.size} owner_groups rows.`);

  console.log("Inserting owner_aliases for grouped owners only...");
  const insertAlias = db.prepare(
    `INSERT INTO owner_aliases (owner_name_raw, owner_name_normalized, owner_group_id, match_type, confidence) VALUES (?,?,?,?,?)`
  );
  const groupedOwners = [...ownerToGroupKey.entries()].filter(([, k]) => k !== null) as [string, string][];
  const insertAliasesTxn = db.transaction((entries: [string, string][]) => {
    for (const [owner, key] of entries) {
      const gid = groupIdByKey.get(key) ?? null;
      const matchType = key.startsWith("gov:") ? "curated-agency" : "exact-normalized";
      const confidence = key.startsWith("gov:") ? govGroups.get(key)!.confidence : "High";
      insertAlias.run(owner, ownerToNormalized.get(owner) ?? null, gid, matchType, confidence);
    }
  });
  insertAliasesTxn(groupedOwners);
  console.log(`  Inserted ${groupedOwners.length} owner_aliases rows.`);

  // ---- Pass 2: stream CSV and bulk insert properties_v2 ----
  console.log("Pass 2/4: bulk loading properties_v2...");
  const insertProp = db.prepare(
    `INSERT INTO properties_v2 (${COLUMNS.join(",")}) VALUES (${COLUMNS.map(() => "?").join(",")})`
  );
  const insertMany = db.transaction((rows: (number | string | null)[][]) => {
    for (const r of rows) insertProp.run(...r);
  });

  const rl2 = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  let header2: string[] | null = null;
  let colIdx: number[] = [];
  let ownerRawIdx = -1;
  let batch: (number | string | null)[][] = [];
  let total = 0;
  const BATCH_SIZE = 5000;

  for await (const line of rl2) {
    if (!header2) {
      header2 = parseCsvLine(line);
      colIdx = COLUMNS.map((c) => header2!.indexOf(c));
      ownerRawIdx = header2.indexOf("owner_raw");
      continue;
    }
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const ownerRaw = f[ownerRawIdx] || null;
    const row = COLUMNS.map((col, i) => {
      if (col === "owner_group_id") {
        const key = ownerRaw ? ownerToGroupKey.get(ownerRaw) : null;
        return key ? groupIdByKey.get(key) ?? null : null;
      }
      return coerce(col, f[colIdx[i]] ?? null);
    });
    batch.push(row);
    total++;
    if (batch.length >= BATCH_SIZE) {
      insertMany(batch);
      batch = [];
      if (total % 100000 < BATCH_SIZE) console.log(`  Loaded ${total} rows...`);
    }
  }
  if (batch.length > 0) insertMany(batch);
  console.log(`Total properties_v2 rows loaded: ${total}`);

  // ---- Pass 3: indexes ----
  console.log("Pass 3/4: creating indexes...");
  db.exec(`
    CREATE INDEX idx_pv2_bbl ON properties_v2 (bbl);
    CREATE INDEX idx_pv2_borough ON properties_v2 (borough_name);
    CREATE INDEX idx_pv2_zip ON properties_v2 (zip);
    CREATE INDEX idx_pv2_owner_normalized ON properties_v2 (owner_normalized);
    CREATE INDEX idx_pv2_owner_group_id ON properties_v2 (owner_group_id);
    CREATE INDEX idx_pv2_tax_class ON properties_v2 (tax_class);
    CREATE INDEX idx_pv2_building_class ON properties_v2 (building_class);
    CREATE INDEX idx_pv2_property_type ON properties_v2 (property_type);
    CREATE INDEX idx_pv2_market_value ON properties_v2 (market_value);
    CREATE INDEX idx_pv2_residential_units ON properties_v2 (residential_units);
    CREATE INDEX idx_pv2_total_units ON properties_v2 (total_units);
    CREATE INDEX idx_pv2_year_built ON properties_v2 (year_built);
    CREATE INDEX idx_pv2_value_band ON properties_v2 (value_band);
    CREATE INDEX idx_pv2_building_area ON properties_v2 (building_area);
    CREATE INDEX idx_pv2_lot_area ON properties_v2 (lot_area);
    -- Common compound filters the Explorer uses together.
    CREATE INDEX idx_pv2_borough_value ON properties_v2 (borough_name, market_value);
    CREATE INDEX idx_pv2_taxclass_value ON properties_v2 (tax_class, market_value);
    CREATE INDEX idx_pv2_taxclass_borough ON properties_v2 (tax_class, borough_name);
    CREATE INDEX idx_pv2_borough_taxclass_value ON properties_v2 (borough_name, tax_class, market_value);
    CREATE INDEX idx_owner_aliases_normalized ON owner_aliases (owner_name_normalized);
    CREATE INDEX idx_owner_aliases_group_id ON owner_aliases (owner_group_id);
  `);

  // ---- Pass 4: FTS5 external-content table for address/owner search ----
  console.log("Pass 4/4: building FTS5 search index...");
  db.exec(`
    CREATE VIRTUAL TABLE properties_fts USING fts5(
      full_address,
      owner_normalized,
      bbl_full UNINDEXED,
      content='properties_v2',
      content_rowid='id',
      tokenize='trigram'
    );
    INSERT INTO properties_fts(rowid, full_address, owner_normalized, bbl_full)
      SELECT id, full_address, owner_normalized, bbl_full FROM properties_v2;

    -- Keep FTS in sync if properties_v2 is ever mutated in place (defensive; the ETL rebuilds
    -- the whole file today, but a future incremental-refresh script may not).
    CREATE TRIGGER properties_ai AFTER INSERT ON properties_v2 BEGIN
      INSERT INTO properties_fts(rowid, full_address, owner_normalized, bbl_full)
      VALUES (new.id, new.full_address, new.owner_normalized, new.bbl_full);
    END;
    CREATE TRIGGER properties_ad AFTER DELETE ON properties_v2 BEGIN
      INSERT INTO properties_fts(properties_fts, rowid, full_address, owner_normalized, bbl_full)
      VALUES ('delete', old.id, old.full_address, old.owner_normalized, old.bbl_full);
    END;
    CREATE TRIGGER properties_au AFTER UPDATE ON properties_v2 BEGIN
      INSERT INTO properties_fts(properties_fts, rowid, full_address, owner_normalized, bbl_full)
      VALUES ('delete', old.id, old.full_address, old.owner_normalized, old.bbl_full);
      INSERT INTO properties_fts(rowid, full_address, owner_normalized, bbl_full)
      VALUES (new.id, new.full_address, new.owner_normalized, new.bbl_full);
    END;
  `);

  // ---- Verify ----
  const countRow = db.prepare("SELECT count(*) as c FROM properties_v2").get() as { c: number };
  const distinctBblFull = db.prepare("SELECT count(DISTINCT bbl_full) as c FROM properties_v2").get() as {
    c: number;
  };
  const linkedRow = db
    .prepare("SELECT count(*) as c FROM properties_v2 WHERE owner_group_id IS NOT NULL")
    .get() as { c: number };
  console.log("Final properties_v2 row count:", countRow.c);
  console.log("Distinct bbl_full:", distinctBblFull.c, "(should equal row count)");
  console.log("Rows linked to an owner_group:", linkedRow.c);

  console.log("Running ANALYZE + VACUUM...");
  db.exec("ANALYZE");
  db.pragma("journal_mode = DELETE"); // drop WAL sidecar files, ship a single clean file
  db.exec("VACUUM");

  db.close();
  console.log(`Done. SQLite DB written to ${DB_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
