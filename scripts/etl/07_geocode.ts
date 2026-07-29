// Step 7 of the ETL: geocode properties_v2 via NYC DCP PLUTO centroids (bulk join, never
// per-record APIs). Populates latitude/longitude/geocoding_status on the EXISTING
// db/properties.db in place (UPDATE only — never drops/rebuilds the table, so this is safe
// to re-run against the live local build at any time without touching anything else in it).
//
// Source: NYC Open Data PLUTO (dataset 64uk-42ks), pulled via the Socrata CSV export with a
// narrow $select (bbl, borough, block, lot, latitude, longitude) — a few dozen MB instead of
// the full ~400-column PLUTO extract. BBL there is a 10-digit float string
// ("2054800111.00000000") in the same borough(1) + block(5) + lot(4) shape as properties_v2.bbl.
//
// Match strategy:
//   1. Direct BBL match against PLUTO (covers ordinary lots, and most condo unit lots that
//      PLUTO itself resolves to their own record).
//   2. Any remaining row with lot >= 1001 (condo units PLUTO doesn't carry individually) falls
//      back to the centroid (mean lat/lon) of all PLUTO lots sharing its borough+block — this
//      approximates the base/billing lot location well since a tax block is compact.
//   3. Anything still unmatched (non-condo lot with no PLUTO record at all — e.g. easements,
//      water lots) is left as geocoding_status = 'unmatched', latitude/longitude = NULL.
//
// Usage: node --import tsx scripts/etl/07_geocode.ts [path/to/pluto_latlon.csv]

import Database from "better-sqlite3";
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";

const DB_PATH = new URL("../../db/properties.db", import.meta.url).pathname;
const PLUTO_CSV =
  process.argv[2] || new URL("../../data/map/_raw/pluto_latlon.csv", import.meta.url).pathname;

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

const BORO_CODE: Record<string, string> = { MN: "1", BX: "2", BK: "3", QN: "4", SI: "5" };

async function main() {
  if (!existsSync(PLUTO_CSV)) {
    console.error(`PLUTO CSV not found at ${PLUTO_CSV}`);
    process.exit(1);
  }
  if (!existsSync(DB_PATH)) {
    console.error(`db/properties.db not found at ${DB_PATH} — build it with 06_build_sqlite.ts first.`);
    process.exit(1);
  }

  console.log(`Reading PLUTO centroids from ${PLUTO_CSV} ...`);
  const byBbl = new Map<string, { lat: number; lon: number }>();
  // borough+block -> running sum, for the condo-unit block-centroid fallback
  const blockAgg = new Map<string, { latSum: number; lonSum: number; n: number }>();

  const rl = createInterface({ input: createReadStream(PLUTO_CSV), crlfDelay: Infinity });
  let header: string[] | null = null;
  let idx: Record<string, number> = {};
  let plutoRows = 0;
  for await (const line of rl) {
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (!header) {
      header = cols;
      idx = Object.fromEntries(header.map((h, i) => [h.replace(/"/g, ""), i]));
      continue;
    }
    const boro = cols[idx.borough]?.replace(/"/g, "").trim();
    const block = cols[idx.block]?.replace(/"/g, "").trim();
    const lat = parseFloat(cols[idx.latitude]?.replace(/"/g, ""));
    const lon = parseFloat(cols[idx.longitude]?.replace(/"/g, ""));
    const boroCode = BORO_CODE[boro];
    if (!boroCode || !block || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    plutoRows++;

    const bblRaw = cols[idx.bbl]?.replace(/"/g, "");
    const bblNum = Math.round(parseFloat(bblRaw)); // "2054800111.00000000" -> 2054800111
    if (Number.isFinite(bblNum)) {
      const bbl = String(bblNum).padStart(10, "0");
      byBbl.set(bbl, { lat, lon });
    }

    const blockKey = `${boroCode}|${block.padStart(5, "0")}`;
    const agg = blockAgg.get(blockKey) ?? { latSum: 0, lonSum: 0, n: 0 };
    agg.latSum += lat;
    agg.lonSum += lon;
    agg.n += 1;
    blockAgg.set(blockKey, agg);
  }
  console.log(`Loaded ${plutoRows.toLocaleString()} PLUTO lots (${byBbl.size.toLocaleString()} unique BBLs, ${blockAgg.size.toLocaleString()} blocks).`);

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  const rows = db
    .prepare(`SELECT bbl, borough_code, block, lot FROM properties_v2`)
    .all() as { bbl: string; borough_code: string; block: string; lot: string }[];
  console.log(`Geocoding ${rows.length.toLocaleString()} properties_v2 rows ...`);

  const updateStmt = db.prepare(
    `UPDATE properties_v2 SET latitude = ?, longitude = ?, geocoding_status = ? WHERE bbl = ?`
  );

  let direct = 0;
  let condoBlock = 0;
  let unmatched = 0;
  const unmatchedSample: string[] = [];

  const tx = db.transaction((batch: typeof rows) => {
    for (const r of batch) {
      const direct_hit = byBbl.get(r.bbl);
      if (direct_hit) {
        updateStmt.run(direct_hit.lat, direct_hit.lon, "pluto_centroid", r.bbl);
        direct++;
        continue;
      }
      const lotNum = parseInt(r.lot, 10);
      if (lotNum >= 1001) {
        const blockKey = `${r.borough_code}|${r.block.padStart(5, "0")}`;
        const agg = blockAgg.get(blockKey);
        if (agg && agg.n > 0) {
          updateStmt.run(agg.latSum / agg.n, agg.lonSum / agg.n, "pluto_centroid_condo_block", r.bbl);
          condoBlock++;
          continue;
        }
      }
      updateStmt.run(null, null, "unmatched", r.bbl);
      unmatched++;
      if (unmatchedSample.length < 20) unmatchedSample.push(r.bbl);
    }
  });

  // better-sqlite3 transactions handle large batches fine in one shot; chunk defensively anyway.
  const CHUNK = 50_000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    tx(rows.slice(i, i + CHUNK));
    console.log(`  ... ${Math.min(i + CHUNK, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_pv2_lat_lon ON properties_v2 (latitude, longitude)`);
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  const total = rows.length;
  const matchRate = ((direct + condoBlock) / total) * 100;
  const condoTotal = rows.filter((r) => parseInt(r.lot, 10) >= 1001).length;
  const condoMatchRate = condoTotal > 0 ? (condoBlock / condoTotal) * 100 : 0;

  console.log("\n=== Geocode match report ===");
  console.log(`Direct PLUTO BBL match:       ${direct.toLocaleString()}`);
  console.log(`Condo -> block centroid:      ${condoBlock.toLocaleString()}`);
  console.log(`Unmatched:                    ${unmatched.toLocaleString()}`);
  console.log(`Overall match rate:           ${matchRate.toFixed(3)}%`);
  console.log(`Condo-lot bucket (lot>=1001): ${condoTotal.toLocaleString()} rows, ${condoMatchRate.toFixed(2)}% matched via block centroid`);
  if (unmatchedSample.length) console.log(`Sample unmatched BBLs: ${unmatchedSample.join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
