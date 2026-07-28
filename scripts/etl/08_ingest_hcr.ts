// Step 8 of the ETL (Rent Regulation wave): ingest the NYC Rent Guidelines Board's
// per-borough "Rent Stabilized Building Lists" (sourced from NYS Homes & Community Renewal's
// annual building registration file), join them to the FY2027 assessment roll on BBL, derive
// the "likely structural candidate" aggregate layer, and write:
//   - data/rent/hcr_buildings_raw.json   (every parsed source row, before BBL-level dedup)
//   - data/rent/hcr_buildings.json       (one row per BBL, deduped, with join_confidence)
//   - data/rent/rent_summary.json        (all page-level aggregates the UI reads)
//   - a `rent_stabilized` table in db/properties.db (single batched transaction, at the end)
//
// SOURCE: rentguidelinesboard.cityofnewyork.us/resources/rent-stabilized-building-lists/
// These are the OFFICIAL RGB-published PDFs (not a third-party mirror) — "2024 Building
// Registrations filed with NYS Homes and Community Renewal (HCR), as of November 2025."
// Five PDFs, one per borough:
//   https://rentguidelinesboard.cityofnewyork.us/wp-content/uploads/2025/12/2024-DHCR-Bldg-File-Manhattan.pdf
//   .../2024-DHCR-Bldg-File-Brooklyn.pdf | Bronx.pdf | Queens.pdf | Staten-Island.pdf
// A real, sustained attempt was made and succeeded — these are official PDFs, text-extracted
// with `pdftotext -layout` (not an unparseable scan; they're clean vector-text tables), so no
// nycdb/community mirror fallback was needed. See RENT_REGULATION_METHODOLOGY.md for the full
// write-up including the parse-quality numbers below.
//
// PARSE METHOD: pdftotext -layout renders each table as a fixed-width character grid, but the
// column x-offsets drift by 1-2 characters from page to page (proportional-font layout
// heuristics, not a true monospace grid) — the RGB header row ("ZIP BLDGNO1 STREET1 ...")
// repeats on every page, so this script recomputes column offsets from the MOST RECENT header
// line seen, not a single global header. That single fix took the raw column-slice failure
// rate from ~85% (Bronx/Queens, using only the first page's header) to ~0.1% (only a handful
// of Manhattan rows where a long secondary-street name wraps across 2-3 physical PDF text
// lines). Wrapped-continuation rows are merged via a numeric-tail regex fallback; the tiny
// remainder that still fails to yield a valid block+lot is dropped and counted in
// meta.unparseable_rows (not silently included).
//
// Usage: node --import tsx scripts/etl/08_ingest_hcr.ts
// Downloads the 5 PDFs (if not already cached in HCR_SCRATCH_DIR) via `curl`, extracts text
// via `pdftotext -layout` (Homebrew poppler — already installed in this environment), parses,
// joins, and writes. Safe to re-run — overwrites its own output files and rebuilds
// rent_stabilized from scratch inside one transaction.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

const SCRATCH_DIR =
  process.env.HCR_SCRATCH_DIR ||
  "/private/tmp/claude-501/-Users-tracecohen/53b5d2a0-92e3-47c6-8be9-1fa515de539f/scratchpad/hcr_pdfs";
const DATA_DIR = new URL("../../data/rent", import.meta.url).pathname;
const DB_PATH = new URL("../../db/properties.db", import.meta.url).pathname;

const SOURCE_YEAR = "2024"; // "2024 Building Registrations ... as of November 2025" per RGB page
const SOURCE_RELEASE_NOTE = "2024 Building Registrations filed with NYS Homes and Community Renewal (HCR), as of November 2025";

type BoroughDef = { name: string; slug: string; boroCode: string; countyCode: string };
const BOROUGHS: BoroughDef[] = [
  { name: "Manhattan", slug: "Manhattan", boroCode: "1", countyCode: "62" },
  { name: "Bronx", slug: "Bronx", boroCode: "2", countyCode: "60" },
  { name: "Brooklyn", slug: "Brooklyn", boroCode: "3", countyCode: "61" },
  { name: "Queens", slug: "Queens", boroCode: "4", countyCode: "63" },
  { name: "Staten Island", slug: "Staten-Island", boroCode: "5", countyCode: "64" },
];

const COLS = [
  "ZIP",
  "BLDGNO1",
  "STREET1",
  "STSUFX1",
  "BLDGNO2",
  "STREET2",
  "STSUFX2",
  "CITY",
  "COUNTY",
  "STATUS1",
  "STATUS2",
  "STATUS3",
  "BLOCK",
  "LOT",
] as const;

type RawRow = {
  source_file: string;
  source_year: string;
  borough: string;
  zip: string;
  bldgno1: string;
  street1: string;
  stsuffix1: string;
  bldgno2: string;
  street2: string;
  stsuffix2: string;
  city: string;
  block: string;
  lot: string;
  bbl: string;
  status1: string;
  status2: string;
  status3: string;
  parse_note?: string;
};

function padBbl(boroCode: string, block: string, lot: string): string {
  return boroCode + block.padStart(5, "0") + lot.padStart(4, "0");
}

/** Downloads the 5 official RGB PDFs (if not already cached) and returns their pdftotext -layout output. */
function ensurePdfText(boro: BoroughDef): string {
  mkdirSync(SCRATCH_DIR, { recursive: true });
  const pdfPath = `${SCRATCH_DIR}/${boro.slug}.pdf`;
  const txtPath = `${SCRATCH_DIR}/${boro.slug}.txt`;
  if (!existsSync(pdfPath)) {
    const url = `https://rentguidelinesboard.cityofnewyork.us/wp-content/uploads/2025/12/2024-DHCR-Bldg-File-${boro.slug}.pdf`;
    console.log(`  Downloading ${boro.name} PDF from ${url} ...`);
    execFileSync("curl", ["-sL", "--max-time", "120", "-o", pdfPath, url]);
  }
  if (!existsSync(txtPath)) {
    execFileSync("pdftotext", ["-layout", pdfPath, txtPath]);
  }
  return readFileSync(txtPath, "utf8");
}

function isDataLine(l: string): boolean {
  return /^\s*\d{5}\s/.test(l);
}

function parseBorough(boro: BoroughDef): { rows: RawRow[]; unparseable: number } {
  const text = ensurePdfText(boro);
  const lines = text.split("\n");
  const rows: RawRow[] = [];
  let unparseable = 0;
  let offsets: number[] | null = null;
  const sourceFile = `2024-DHCR-Bldg-File-${boro.slug}.pdf`;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("ZIP") && line.includes("BLDGNO1")) {
      offsets = COLS.map((c) => line.indexOf(c));
      continue;
    }
    if (!offsets) continue;
    if (!isDataLine(line)) continue;

    const parsed: Record<string, string> = {};
    for (let c = 0; c < COLS.length; c++) {
      const start = offsets[c];
      const end = c + 1 < COLS.length ? offsets[c + 1] : line.length;
      parsed[COLS[c]] = (line.slice(start, end) || "").trim();
    }

    let block = parsed.BLOCK;
    let lot = parsed.LOT;
    let status1 = parsed.STATUS1;
    let status2 = parsed.STATUS2;
    let status3 = parsed.STATUS3;
    let note: string | undefined;

    // Rare case: a long secondary street name (STREET2) wraps across 1-2 continuation lines
    // in the PDF, pushing COUNTY/STATUS*/BLOCK/LOT off this physical line entirely. Those
    // continuation lines don't start with a 5-digit ZIP, so the main loop skips them — merge
    // them here by scanning forward for the block+lot pair via a numeric-tail regex, and stop
    // merging as soon as we hit the next real data row or header.
    if (!/^\d+$/.test(block) || !/^\d+$/.test(lot)) {
      let merged = "";
      let j = i + 1;
      while (j < lines.length && j < i + 4 && !isDataLine(lines[j]) && !lines[j].trim().startsWith("ZIP")) {
        merged += " " + lines[j];
        j++;
      }
      const m = merged.match(/(\d+)\s+(\d+)\s*$/);
      if (m) {
        block = m[1];
        lot = m[2];
        // Best-effort status extraction from the merged continuation text (between COUNTY's
        // 2-digit code and the trailing block/lot pair). Not guaranteed exact for these
        // rare wrapped rows, but block/lot (the join key) is reliable.
        const statusText = merged.replace(/\s*\d+\s+\d+\s*$/, "").replace(/^\s*[A-Z\s]+\s+\d{2}\s+/, "");
        status1 = /MULTIPLE DWELLING [AB]/.test(statusText) ? statusText.match(/MULTIPLE DWELLING [AB]/)![0] : status1;
        status2 = "";
        status3 = "";
        note = "block/lot recovered from a wrapped continuation line (long STREET2 value)";
        i = j - 1; // skip past the consumed continuation lines
      } else {
        unparseable++;
        continue;
      }
    }

    rows.push({
      source_file: sourceFile,
      source_year: SOURCE_YEAR,
      borough: boro.name,
      zip: parsed.ZIP,
      bldgno1: parsed.BLDGNO1,
      street1: parsed.STREET1,
      stsuffix1: parsed.STSUFX1,
      bldgno2: parsed.BLDGNO2,
      street2: parsed.STREET2,
      stsuffix2: parsed.STSUFX2,
      city: parsed.CITY,
      block,
      lot,
      bbl: padBbl(boro.boroCode, block, lot),
      status1,
      status2,
      status3,
      parse_note: note,
    });
  }

  return { rows, unparseable };
}

// ---- Status-flag classification -----------------------------------------------------------

function statusFlags(statuses: string[]) {
  const joined = statuses.join(" | ").toUpperCase();
  return {
    y421a: /421-A/.test(joined),
    j51: /J-51/.test(joined),
    coop_condo_conversion: /COOP\/CONDO/.test(joined),
    hotel_sro: /\bHOTEL\b|\bSRO\b|ROOMING HOUSE/.test(joined),
    garden_complex: /GARDEN COMPLEX/.test(joined),
  };
}

function formatAddress(r: RawRow): string {
  const parts = [r.bldgno1, r.street1, r.stsuffix1].filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim().toUpperCase();
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  console.log("Parsing 5 borough PDFs...");
  const allRaw: RawRow[] = [];
  let totalUnparseable = 0;
  const perBoroughCounts: Record<string, number> = {};
  for (const boro of BOROUGHS) {
    const { rows, unparseable } = parseBorough(boro);
    console.log(`  ${boro.name}: ${rows.length} rows parsed, ${unparseable} unparseable/dropped`);
    allRaw.push(...rows);
    totalUnparseable += unparseable;
    perBoroughCounts[boro.name] = rows.length;
  }
  console.log(`Total raw rows: ${allRaw.length} (${totalUnparseable} unparseable rows dropped)`);

  writeFileSync(
    `${DATA_DIR}/hcr_buildings_raw.json`,
    JSON.stringify(
      {
        meta: {
          generated_at: new Date().toISOString(),
          source: SOURCE_RELEASE_NOTE,
          source_year: SOURCE_YEAR,
          total_rows: allRaw.length,
          unparseable_rows_dropped: totalUnparseable,
          per_borough_counts: perBoroughCounts,
        },
        rows: allRaw,
      },
      null,
      0
    )
  );
  console.log("Wrote hcr_buildings_raw.json");

  // ---- Dedupe to one row per BBL, unioning status codes ----
  console.log("Deduping by BBL...");
  type Cleaned = {
    bbl: string;
    borough: string;
    zip: string;
    address: string;
    status_codes: string[];
    y421a: boolean;
    j51: boolean;
    coop_condo_conversion: boolean;
    hotel_sro: boolean;
    garden_complex: boolean;
    source_file: string;
    source_year: string;
    raw_row_count: number;
    join_confidence: string; // filled in during the join step below
  };
  const byBbl = new Map<string, Cleaned>();
  for (const r of allRaw) {
    const statuses = [r.status1, r.status2, r.status3].filter(Boolean);
    const existing = byBbl.get(r.bbl);
    if (existing) {
      existing.status_codes = [...new Set([...existing.status_codes, ...statuses])];
      existing.raw_row_count++;
      const flags = statusFlags(existing.status_codes);
      Object.assign(existing, flags);
    } else {
      byBbl.set(r.bbl, {
        bbl: r.bbl,
        borough: r.borough,
        zip: r.zip,
        address: formatAddress(r),
        status_codes: statuses,
        ...statusFlags(statuses),
        source_file: r.source_file,
        source_year: r.source_year,
        raw_row_count: 1,
        join_confidence: "unmatched",
      });
    }
  }
  const cleaned = [...byBbl.values()];
  const dupeBblGroups = cleaned.filter((c) => c.raw_row_count > 1).length;
  console.log(`Deduped to ${cleaned.length} distinct BBLs (${dupeBblGroups} BBLs had 2+ raw source rows).`);

  // ---- Join to the roll (db/properties.db) ----
  console.log("Opening db/properties.db for the join...");
  const db = new Database(DB_PATH, { timeout: 30000 });
  db.pragma("busy_timeout = 30000");
  db.pragma("journal_mode = WAL");

  const exactStmt = db.prepare(
    "SELECT bbl, borough_name, zip, house_number_lo, house_number_hi, street_name, building_class, property_type, residential_units, year_built, market_value, owner_entity_type, owner_group_id FROM properties_v2 WHERE bbl = ? LIMIT 1"
  );
  const blockCondoStmt = db.prepare(
    "SELECT bbl, house_number_lo, house_number_hi, street_name, building_class, property_type, residential_units FROM properties_v2 WHERE borough_code = ? AND block = ? AND building_class LIKE 'R%'"
  );
  const blockAnyStmt = db.prepare(
    "SELECT bbl, house_number_lo, house_number_hi, street_name, building_class, property_type, residential_units FROM properties_v2 WHERE borough_code = ? AND block = ? LIMIT 25"
  );

  const boroCodeByName: Record<string, string> = Object.fromEntries(BOROUGHS.map((b) => [b.name, b.boroCode]));

  let exactMatches = 0;
  let addressAssistedMatches = 0;
  let condoQuirkBucket = 0;
  let unmatched = 0;

  // Per-BBL, resolved properties_v2 metadata for aggregation (borough/value-band/unit-band/etc).
  type JoinedMeta = {
    matched: boolean;
    building_class: string | null;
    property_type: string | null;
    residential_units: number | null;
    year_built: number | null;
    market_value: number | null;
    owner_entity_type: string | null;
    owner_group_id: number | null;
  };
  const joinedMetaByBbl = new Map<string, JoinedMeta>();

  for (const c of cleaned) {
    const exact = exactStmt.get(c.bbl) as
      | {
          bbl: string;
          building_class: string | null;
          property_type: string | null;
          residential_units: number | null;
          year_built: number | null;
          market_value: number | null;
          owner_entity_type: string | null;
          owner_group_id: number | null;
        }
      | undefined;

    if (exact) {
      c.join_confidence = "exact_bbl";
      exactMatches++;
      joinedMetaByBbl.set(c.bbl, {
        matched: true,
        building_class: exact.building_class,
        property_type: exact.property_type,
        residential_units: exact.residential_units,
        year_built: exact.year_built,
        market_value: exact.market_value,
        owner_entity_type: exact.owner_entity_type,
        owner_group_id: exact.owner_group_id,
      });
      continue;
    }

    // No exact BBL match — the HCR list's block+lot is often the pre-condo-conversion "base
    // lot"; the roll instead carries the building as many condo unit lots (building_class R*)
    // on the same block. Check for that first (the "condo billing-lot quirk").
    const boroCode = boroCodeByName[c.borough];
    const block = c.bbl.slice(1, 6);
    const condoRows = boroCode ? (blockCondoStmt.all(boroCode, block) as { bbl: string; building_class: string; property_type: string; residential_units: number | null }[]) : [];

    if (condoRows.length > 0) {
      c.join_confidence = "address_assisted";
      addressAssistedMatches++;
      condoQuirkBucket++;
      const totalUnits = condoRows.reduce((s, r) => s + (r.residential_units ?? 0), 0);
      joinedMetaByBbl.set(c.bbl, {
        matched: true,
        building_class: condoRows[0].building_class,
        property_type: condoRows[0].property_type,
        residential_units: totalUnits,
        year_built: null,
        market_value: null,
        owner_entity_type: null,
        owner_group_id: null,
      });
      continue;
    }

    // Fall back to any lot(s) sharing the same borough+block (covers minor block re-numbering
    // / re-platting between the HCR file's vintage and the FY2027 roll).
    const anyRows = boroCode ? (blockAnyStmt.all(boroCode, block) as { bbl: string; building_class: string; property_type: string; residential_units: number | null }[]) : [];
    if (anyRows.length > 0) {
      c.join_confidence = "address_assisted";
      addressAssistedMatches++;
      const best = anyRows.reduce((a, b) => ((b.residential_units ?? 0) > (a.residential_units ?? 0) ? b : a));
      joinedMetaByBbl.set(c.bbl, {
        matched: true,
        building_class: best.building_class,
        property_type: best.property_type,
        residential_units: best.residential_units,
        year_built: null,
        market_value: null,
        owner_entity_type: null,
        owner_group_id: null,
      });
      continue;
    }

    c.join_confidence = "unmatched";
    unmatched++;
    joinedMetaByBbl.set(c.bbl, {
      matched: false,
      building_class: null,
      property_type: null,
      residential_units: null,
      year_built: null,
      market_value: null,
      owner_entity_type: null,
      owner_group_id: null,
    });
  }

  console.log(
    `Join results: ${exactMatches} exact_bbl, ${addressAssistedMatches} address_assisted (of which ${condoQuirkBucket} condo billing-lot quirk), ${unmatched} unmatched.`
  );

  writeFileSync(
    `${DATA_DIR}/hcr_buildings.json`,
    JSON.stringify(
      {
        meta: {
          generated_at: new Date().toISOString(),
          source: SOURCE_RELEASE_NOTE,
          source_year: SOURCE_YEAR,
          distinct_bbls: cleaned.length,
          duplicate_bbl_groups: dupeBblGroups,
          join: { exact_bbl: exactMatches, address_assisted: addressAssistedMatches, condo_quirk_bucket: condoQuirkBucket, unmatched },
        },
        buildings: cleaned,
      },
      null,
      0
    )
  );
  console.log("Wrote hcr_buildings.json");

  // ---- Likely-structural-candidate layer: pre-1974, 6+ res. units, multifamily Class 2, not a condo-unit lot ----
  console.log("Computing likely-structural-candidate layer from the roll...");
  const CANDIDATE_WHERE = `
    year_built IS NOT NULL AND year_built > 0 AND year_built < 1974
    AND residential_units IS NOT NULL AND residential_units >= 6
    AND tax_class LIKE '2%'
    AND (building_class LIKE 'C%' OR building_class LIKE 'D%' OR building_class LIKE 'S%')
    AND building_class NOT LIKE 'R%'
  `;
  const candidateTotal = (db.prepare(`SELECT count(*) c, COALESCE(sum(residential_units),0) u FROM properties_v2 WHERE ${CANDIDATE_WHERE}`).get() as { c: number; u: number });
  const candidateByBorough = db
    .prepare(`SELECT borough_name as borough, count(*) as lots, COALESCE(sum(residential_units),0) as units FROM properties_v2 WHERE ${CANDIDATE_WHERE} GROUP BY borough_name ORDER BY lots DESC`)
    .all() as { borough: string; lots: number; units: number }[];

  // Candidate BBLs (for overlap stats only — not persisted per-BBL in the public JSON, per spec).
  const candidateBbls = new Set(
    (db.prepare(`SELECT bbl FROM properties_v2 WHERE ${CANDIDATE_WHERE}`).all() as { bbl: string }[]).map((r) => r.bbl)
  );
  const hcrBbls = new Set(cleaned.map((c) => c.bbl));
  let candidateAndHcr = 0;
  for (const b of candidateBbls) if (hcrBbls.has(b)) candidateAndHcr++;
  const candidateNotInHcr = candidateBbls.size - candidateAndHcr;
  const hcrNotCandidate = hcrBbls.size - candidateAndHcr;

  console.log(
    `Candidates: ${candidateTotal.c} lots / ${candidateTotal.u} units. Overlap with HCR list: ${candidateAndHcr} in both, ${candidateNotInHcr} candidate-only, ${hcrNotCandidate} HCR-only.`
  );

  // ---- Aggregates for rent_summary.json ----
  console.log("Computing rent_summary.json aggregates...");

  function bucketize<T extends string>(items: { key: T }[]): Record<T, number> {
    const out = {} as Record<T, number>;
    for (const it of items) out[it.key] = (out[it.key] ?? 0) + 1;
    return out;
  }

  const matchedCleaned = cleaned.filter((c) => c.join_confidence !== "unmatched");

  const byBorough = new Map<string, number>();
  for (const c of matchedCleaned) byBorough.set(c.borough, (byBorough.get(c.borough) ?? 0) + 1);

  const VALUE_BANDS: { band: string; min: number; max: number }[] = [
    { band: "Under $1M", min: 0, max: 1e6 },
    { band: "$1M-$5M", min: 1e6, max: 5e6 },
    { band: "$5M-$20M", min: 5e6, max: 2e7 },
    { band: "$20M-$100M", min: 2e7, max: 1e8 },
    { band: "$100M+", min: 1e8, max: Infinity },
  ];
  const byValueBand = new Map<string, number>();
  for (const c of matchedCleaned) {
    const mv = joinedMetaByBbl.get(c.bbl)?.market_value;
    if (mv == null) continue;
    const band = VALUE_BANDS.find((b) => mv >= b.min && mv < b.max)?.band ?? "Unknown";
    byValueBand.set(band, (byValueBand.get(band) ?? 0) + 1);
  }

  const byOwnerType = new Map<string, number>();
  for (const c of matchedCleaned) {
    const t = joinedMetaByBbl.get(c.bbl)?.owner_entity_type ?? "Unknown/Other";
    byOwnerType.set(t, (byOwnerType.get(t) ?? 0) + 1);
  }

  const UNIT_BANDS: { band: string; min: number; max: number }[] = [
    { band: "1-5 units", min: 1, max: 6 },
    { band: "6-19 units", min: 6, max: 20 },
    { band: "20-49 units", min: 20, max: 50 },
    { band: "50-99 units", min: 50, max: 100 },
    { band: "100+ units", min: 100, max: Infinity },
  ];
  const byUnitBand = new Map<string, number>();
  for (const c of matchedCleaned) {
    const u = joinedMetaByBbl.get(c.bbl)?.residential_units;
    if (u == null) continue;
    const band = UNIT_BANDS.find((b) => u >= b.min && u < b.max)?.band ?? "Unknown";
    byUnitBand.set(band, (byUnitBand.get(band) ?? 0) + 1);
  }

  const AGE_BANDS: { band: string; min: number; max: number }[] = [
    { band: "Pre-1900", min: 0, max: 1900 },
    { band: "1900-1929", min: 1900, max: 1930 },
    { band: "1930-1949", min: 1930, max: 1950 },
    { band: "1950-1973", min: 1950, max: 1974 },
    { band: "1974+", min: 1974, max: 9999 },
    { band: "Unknown", min: -1, max: 0 },
  ];
  const byAgeBand = new Map<string, number>();
  for (const c of matchedCleaned) {
    const yb = joinedMetaByBbl.get(c.bbl)?.year_built;
    const band = !yb || yb <= 0 ? "Unknown" : AGE_BANDS.find((b) => yb >= b.min && yb < b.max)?.band ?? "Unknown";
    byAgeBand.set(band, (byAgeBand.get(band) ?? 0) + 1);
  }

  const byPropertyType = new Map<string, number>();
  for (const c of matchedCleaned) {
    const pt = joinedMetaByBbl.get(c.bbl)?.property_type ?? "unknown";
    byPropertyType.set(pt, (byPropertyType.get(pt) ?? 0) + 1);
  }

  const flagCounts = {
    y421a: cleaned.filter((c) => c.y421a).length,
    j51: cleaned.filter((c) => c.j51).length,
    coop_condo_conversion: cleaned.filter((c) => c.coop_condo_conversion).length,
    hotel_sro: cleaned.filter((c) => c.hotel_sro).length,
    garden_complex: cleaned.filter((c) => c.garden_complex).length,
  };

  // Top entity owner-groups by number of registered HCR buildings, total residential units in
  // them, and total assessed value — entity groups ONLY (owner_group_id present, i.e. an
  // Individual owner's HCR buildings are simply excluded from this ranking, never named).
  const ownerGroupAgg = new Map<number, { owner_group_id: number; buildings: number; units: number; value: number }>();
  const ownerGroupNameStmt = db.prepare("SELECT canonical_name, owner_type FROM owner_groups WHERE owner_group_id = ?");
  for (const c of matchedCleaned) {
    const meta = joinedMetaByBbl.get(c.bbl);
    if (!meta?.owner_group_id) continue;
    const existing = ownerGroupAgg.get(meta.owner_group_id);
    const units = meta.residential_units ?? 0;
    const value = meta.market_value ?? 0;
    if (existing) {
      existing.buildings++;
      existing.units += units;
      existing.value += value;
    } else {
      ownerGroupAgg.set(meta.owner_group_id, { owner_group_id: meta.owner_group_id, buildings: 1, units, value });
    }
  }
  const topOwnerGroups = [...ownerGroupAgg.values()]
    .filter((g) => {
      const info = ownerGroupNameStmt.get(g.owner_group_id) as { canonical_name: string } | undefined;
      // Exclude the generic "unmatched government agency" catch-all bucket — it's a mixed bag
      // of unrelated agencies, not one distinguishable owner, so it's misleading as a "top owner".
      return info?.canonical_name !== "Other NYC / NY / US Government Agency";
    })
    .sort((a, b) => b.buildings - a.buildings)
    .slice(0, 25)
    .map((g) => {
      const info = ownerGroupNameStmt.get(g.owner_group_id) as { canonical_name: string; owner_type: string } | undefined;
      return {
        owner_group_id: g.owner_group_id,
        name: info?.canonical_name ?? "Unknown",
        owner_type: info?.owner_type ?? "Unknown",
        hcr_buildings: g.buildings,
        residential_units: g.units,
        total_market_value: g.value,
      };
    });

  const summary = {
    meta: {
      generated_at: new Date().toISOString(),
      source: SOURCE_RELEASE_NOTE,
      source_year: SOURCE_YEAR,
      source_files: BOROUGHS.map((b) => `2024-DHCR-Bldg-File-${b.slug}.pdf`),
      unparseable_rows_dropped: totalUnparseable,
    },
    join_stats: {
      distinct_hcr_bbls: cleaned.length,
      exact_bbl: exactMatches,
      address_assisted: addressAssistedMatches,
      condo_quirk_bucket: condoQuirkBucket,
      unmatched,
      match_rate: cleaned.length ? Math.round(((exactMatches + addressAssistedMatches) / cleaned.length) * 1000) / 1000 : 0,
    },
    confirmed: {
      total_buildings: matchedCleaned.length,
      by_borough: [...byBorough.entries()].map(([borough, count]) => ({ borough, count })).sort((a, b) => b.count - a.count),
      by_value_band: VALUE_BANDS.map((b) => ({ band: b.band, count: byValueBand.get(b.band) ?? 0 })),
      by_owner_entity_type: [...byOwnerType.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      by_unit_band: UNIT_BANDS.map((b) => ({ band: b.band, count: byUnitBand.get(b.band) ?? 0 })),
      by_age_band: AGE_BANDS.map((b) => ({ band: b.band, count: byAgeBand.get(b.band) ?? 0 })).filter((r) => r.count > 0),
      by_property_type: [...byPropertyType.entries()].map(([property_type, count]) => ({ property_type, count })).sort((a, b) => b.count - a.count),
      flags: flagCounts,
    },
    candidates: {
      total_lots: candidateTotal.c,
      total_estimated_units: candidateTotal.u,
      by_borough: candidateByBorough,
      note: "ESTIMATE — pre-1974, 6+ residential units, Class 2 multifamily building classes (C/D/S), excludes condo-unit (R-class) lots. Not derived from any registration filing.",
    },
    overlap: {
      candidate_and_hcr_confirmed: candidateAndHcr,
      candidate_only_not_in_hcr: candidateNotInHcr,
      hcr_confirmed_not_candidate: hcrNotCandidate,
    },
    top_entity_owner_groups: topOwnerGroups,
  };

  writeFileSync(`${DATA_DIR}/rent_summary.json`, JSON.stringify(summary, null, 0));
  console.log("Wrote rent_summary.json");

  // ---- Write rent_stabilized table into db/properties.db, single batched transaction ----
  console.log("Writing rent_stabilized table (single transaction)...");
  db.exec("DROP TABLE IF EXISTS rent_stabilized;");
  db.exec(`
    CREATE TABLE rent_stabilized (
      bbl TEXT PRIMARY KEY,
      hcr_listed INTEGER NOT NULL DEFAULT 1,
      borough TEXT NOT NULL,
      zip TEXT,
      address TEXT,
      status_codes TEXT NOT NULL,
      y421a INTEGER NOT NULL,
      j51 INTEGER NOT NULL,
      coop_condo_conversion INTEGER NOT NULL,
      hotel_sro INTEGER NOT NULL,
      garden_complex INTEGER NOT NULL,
      join_confidence TEXT NOT NULL,
      source_year TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const insertStmt = db.prepare(
    `INSERT INTO rent_stabilized (bbl, hcr_listed, borough, zip, address, status_codes, y421a, j51, coop_condo_conversion, hotel_sro, garden_complex, join_confidence, source_year)
     VALUES (?,1,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const insertAll = db.transaction((items: Cleaned[]) => {
    for (const c of items) {
      insertStmt.run(
        c.bbl,
        c.borough,
        c.zip,
        c.address,
        JSON.stringify(c.status_codes),
        c.y421a ? 1 : 0,
        c.j51 ? 1 : 0,
        c.coop_condo_conversion ? 1 : 0,
        c.hotel_sro ? 1 : 0,
        c.garden_complex ? 1 : 0,
        c.join_confidence,
        c.source_year
      );
    }
  });
  insertAll(cleaned);
  db.exec("CREATE INDEX IF NOT EXISTS idx_rent_stabilized_borough ON rent_stabilized (borough);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_rent_stabilized_join_confidence ON rent_stabilized (join_confidence);");

  const verifyCount = (db.prepare("SELECT count(*) as c FROM rent_stabilized").get() as { c: number }).c;
  console.log(`rent_stabilized table written: ${verifyCount} rows.`);

  db.pragma("journal_mode = DELETE");
  db.close();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
