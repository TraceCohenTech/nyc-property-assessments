// Step 5 of the ETL (analytics-pages agent, Wave 3b): stream the FULL clean CSV (same file
// 04_build_aggregates.ts reads — produced by 01_parse_raw_to_csv.ts) and build the
// ENTITY-ONLY owner-profile dataset:
//   data/owners/index.json        — ranked list of the top ~500 consolidated owner groups
//   data/owners/[slug].json       — one full profile per owner group
//
// Privacy rule (hard): individual owners are NEVER named, ranked, or profiled. Only rows whose
// `owner_entity_type` column is one of the ELIGIBLE_ENTITY_TYPES below are ever grouped or
// written out. `Individual` and `Unknown/Other` rows are skipped entirely — they still show up
// in data/insights.json's ownership.by_entity_type aggregate (built by 04), just never here.
//
// Consolidation rules mirror OWNER_CONSOLIDATION_METHODOLOGY.md exactly:
//   - Government: matched against the curated scripts/etl/governmentGroups.ts list (18 named
//     agencies); anything Government-classified that doesn't hit a curated agency falls into a
//     generic "Other NYC / NY / US Government Agency" bucket (confidence: medium).
//   - Private entity types (LLC, Corporation, Partnership, Trust/Estate, Nonprofit/Institution,
//     Cooperative corporation, Housing company): grouped by an EXACT `owner_normalized` string
//     match only — never fuzzy, never by shared address/managing agent (confidence: high).
//
// Two-pass streaming design (memory-bounded): there are on the order of 250k-300k distinct
// entity owner groups citywide, but only ~500 make the published cut, and only those need full
// per-property detail (top-25 properties, alias frequency, distributions). So:
//   Pass 1 — stream once, accumulate ONLY lightweight totals (lots/value/units) per group key,
//            to determine the top-500 set by total market value.
//   Pass 2 — stream again, and for rows whose group key is IN the top-500 set, accumulate full
//            detail (aliases, distributions, top properties, zip spread).
//
// Usage: node --max-old-space-size=4096 --import tsx scripts/etl/05_build_owner_profiles.ts

import { createReadStream, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { createInterface } from "node:readline";
import { matchGovernmentGroup } from "./governmentGroups";
import { normalizeOwnerName } from "../../lib/owners/normalize";

const CSV_PATH =
  process.env.ETL_CSV_PATH ||
  "/private/tmp/claude-501/-Users-tracecohen/53b5d2a0-92e3-47c6-8be9-1fa515de539f/scratchpad/nyc_property_etl_v2/properties_v2.csv";

const REPO_ROOT = new URL("../../", import.meta.url);
const OWNERS_DIR = new URL("data/owners/", REPO_ROOT);
mkdirSync(OWNERS_DIR, { recursive: true });

const TOP_N_PUBLISHED = 500;
const TOP_PROPERTIES_PER_OWNER = 25;
const MAX_ALIASES_STORED = 60;
const MAX_ZIPS_STORED = 20;

// Entity types eligible to be grouped/ranked/published. Individual + Unknown/Other are
// deliberately excluded per the hard privacy rule.
const ELIGIBLE_ENTITY_TYPES = new Set([
  "LLC",
  "Corporation",
  "Partnership",
  "Trust/Estate",
  "Nonprofit/Institution",
  "Cooperative corporation",
  "Housing company",
]);

type Confidence = "high" | "medium" | "low";

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

function ageBucket(yb: number | null): string {
  if (!yb || yb <= 0) return "Unknown";
  if (yb < 1900) return "Pre-1900";
  if (yb < 1930) return "1900-1929";
  if (yb < 1945) return "1930-1944";
  if (yb < 1961) return "1945-1960";
  if (yb < 1974) return "1961-1973";
  if (yb < 2000) return "1974-1999";
  return "2000+";
}

function num(v: string): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Group-key + canonical-identity resolution for one row. Returns null for rows that must
 * never be grouped/ranked (Individual, Unknown/Other). */
function resolveGroup(
  ownerEntityType: string,
  ownerRaw: string,
  ownerNormalized: string
): { key: string; type: string; confidence: Confidence; evidence: string; fixedName?: string } | null {
  if (ownerEntityType === "Government") {
    const g = matchGovernmentGroup(ownerRaw.toUpperCase());
    if (g) return { key: `gov:${g.key}`, type: "Government", confidence: "high", evidence: "curated-agency-match", fixedName: g.canonicalName };
    return { key: "gov:other", type: "Government", confidence: "medium", evidence: "generic-government-fallback", fixedName: "Other NYC / NY / US Government Agency" };
  }
  if (ELIGIBLE_ENTITY_TYPES.has(ownerEntityType)) {
    if (!ownerNormalized) return null;
    return { key: `priv:${ownerEntityType}:${ownerNormalized}`, type: ownerEntityType, confidence: "high", evidence: "exact-normalized-match" };
  }
  return null; // Individual, Unknown/Other -> never grouped, never ranked, never profiled
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "owner";
}

// ---------------------------------------------------------------------------------------------
// PASS 1 — lightweight totals per group key, to pick the top-500 published set.
// ---------------------------------------------------------------------------------------------

type LightAcc = {
  key: string;
  type: string;
  confidence: Confidence;
  evidence: string;
  fixedName?: string;
  lots: number;
  total_market_value: number;
  total_assessed_value: number;
  residential_units: number;
  total_units: number;
  boroughs: Set<string>;
};

async function pass1(): Promise<Map<string, LightAcc>> {
  console.log(`[pass1] streaming ${CSV_PATH} for lightweight group totals...`);
  const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  let header: string[] | null = null;
  let idx: Record<string, number> = {};
  const acc = new Map<string, LightAcc>();
  let rows = 0;

  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = parseCsvLine(line);
      header.forEach((h, i) => (idx[h] = i));
      continue;
    }
    const f = parseCsvLine(line);
    rows++;
    if (rows % 200000 === 0) console.log(`[pass1] ${rows.toLocaleString()} rows...`);

    const ownerRaw = f[idx.owner_raw] ?? "";
    const ownerNormalized = f[idx.owner_normalized] ?? "";
    const ownerEntityType = f[idx.owner_entity_type] ?? "";
    const g = resolveGroup(ownerEntityType, ownerRaw, ownerNormalized);
    if (!g) continue;

    let a = acc.get(g.key);
    if (!a) {
      a = {
        key: g.key,
        type: g.type,
        confidence: g.confidence,
        evidence: g.evidence,
        fixedName: g.fixedName,
        lots: 0,
        total_market_value: 0,
        total_assessed_value: 0,
        residential_units: 0,
        total_units: 0,
        boroughs: new Set(),
      };
      acc.set(g.key, a);
    }
    a.lots++;
    a.total_market_value += num(f[idx.market_value]) ?? 0;
    a.total_assessed_value += num(f[idx.assessed_value]) ?? 0;
    a.residential_units += num(f[idx.residential_units]) ?? 0;
    a.total_units += num(f[idx.total_units]) ?? 0;
    a.boroughs.add(f[idx.borough_name] ?? "");
  }
  console.log(`[pass1] done. ${rows.toLocaleString()} rows, ${acc.size.toLocaleString()} distinct entity owner groups.`);
  return acc;
}

// ---------------------------------------------------------------------------------------------
// PASS 2 — full detail for the top-500 group keys only.
// ---------------------------------------------------------------------------------------------

type PropRow = {
  bbl: string;
  address: string;
  borough: string;
  market_value: number;
  residential_units: number;
  total_units: number;
  building_class: string;
};

type FullAcc = LightAcc & {
  aliasCounts: Map<string, number>;
  boroughDist: Map<string, { lots: number; total_market_value: number }>;
  propertyTypeDist: Map<string, number>;
  taxClassDist: Map<string, number>;
  valueBandDist: Map<string, number>;
  yearBuiltDist: Map<string, number>;
  zipCounts: Map<string, number>;
  topProperties: PropRow[]; // kept sorted desc by market_value, capped at TOP_PROPERTIES_PER_OWNER
};

function insertTopProperty(list: PropRow[], row: PropRow) {
  if (list.length < TOP_PROPERTIES_PER_OWNER) {
    list.push(row);
    list.sort((a, b) => b.market_value - a.market_value);
    return;
  }
  if (row.market_value > list[list.length - 1].market_value) {
    list[list.length - 1] = row;
    list.sort((a, b) => b.market_value - a.market_value);
  }
}

async function pass2(topKeys: Set<string>, seed: Map<string, LightAcc>): Promise<Map<string, FullAcc>> {
  console.log(`[pass2] streaming ${CSV_PATH} again for full detail on ${topKeys.size} groups...`);
  const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  let header: string[] | null = null;
  let idx: Record<string, number> = {};
  const acc = new Map<string, FullAcc>();
  let rows = 0;

  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = parseCsvLine(line);
      header.forEach((h, i) => (idx[h] = i));
      continue;
    }
    const f = parseCsvLine(line);
    rows++;
    if (rows % 200000 === 0) console.log(`[pass2] ${rows.toLocaleString()} rows...`);

    const ownerRaw = f[idx.owner_raw] ?? "";
    const ownerNormalized = f[idx.owner_normalized] ?? "";
    const ownerEntityType = f[idx.owner_entity_type] ?? "";
    const g = resolveGroup(ownerEntityType, ownerRaw, ownerNormalized);
    if (!g || !topKeys.has(g.key)) continue;

    let a = acc.get(g.key);
    if (!a) {
      const base = seed.get(g.key)!;
      a = {
        ...base,
        boroughs: new Set(),
        aliasCounts: new Map(),
        boroughDist: new Map(),
        propertyTypeDist: new Map(),
        taxClassDist: new Map(),
        valueBandDist: new Map(),
        yearBuiltDist: new Map(),
        zipCounts: new Map(),
        topProperties: [],
        lots: 0,
        total_market_value: 0,
        total_assessed_value: 0,
        residential_units: 0,
        total_units: 0,
      };
      acc.set(g.key, a);
    }

    const marketValue = num(f[idx.market_value]) ?? 0;
    const residUnits = num(f[idx.residential_units]) ?? 0;
    const totalUnits = num(f[idx.total_units]) ?? 0;
    const borough = f[idx.borough_name] ?? "";
    const yearBuilt = num(f[idx.year_built]);
    const propertyType = f[idx.property_type] || "Unknown";
    const taxClass = f[idx.tax_class] || "Unknown";
    const valueBand = f[idx.value_band] || "Unknown";
    const zip = f[idx.zip] || "";

    a.lots++;
    a.total_market_value += marketValue;
    a.total_assessed_value += num(f[idx.assessed_value]) ?? 0;
    a.residential_units += residUnits;
    a.total_units += totalUnits;
    a.boroughs.add(borough);

    a.aliasCounts.set(ownerRaw, (a.aliasCounts.get(ownerRaw) ?? 0) + 1);

    const bd = a.boroughDist.get(borough) ?? { lots: 0, total_market_value: 0 };
    bd.lots++;
    bd.total_market_value += marketValue;
    a.boroughDist.set(borough, bd);

    a.propertyTypeDist.set(propertyType, (a.propertyTypeDist.get(propertyType) ?? 0) + 1);
    a.taxClassDist.set(taxClass, (a.taxClassDist.get(taxClass) ?? 0) + 1);
    a.valueBandDist.set(valueBand, (a.valueBandDist.get(valueBand) ?? 0) + 1);
    a.yearBuiltDist.set(ageBucket(yearBuilt), (a.yearBuiltDist.get(ageBucket(yearBuilt)) ?? 0) + 1);
    if (zip) a.zipCounts.set(zip, (a.zipCounts.get(zip) ?? 0) + 1);

    insertTopProperty(a.topProperties, {
      bbl: f[idx.bbl_full] || f[idx.bbl] || "",
      address: f[idx.full_address] || "",
      borough,
      market_value: marketValue,
      residential_units: residUnits,
      total_units: totalUnits,
      building_class: f[idx.building_class] || "",
    });
  }
  console.log(`[pass2] done. ${rows.toLocaleString()} rows scanned, ${acc.size} groups fully detailed.`);
  return acc;
}

// ---------------------------------------------------------------------------------------------
// Assemble + write
// ---------------------------------------------------------------------------------------------

function sortedEntries<T extends { lots?: number }>(m: Map<string, number>): { key: string; lots: number }[] {
  return [...m.entries()].map(([key, lots]) => ({ key, lots })).sort((a, b) => b.lots - a.lots);
}

async function main() {
  const seed = await pass1();

  // Rank all groups by total market value; take the top N as the published set. This mirrors
  // the site's other "top owners" rankings (data/aggregates.json's top_owners) and naturally
  // pulls in the big curated government agencies alongside large private entities.
  const ranked = [...seed.values()].sort((a, b) => b.total_market_value - a.total_market_value);
  const top = ranked.slice(0, TOP_N_PUBLISHED);
  const topKeys = new Set(top.map((a) => a.key));

  const full = await pass2(topKeys, seed);

  // Assign canonical display names + stable slugs (most-frequent raw alias by lot count for
  // private groups; fixed curated name for government groups), then dedupe slug collisions.
  const usedSlugs = new Map<string, number>();
  const indexRows: Record<string, unknown>[] = [];
  // normalized-owner-name -> slug, so any raw owner string seen elsewhere on the site (e.g. a
  // borough page's unconsolidated top_entity_owners list) can be cross-linked to a full profile
  // when it's one of this group's known aliases.
  const aliasIndex: Record<string, string> = {};

  for (const key of topKeys) {
    const a = full.get(key);
    if (!a) continue; // shouldn't happen, but stay defensive

    let name = a.fixedName;
    if (!name) {
      const aliasesSorted = [...a.aliasCounts.entries()].sort((x, y) => y[1] - x[1]);
      name = aliasesSorted[0]?.[0] ?? key;
    }

    let baseSlug = slugify(name);
    const n = usedSlugs.get(baseSlug) ?? 0;
    usedSlugs.set(baseSlug, n + 1);
    const slug = n === 0 ? baseSlug : `${baseSlug}-${n + 1}`;

    // ASSERTION: entity-groups-only guard. Government + the eligible private entity-type list
    // are the only types that can ever reach this point — Individual/Unknown/Other rows were
    // filtered out in resolveGroup() during both passes. This throws (fails the build) rather
    // than silently shipping a violation if that invariant is ever broken by a future edit.
    if (a.type === "Individual" || a.type === "Unknown/Other") {
      throw new Error(`Privacy invariant violated: group "${name}" (${key}) classified as ${a.type} reached owner-profile output.`);
    }

    const aliasesSorted = [...a.aliasCounts.entries()].sort((x, y) => y[1] - x[1]);
    const aliases = aliasesSorted.slice(0, MAX_ALIASES_STORED).map(([raw, lots]) => ({ raw, lots }));

    const boroughDistribution = [...a.boroughDist.entries()]
      .map(([borough, v]) => ({ borough, lots: v.lots, total_market_value: v.total_market_value }))
      .sort((x, y) => y.lots - x.lots);

    const propertyTypeDistribution = [...a.propertyTypeDist.entries()]
      .map(([property_type, lots]) => ({ property_type, lots }))
      .sort((x, y) => y.lots - x.lots);

    const taxClassDistribution = [...a.taxClassDist.entries()]
      .map(([tax_class, lots]) => ({ tax_class, lots }))
      .sort((x, y) => y.lots - x.lots);

    const valueBandDistribution = [...a.valueBandDist.entries()]
      .map(([band, lots]) => ({ band, lots }))
      .sort((x, y) => y.lots - x.lots);

    const yearBuiltDistribution = [...a.yearBuiltDist.entries()]
      .map(([bucket, lots]) => ({ bucket, lots }))
      .sort((x, y) => y.lots - x.lots);

    const zipSpread = [...a.zipCounts.entries()]
      .map(([zip, lots]) => ({ zip, lots }))
      .sort((x, y) => y.lots - x.lots)
      .slice(0, MAX_ZIPS_STORED);

    const profile = {
      slug,
      name,
      owner_type: a.type,
      confidence: a.confidence,
      evidence: a.evidence,
      alias_count: a.aliasCounts.size,
      aliases,
      totals: {
        lots: a.lots,
        total_market_value: a.total_market_value,
        total_assessed_value: a.total_assessed_value,
        residential_units: a.residential_units,
        total_units: a.total_units,
        borough_count: a.boroughDist.size,
      },
      borough_distribution: boroughDistribution,
      property_type_distribution: propertyTypeDistribution,
      tax_class_distribution: taxClassDistribution,
      value_band_distribution: valueBandDistribution,
      year_built_distribution: yearBuiltDistribution,
      zip_spread: zipSpread,
      top_properties: a.topProperties.map((p) => ({
        bbl: p.bbl,
        address: p.address,
        borough: p.borough,
        market_value: p.market_value,
        residential_units: p.residential_units,
        total_units: p.total_units,
        building_class: p.building_class,
      })),
      meta: { generated_at: new Date().toISOString() },
    };

    writeFileSync(new URL(`${slug}.json`, OWNERS_DIR), JSON.stringify(profile));

    indexRows.push({
      slug,
      name,
      owner_type: a.type,
      confidence: a.confidence,
      lots: a.lots,
      total_market_value: a.total_market_value,
      total_assessed_value: a.total_assessed_value,
      residential_units: a.residential_units,
      total_units: a.total_units,
      borough_count: a.boroughDist.size,
      boroughs: boroughDistribution.map((b) => b.borough),
    });

    for (const alias of a.aliasCounts.keys()) {
      aliasIndex[normalizeOwnerName(alias)] = slug;
    }
    aliasIndex[normalizeOwnerName(name)] = slug;
  }

  indexRows.sort((x, y) => (y.total_market_value as number) - (x.total_market_value as number));

  // Clean up any stale profile files from a previous run whose owner no longer makes the cut
  // (slug scheme is stable across runs given identical input, so this only matters after data
  // changes shrink/reshuffle the top-500 set).
  const keepFiles = new Set([...indexRows.map((r) => `${r.slug}.json`), "index.json", "alias-index.json"]);
  for (const f of readdirSync(OWNERS_DIR)) {
    if (!keepFiles.has(f)) unlinkSync(new URL(f, OWNERS_DIR));
  }

  writeFileSync(
    new URL("index.json", OWNERS_DIR),
    JSON.stringify({
      meta: {
        generated_at: new Date().toISOString(),
        source_row_count: 1_167_962,
        method_note:
          "Government owners consolidated via a curated 18-agency list (governmentGroups.ts); private entities (LLC/Corporation/Partnership/Trust-Estate/Nonprofit/Cooperative corporation/Housing company) consolidated by exact owner_normalized string match only. Individual and Unknown/Other owners are never grouped, ranked, or profiled — see OWNER_CONSOLIDATION_METHODOLOGY.md.",
      },
      owners: indexRows,
    })
  );

  writeFileSync(new URL("alias-index.json", OWNERS_DIR), JSON.stringify(aliasIndex));

  console.log(`Wrote data/owners/index.json + ${indexRows.length} profile files + alias-index.json (${Object.keys(aliasIndex).length} aliases).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
