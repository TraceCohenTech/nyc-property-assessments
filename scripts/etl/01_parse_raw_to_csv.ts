// Step 1 of the ETL: stream both raw PROPMAST fixed-width/tab files, transform each row via
// transform.ts, and write a single clean CSV ready for bulk load into properties_v2.
//
// Usage: node --import tsx scripts/etl/01_parse_raw_to_csv.ts
//
// Inclusion rule (documented in DATA_DICTIONARY.md / DATA_QUALITY_REPORT.md): EVERY row in
// both source files is RECTYPE=1 (ordinary real estate; verified by direct inspection — no
// RECTYPE 2/3 REUC rows are present in either file), so the canonical set is simply "every row
// in PROPMAST_TC1_2027_FIN.txt + every row in PROPMAST_TC234_T2027_FIN.TXT" with no filtering.
// 706,713 (TC1) + 461,249 (TC234) = 1,167,962 rows, which matches the previously-verified
// canonical properties table row count exactly. transformRow() still defensively guards on
// RECTYPE===1 in case a future year's extract includes REUC rows.

import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { transformRow, type CleanRow } from "./transform.ts";

const SOURCES: { path: string; dataset: string }[] = [
  { path: "/Users/tracecohen/Downloads/PROPMAST_TC1_2027_FIN.txt", dataset: "PROPMAST_TC1_2027_FIN" },
  {
    path: "/Users/tracecohen/Downloads/fy27_tc234_extracted/PROPMAST_TC234_T2027_FIN.TXT",
    dataset: "PROPMAST_TC234_T2027_FIN",
  },
];

const OUT_DIR =
  "/private/tmp/claude-501/-Users-tracecohen/53b5d2a0-92e3-47c6-8be9-1fa515de539f/scratchpad/nyc_property_etl_v2";
const OUT_CSV = `${OUT_DIR}/properties_v2.csv`;

const COLUMNS: (keyof CleanRow)[] = [
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
  "value_per_resid_unit",
  "value_per_total_unit",
  "value_per_bldg_sqft",
  "coop_number",
  "source_year",
  "source_dataset",
];

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  await import("node:fs/promises").then((fs) => fs.mkdir(OUT_DIR, { recursive: true }));
  const out = createWriteStream(OUT_CSV);
  out.write(COLUMNS.join(",") + "\n");

  let total = 0;
  let skipped = 0;
  const dupBblFull = new Map<string, number>();

  for (const src of SOURCES) {
    console.log(`Reading ${src.path} ...`);
    const rl = createInterface({ input: createReadStream(src.path), crlfDelay: Infinity });
    let lineCount = 0;
    for await (const line of rl) {
      if (!line.trim()) continue;
      lineCount++;
      const fields = line.split("\t");
      const row = transformRow(fields, src.dataset);
      if (!row) {
        skipped++;
        continue;
      }
      dupBblFull.set(row.bbl_full, (dupBblFull.get(row.bbl_full) ?? 0) + 1);
      const csvLine = COLUMNS.map((c) => csvField(row[c])).join(",") + "\n";
      out.write(csvLine);
      total++;
      if (total % 100000 === 0) console.log(`  ${total} rows written...`);
    }
    console.log(`  ${src.dataset}: ${lineCount} lines read`);
  }

  out.end();
  await new Promise((resolve) => out.on("finish", resolve));

  const dupCount = [...dupBblFull.values()].filter((c) => c > 1).length;
  console.log(`Done. Total rows: ${total}, skipped: ${skipped}`);
  console.log(`Distinct bbl_full: ${dupBblFull.size}, still-duplicated bbl_full groups: ${dupCount}`);
  console.log(`CSV written to ${OUT_CSV}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
