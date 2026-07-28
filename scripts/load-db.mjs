// Loads property_search.csv into Neon Postgres using a persistent pg connection
// (more reliable than the HTTP driver for a long bulk load), then indexes it.
// Usage: node --env-file=.env.local scripts/load-db.mjs
import pg from "pg";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const CSV_PATH =
  "/private/tmp/claude-501/-Users-tracecohen/53b5d2a0-92e3-47c6-8be9-1fa515de539f/scratchpad/nyc_property_etl/property_search.csv";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  await client.connect();
  console.log("Connected. Creating table...");
  await client.query("DROP TABLE IF EXISTS properties");
  // Slim schema: Neon free-tier project cap is 512MB total, so we keep row size
  // tight (varchar caps instead of unbounded text, dropped redundant block/lot
  // columns since they're derivable from bbl) and skip expensive GIN trigram
  // indexes in favor of cheap btree indexes (bbl exact/prefix, zip, borough,
  // lower(address) prefix). Owner search falls back to an unindexed ILIKE scan
  // -- at ~1.17M rows that's a sub-second sequential scan, acceptable for an
  // interactive one-off lookup box.
  await client.query(`
    CREATE TABLE properties (
      id SERIAL PRIMARY KEY,
      bbl VARCHAR(12) NOT NULL,
      borough VARCHAR(13) NOT NULL,
      owner VARCHAR(60),
      address VARCHAR(45),
      zip VARCHAR(5),
      bldg_class VARCHAR(4),
      tax_class VARCHAR(2),
      market_value BIGINT,
      assessed_value BIGINT,
      year_built SMALLINT,
      sqft INT,
      units INT
    )
  `);

  const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  let header = null;
  let batch = [];
  let total = 0;
  const BATCH_SIZE = 2000;

  async function flush() {
    if (batch.length === 0) return;
    const rows = batch;
    batch = [];
    const values = [];
    const params = [];
    let p = 1;
    for (const r of rows) {
      values.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`
      );
      params.push(
        r.bbl, r.borough, r.owner, r.address, r.zip, r.bldg_class,
        r.tax_class, r.market_value, r.assessed_value, r.year_built, r.sqft, r.units
      );
    }
    const q = `INSERT INTO properties (bbl,borough,owner,address,zip,bldg_class,tax_class,market_value,assessed_value,year_built,sqft,units) VALUES ${values.join(",")}`;
    let attempts = 0;
    while (true) {
      try {
        await client.query(q, params);
        break;
      } catch (e) {
        attempts++;
        console.error(`Batch failed (attempt ${attempts}):`, e.message);
        if (attempts >= 5) throw e;
        await new Promise((res) => setTimeout(res, 1000 * attempts));
      }
    }
    total += rows.length;
    if (total % 50000 < BATCH_SIZE) console.log(`Loaded ${total} rows...`);
  }

  for await (const line of rl) {
    if (!header) { header = line; continue; }
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const toIntOrNull = (v) => (v === "" || v === undefined ? null : parseInt(v, 10));
    const yr = toIntOrNull(f[12]);
    batch.push({
      bbl: (f[0] || "").slice(0, 12),
      borough: (f[1] || "").slice(0, 13),
      owner: (f[4] || "").slice(0, 60) || null,
      address: (f[5] || "").slice(0, 45) || null,
      zip: (f[6] || "").slice(0, 5) || null,
      bldg_class: (f[7] || "").slice(0, 4) || null,
      tax_class: (f[8] || "").slice(0, 2) || null,
      market_value: toIntOrNull(f[9]),
      assessed_value: toIntOrNull(f[10]),
      // SMALLINT range guard (int2 max 32767) -- YRBUILT is always a plausible 4-digit year
      year_built: yr && yr > 0 && yr < 32767 ? yr : null,
      sqft: toIntOrNull(f[13]),
      units: toIntOrNull(f[14]),
    });
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  console.log(`Total rows loaded: ${total}`);

  console.log("Creating indexes (cheap btree only -- Neon free tier is 512MB, GIN trigram indexes on 1.17M text rows would blow the budget)...");
  await client.query("CREATE INDEX idx_properties_bbl ON properties (bbl)");
  await client.query("CREATE INDEX idx_properties_zip ON properties (zip)");
  await client.query("CREATE INDEX idx_properties_borough ON properties (borough)");
  // Prefix search only (ILIKE 'term%') -- text_pattern_ops btree, cheap. Owner
  // search and mid-string address search fall back to an unindexed ILIKE '%term%'
  // seq scan in the API route, which is fast enough at this row count.
  await client.query("CREATE INDEX idx_properties_address_prefix ON properties (lower(address) text_pattern_ops)");
  await client.query("CREATE INDEX idx_properties_owner_prefix ON properties (lower(owner) text_pattern_ops)");

  const sizeRes = await client.query(
    "SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size, pg_size_pretty(pg_total_relation_size('properties')) AS table_size"
  );
  console.log("Final size:", sizeRes.rows[0]);
  console.log("Done.");
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
