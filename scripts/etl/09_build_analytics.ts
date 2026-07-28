// Step 9 of the ETL: build the citywide analytics layer consumed by the upcoming
// analytics/insight pages (tax burden, treemap, timeline, exemptions, $/sqft, extremes,
// zip league table, ownership concentration, rent-stabilization overlays, and a curated
// "story pack" for a scrollytelling page).
//
// Reads ONLY from db/properties.db (properties_v2, owner_groups, rent_stabilized) — no writes
// to the DB, no touching app/components/lib/explorer. Writes one JSON per feature to
// data/analytics/, plus data/analytics/README.md documenting schema + derivation + exclusions.
//
// PRIVACY RULE (hard): every owner-level output field is ENTITY-only. A property row is only
// attributed to an owner when it has a non-null owner_group_id (which — by construction in
// scripts/etl/05_build_owner_profiles.ts — is never assigned to Individual or Unknown/Other
// owners; see OWNER_CONSOLIDATION_METHODOLOGY.md). No individual's name ever appears in any
// output file. Aggregate counts/sums bucketed by owner_entity_type (including "Individual") are
// fine — those are never a name, just a count.
//
// Usage: node --import tsx scripts/etl/09_build_analytics.ts

import { mkdirSync, writeFileSync } from "node:fs";
import Database from "better-sqlite3";

const DB_PATH = new URL("../../db/properties.db", import.meta.url).pathname;
const OUT_DIR = new URL("../../data/analytics", import.meta.url).pathname;

mkdirSync(OUT_DIR, { recursive: true });

const db = new Database(DB_PATH, { readonly: true });
db.pragma("query_only = ON");

// ---------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * frac;
}

function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const BASE_CLASS_LABEL: Record<string, string> = {
  "1": "Class 1", "1A": "Class 1", "1B": "Class 1", "1C": "Class 1", "1D": "Class 1",
  "2": "Class 2", "2A": "Class 2", "2B": "Class 2", "2C": "Class 2",
  "3": "Class 3",
  "4": "Class 4",
};
function baseClassFamily(taxClass: string): string {
  return taxClass?.[0] ?? "?";
}

const DECADE_ORDER = [
  "<1900", "1900s", "1910s", "1920s", "1930s", "1940s", "1950s", "1960s", "1970s",
  "1980s", "1990s", "2000s", "2010s", "2020s", "Unknown",
];
function decadeBucket(yearBuilt: number | null): string {
  if (!yearBuilt || yearBuilt <= 0) return "Unknown";
  if (yearBuilt < 1900) return "<1900";
  const decade = Math.floor(yearBuilt / 10) * 10;
  return `${decade}s`;
}

const meta = {
  generated_at: new Date().toISOString(),
  source: "properties_v2 / owner_groups / rent_stabilized in db/properties.db (FY2027 DOF PTS roll + HCR 2024 building registrations)",
};

// ---------------------------------------------------------------------------------------------
// Citywide baseline (for validation against data/aggregates.json)
// ---------------------------------------------------------------------------------------------

const citywide = db
  .prepare(
    `SELECT COUNT(*) n, SUM(market_value) mv, SUM(assessed_value) av, SUM(taxable_value) tv, SUM(exempt_value) ev
     FROM properties_v2`
  )
  .get() as { n: number; mv: number; av: number; tv: number; ev: number };

console.log("Citywide baseline:", citywide);

const README_SECTIONS: string[] = [];

// ===============================================================================================
// 1. tax_burden.json
// ===============================================================================================
function buildTaxBurden() {
  const rows = db
    .prepare(
      `SELECT tax_class, borough_name, market_value, assessed_value, taxable_value
       FROM properties_v2 WHERE market_value > 0`
    )
    .all() as { tax_class: string; borough_name: string; market_value: number; assessed_value: number; taxable_value: number }[];

  type Acc = { n: number; mv: number; av: number; tv: number; ratios: number[] };
  const byClass = new Map<string, Acc>();
  const byClassBorough = new Map<string, Acc>();
  const byFamily = new Map<string, Acc>();
  const byFamilyBorough = new Map<string, Acc>();

  const bump = (map: Map<string, Acc>, key: string, r: typeof rows[number]) => {
    let a = map.get(key);
    if (!a) { a = { n: 0, mv: 0, av: 0, tv: 0, ratios: [] }; map.set(key, a); }
    a.n++; a.mv += r.market_value; a.av += r.assessed_value; a.tv += r.taxable_value;
    a.ratios.push(r.assessed_value / r.market_value);
  };

  for (const r of rows) {
    bump(byClass, r.tax_class, r);
    bump(byClassBorough, `${r.tax_class}|${r.borough_name}`, r);
    const fam = baseClassFamily(r.tax_class);
    bump(byFamily, fam, r);
    bump(byFamilyBorough, `${fam}|${r.borough_name}`, r);
  }

  const summarize = (a: Acc) => {
    a.ratios.sort((x, y) => x - y);
    return {
      count: a.n,
      total_market_value: a.mv,
      total_assessed_value: a.av,
      total_taxable_value: a.tv,
      citywide_assessed_to_market_ratio: round(a.av / a.mv),
      citywide_taxable_to_market_ratio: round(a.tv / a.mv),
      median_per_lot_assessed_to_market_ratio: round(percentile(a.ratios, 0.5)),
      p10_per_lot_ratio: round(percentile(a.ratios, 0.1)),
      p25_per_lot_ratio: round(percentile(a.ratios, 0.25)),
      p75_per_lot_ratio: round(percentile(a.ratios, 0.75)),
      p90_per_lot_ratio: round(percentile(a.ratios, 0.9)),
    };
  };

  const by_tax_class = [...byClass.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tax_class, a]) => ({ tax_class, base_class_family: baseClassFamily(tax_class), ...summarize(a) }));

  const by_base_class_family = [...byFamily.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([family, a]) => ({ base_class_family: family, label: BASE_CLASS_LABEL[family + "0"]?.replace("0", "") ?? `Class ${family}`, ...summarize(a) }));

  const matrix_by_tax_class_borough = [...byClassBorough.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, a]) => {
      const [tax_class, borough] = key.split("|");
      return { tax_class, borough, ...summarize(a) };
    });

  const matrix_by_family_borough = [...byFamilyBorough.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, a]) => {
      const [family, borough] = key.split("|");
      return { base_class_family: family, borough, ...summarize(a) };
    });

  const c1 = byFamily.get("1")!, c2 = byFamily.get("2")!, c4 = byFamily.get("4")!;
  const class1Ratio = c1.av / c1.mv, class2Ratio = c2.av / c2.mv, class4Ratio = c4.av / c4.mv;

  const out = {
    meta: {
      ...meta,
      description: "Effective assessment ratios (assessed/market and taxable/market) by tax class and borough, plus per-lot ratio distributions.",
      caption: `Class 1 (1-3 family homes) assesses at ~${round(class1Ratio * 100, 1)}% of market value, vs Class 2 (apartments/co-ops/condos) at ~${round(class2Ratio * 100, 1)}% and Class 4 (commercial) at ~${round(class4Ratio * 100, 1)}% — a structural gap set by NY State's assessment-ratio caps (RPTL 1805), not by market conditions.`,
      exclusions: "Rows with market_value <= 0 excluded (would make ratio undefined/infinite).",
    },
    citywide_by_base_class_family: by_base_class_family,
    citywide_by_tax_class: by_tax_class,
    matrix_by_tax_class_x_borough: matrix_by_tax_class_borough,
    matrix_by_family_x_borough: matrix_by_family_borough,
  };
  writeFileSync(`${OUT_DIR}/tax_burden.json`, JSON.stringify(out));
  return { out, class1Ratio, class2Ratio, class4Ratio };
}

// ===============================================================================================
// 2. treemap.json
// ===============================================================================================
function buildTreemap() {
  const rows = db
    .prepare(
      `SELECT borough_name, property_type, building_class, COUNT(*) lots, SUM(market_value) mv
       FROM properties_v2
       WHERE building_class IS NOT NULL
       GROUP BY borough_name, property_type, building_class`
    )
    .all() as { borough_name: string; property_type: string; building_class: string; lots: number; mv: number }[];

  const PRUNE_THRESHOLD = 100_000_000; // $100M

  type Node = { name: string; lots: number; market_value: number; children?: Node[] };
  const boroughMap = new Map<string, Map<string, { lots: number; mv: number; classes: { name: string; lots: number; mv: number }[] }>>();

  for (const r of rows) {
    if (!boroughMap.has(r.borough_name)) boroughMap.set(r.borough_name, new Map());
    const ptMap = boroughMap.get(r.borough_name)!;
    if (!ptMap.has(r.property_type)) ptMap.set(r.property_type, { lots: 0, mv: 0, classes: [] });
    const pt = ptMap.get(r.property_type)!;
    pt.lots += r.lots;
    pt.mv += r.mv;
    pt.classes.push({ name: r.building_class, lots: r.lots, mv: r.mv });
  }

  const tree: Node[] = [];
  for (const [borough, ptMap] of boroughMap) {
    const children: Node[] = [];
    for (const [propertyType, pt] of ptMap) {
      const kept: Node[] = [];
      let otherLots = 0, otherMv = 0;
      for (const c of pt.classes.sort((a, b) => b.mv - a.mv)) {
        if (c.mv >= PRUNE_THRESHOLD) {
          kept.push({ name: c.name, lots: c.lots, market_value: c.mv });
        } else {
          otherLots += c.lots;
          otherMv += c.mv;
        }
      }
      if (otherLots > 0) kept.push({ name: "Other", lots: otherLots, market_value: otherMv });
      children.push({ name: propertyType, lots: pt.lots, market_value: pt.mv, children: kept });
    }
    children.sort((a, b) => b.market_value - a.market_value);
    tree.push({
      name: borough,
      lots: children.reduce((s, c) => s + c.lots, 0),
      market_value: children.reduce((s, c) => s + c.market_value, 0),
      children,
    });
  }
  tree.sort((a, b) => b.market_value - a.market_value);

  const out = {
    meta: {
      ...meta,
      description: "Hierarchy: borough -> property_type -> building_class, each node carrying {name, lots, market_value}.",
      exclusions: "Rows with building_class NULL excluded. Building-class leaves under a given borough/property_type parent with market_value < $100,000,000 are collapsed into a per-parent 'Other' leaf to keep node count sane.",
      prune_threshold_usd: PRUNE_THRESHOLD,
    },
    root: { name: "NYC", lots: citywide.n, market_value: citywide.mv, children: tree },
  };
  writeFileSync(`${OUT_DIR}/treemap.json`, JSON.stringify(out));
  return out;
}

// ===============================================================================================
// 3. timeline.json
// ===============================================================================================
function buildTimeline() {
  const rows = db
    .prepare(`SELECT year_built, borough_name, property_type, residential_units, market_value FROM properties_v2`)
    .all() as { year_built: number | null; borough_name: string; property_type: string; residential_units: number | null; market_value: number | null }[];

  type Acc = { lots: number; residential_units: number; market_value: number; byBorough: Map<string, { lots: number; market_value: number }>; byPropertyType: Map<string, number> };
  const byDecade = new Map<string, Acc>();

  for (const r of rows) {
    const decade = decadeBucket(r.year_built);
    let a = byDecade.get(decade);
    if (!a) { a = { lots: 0, residential_units: 0, market_value: 0, byBorough: new Map(), byPropertyType: new Map() }; byDecade.set(decade, a); }
    a.lots++;
    a.residential_units += r.residential_units ?? 0;
    a.market_value += r.market_value ?? 0;
    const bb = a.byBorough.get(r.borough_name) ?? { lots: 0, market_value: 0 };
    bb.lots++; bb.market_value += r.market_value ?? 0;
    a.byBorough.set(r.borough_name, bb);
    a.byPropertyType.set(r.property_type, (a.byPropertyType.get(r.property_type) ?? 0) + 1);
  }

  const decades = DECADE_ORDER.filter((d) => byDecade.has(d)).map((decade) => {
    const a = byDecade.get(decade)!;
    const dominant = [...a.byPropertyType.entries()].sort((x, y) => y[1] - x[1])[0];
    return {
      decade,
      lots: a.lots,
      residential_units: a.residential_units,
      total_market_value: a.market_value,
      by_borough: [...a.byBorough.entries()]
        .sort((x, y) => y[1].market_value - x[1].market_value)
        .map(([borough, v]) => ({ borough, lots: v.lots, market_value: v.market_value })),
      dominant_property_type: dominant ? { property_type: dominant[0], lots: dominant[1] } : null,
    };
  });

  const out = {
    meta: {
      ...meta,
      description: "Per-construction-decade lot counts, residential units, market value (stacked by borough), and the dominant property type built that decade.",
      exclusions: "None — every row is bucketed, including year_built NULL/0 into 'Unknown'. '<1900' aggregates all pre-1900 construction (sparse, long tail back to 1540 per DATA_QUALITY_REPORT.md guard range).",
    },
    decades,
  };
  writeFileSync(`${OUT_DIR}/timeline.json`, JSON.stringify(out));
  return out;
}

// ===============================================================================================
// 4. exemptions.json
// ===============================================================================================
function buildExemptions() {
  const byBorough = db
    .prepare(
      `SELECT borough_name, SUM(exempt_value) exempt, SUM(taxable_value) taxable, SUM(market_value) market, SUM(assessed_value) assessed
       FROM properties_v2 GROUP BY borough_name`
    )
    .all() as { borough_name: string; exempt: number; taxable: number; market: number; assessed: number }[];

  const byTaxClass = db
    .prepare(
      `SELECT tax_class, SUM(exempt_value) exempt, SUM(taxable_value) taxable, SUM(market_value) market, SUM(assessed_value) assessed
       FROM properties_v2 GROUP BY tax_class`
    )
    .all() as { tax_class: string; exempt: number; taxable: number; market: number; assessed: number }[];

  const byEntityType = db
    .prepare(
      `SELECT owner_entity_type, COUNT(*) n, SUM(exempt_value) exempt, SUM(taxable_value) taxable, SUM(market_value) market, SUM(assessed_value) assessed
       FROM properties_v2 GROUP BY owner_entity_type`
    )
    .all() as { owner_entity_type: string; n: number; exempt: number; taxable: number; market: number; assessed: number }[];

  const privateAgg = byEntityType
    .filter((r) => r.owner_entity_type !== "Government" && r.owner_entity_type !== "Nonprofit/Institution")
    .reduce(
      (acc, r) => ({ n: acc.n + r.n, exempt: acc.exempt + r.exempt, taxable: acc.taxable + r.taxable, market: acc.market + r.market, assessed: acc.assessed + r.assessed }),
      { n: 0, exempt: 0, taxable: 0, market: 0, assessed: 0 }
    );

  const topExemptOwners = db
    .prepare(
      `SELECT og.owner_group_id, og.canonical_name, og.owner_type,
              COUNT(*) lots, SUM(p.exempt_value) exempt, SUM(p.market_value) market
       FROM properties_v2 p JOIN owner_groups og ON p.owner_group_id = og.owner_group_id
       GROUP BY og.owner_group_id
       ORDER BY exempt DESC
       LIMIT 20`
    )
    .all() as { owner_group_id: number; canonical_name: string; owner_type: string; lots: number; exempt: number; market: number }[];

  const out = {
    meta: {
      ...meta,
      description: "Exempt vs taxable value by borough / tax class / owner entity type, top 20 ENTITY owner groups by total exempt value, and value-exempt share per borough.",
      exclusions: "Top-owner list restricted to rows with a non-null owner_group_id — by construction (OWNER_CONSOLIDATION_METHODOLOGY.md) this is never assigned to Individual or Unknown/Other owners, so it's entity-only. No individual names anywhere in this file.",
    },
    by_borough: byBorough.map((r) => ({
      borough: r.borough_name,
      exempt_value: r.exempt,
      taxable_value: r.taxable,
      market_value: r.market,
      assessed_value: r.assessed,
      share_of_value_exempt: round(r.exempt / (r.exempt + r.taxable)),
    })),
    by_tax_class: byTaxClass.map((r) => ({
      tax_class: r.tax_class,
      exempt_value: r.exempt,
      taxable_value: r.taxable,
      market_value: r.market,
      share_of_value_exempt: round(r.exempt / (r.exempt + r.taxable)),
    })),
    by_owner_entity_type: byEntityType.map((r) => ({
      owner_entity_type: r.owner_entity_type,
      lots: r.n,
      exempt_value: r.exempt,
      taxable_value: r.taxable,
      market_value: r.market,
      share_of_value_exempt: round(r.exempt / (r.exempt + r.taxable)),
    })),
    government_nonprofit_vs_private: {
      government_and_nonprofit: (() => {
        const g = byEntityType.find((r) => r.owner_entity_type === "Government")!;
        const np = byEntityType.find((r) => r.owner_entity_type === "Nonprofit/Institution")!;
        const exempt = g.exempt + np.exempt, taxable = g.taxable + np.taxable, market = g.market + np.market;
        return { lots: g.n + np.n, exempt_value: exempt, taxable_value: taxable, market_value: market, share_of_value_exempt: round(exempt / (exempt + taxable)) };
      })(),
      private_aggregate: {
        lots: privateAgg.n,
        exempt_value: privateAgg.exempt,
        taxable_value: privateAgg.taxable,
        market_value: privateAgg.market,
        share_of_value_exempt: round(privateAgg.exempt / (privateAgg.exempt + privateAgg.taxable)),
      },
    },
    top_20_exempt_entity_owner_groups: topExemptOwners.map((r) => ({
      owner_group_id: r.owner_group_id,
      name: r.canonical_name,
      owner_type: r.owner_type,
      lots: r.lots,
      total_exempt_value: r.exempt,
      total_market_value: r.market,
    })),
  };
  writeFileSync(`${OUT_DIR}/exemptions.json`, JSON.stringify(out));
  return { out, topOwner: topExemptOwners[0] };
}

// ===============================================================================================
// 5. sqft_percentiles.json  (also feeds the per-zip median used again in zip_league.json)
// ===============================================================================================
type SqftRow = { property_type: string; borough_name: string; zip: string | null; psf: number };
let sqftTrimmedCache: SqftRow[] | null = null;

function getTrimmedSqftRows(): SqftRow[] {
  if (sqftTrimmedCache) return sqftTrimmedCache;
  const raw = db
    .prepare(
      `SELECT property_type, borough_name, zip, (market_value * 1.0 / building_area) psf
       FROM properties_v2
       WHERE building_area > 0 AND market_value > 0`
    )
    .all() as SqftRow[];
  const sortedPsf = raw.map((r) => r.psf).sort((a, b) => a - b);
  const lo = percentile(sortedPsf, 0.005);
  const hi = percentile(sortedPsf, 0.995);
  sqftTrimmedCache = raw.filter((r) => r.psf >= lo && r.psf <= hi);
  return sqftTrimmedCache;
}

function buildSqftPercentiles() {
  const rows = getTrimmedSqftRows();

  type Group = number[];
  const byTypeBorough = new Map<string, Group>();
  const byZip = new Map<string, Group>();
  const zipBorough = new Map<string, string>();

  for (const r of rows) {
    const key = `${r.property_type}|${r.borough_name}`;
    if (!byTypeBorough.has(key)) byTypeBorough.set(key, []);
    byTypeBorough.get(key)!.push(r.psf);

    if (r.zip) {
      if (!byZip.has(r.zip)) byZip.set(r.zip, []);
      byZip.get(r.zip)!.push(r.psf);
      zipBorough.set(r.zip, r.borough_name);
    }
  }

  const summarize = (arr: Group) => {
    arr.sort((a, b) => a - b);
    return {
      n: arr.length,
      p10: round(percentile(arr, 0.1), 2),
      p25: round(percentile(arr, 0.25), 2),
      median: round(percentile(arr, 0.5), 2),
      p75: round(percentile(arr, 0.75), 2),
      p90: round(percentile(arr, 0.9), 2),
    };
  };

  const by_property_type_x_borough = [...byTypeBorough.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, arr]) => {
      const [property_type, borough] = key.split("|");
      return { property_type, borough, ...summarize(arr) };
    });

  const by_zip = [...byZip.entries()]
    .filter(([, arr]) => arr.length >= 5) // small-sample zips produce noisy medians
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([zip, arr]) => ({ zip, borough: zipBorough.get(zip)!, ...summarize(arr) }));

  const out = {
    meta: {
      ...meta,
      description: "$/sqft (market_value / building_area) percentile distributions by property_type x borough, and per-zip medians.",
      exclusions:
        "Rows require building_area > 0 and market_value > 0. Top/bottom 0.5% of the citywide $/sqft distribution trimmed as outliers before any grouping (removes data-entry artifacts like 1sqft outbuildings and $0 misfires). Per-zip rows additionally require n >= 5 valid lots to avoid single-lot noise.",
    },
    by_property_type_x_borough,
    by_zip,
  };
  writeFileSync(`${OUT_DIR}/sqft_percentiles.json`, JSON.stringify(out));
  return out;
}

// ===============================================================================================
// 6. extremes.json
// ===============================================================================================
function buildExtremes() {
  const propRow = (r: any) => ({
    bbl: r.bbl_full,
    address: r.full_address,
    borough: r.borough_name,
    zip: r.zip,
    property_type: r.property_type,
    building_class: r.building_class,
    owner_entity_type: r.owner_entity_type,
    owner_group_name: r.owner_group_id ? r.canonical_name : null,
  });

  const baseSelect = `SELECT p.bbl_full, p.full_address, p.borough_name, p.zip, p.property_type, p.building_class,
                             p.owner_entity_type, p.owner_group_id, og.canonical_name,
                             p.residential_units, p.building_area, p.market_value, p.year_built, p.lot_area
                      FROM properties_v2 p LEFT JOIN owner_groups og ON p.owner_group_id = og.owner_group_id`;

  const biggestByUnits = db.prepare(`${baseSelect} WHERE p.residential_units > 0 ORDER BY p.residential_units DESC LIMIT 25`).all() as any[];
  const biggestByArea = db.prepare(`${baseSelect} WHERE p.building_area > 0 ORDER BY p.building_area DESC LIMIT 25`).all() as any[];
  const mostValuable = db.prepare(`${baseSelect} WHERE p.market_value > 0 ORDER BY p.market_value DESC LIMIT 25`).all() as any[];
  const highestPerUnit = db
    .prepare(`${baseSelect} WHERE p.residential_units >= 10 AND p.market_value > 0 ORDER BY (p.market_value * 1.0 / p.residential_units) DESC LIMIT 25`)
    .all() as any[];
  const oldest = db
    .prepare(`${baseSelect} WHERE p.year_built > 1700 ORDER BY p.year_built ASC LIMIT 25`)
    .all() as any[];
  const largestSingleVacantLots = db
    .prepare(`${baseSelect} WHERE p.property_type = 'vacant land' AND p.lot_area > 0 ORDER BY p.lot_area DESC LIMIT 25`)
    .all() as any[];

  const vacantHoldings = db
    .prepare(
      `SELECT og.owner_group_id, og.canonical_name, og.owner_type, COUNT(*) lots, SUM(p.lot_area) total_lot_area, SUM(p.market_value) total_market_value
       FROM properties_v2 p JOIN owner_groups og ON p.owner_group_id = og.owner_group_id
       WHERE p.property_type = 'vacant land' AND p.lot_area > 0
       GROUP BY og.owner_group_id
       ORDER BY total_lot_area DESC
       LIMIT 25`
    )
    .all() as { owner_group_id: number; canonical_name: string; owner_type: string; lots: number; total_lot_area: number; total_market_value: number }[];

  const out = {
    meta: {
      ...meta,
      description: "Top-25 leaderboards across several dimensions. Owner fields are entity-only (owner_group_name is null unless the row has a resolved owner_group_id) or omitted entirely from group-level leaderboards' individual constituents.",
      exclusions:
        "biggest_by_residential_units/building_area/market_value require the relevant field > 0. highest_value_per_residential_unit requires residential_units >= 10 to avoid single/duo-unit noise. oldest_standing requires year_built > 1700 (excludes NULL/0 and the placeholder-guard floor of 1400 used elsewhere, since sub-1700 rows in this dataset are near-certainly data errors, not real surviving structures). Vacant-land leaderboards require lot_area > 0 and property_type = 'vacant land'; the owner-group holdings leaderboard requires a non-null owner_group_id (entity-only).",
    },
    biggest_by_residential_units: biggestByUnits.map((r) => ({ ...propRow(r), residential_units: r.residential_units, market_value: r.market_value })),
    biggest_by_building_area: biggestByArea.map((r) => ({ ...propRow(r), building_area: r.building_area, market_value: r.market_value })),
    most_valuable_single_lots: mostValuable.map((r) => ({ ...propRow(r), market_value: r.market_value })),
    highest_value_per_residential_unit: highestPerUnit.map((r) => ({
      ...propRow(r),
      residential_units: r.residential_units,
      market_value: r.market_value,
      value_per_residential_unit: Math.round(r.market_value / r.residential_units),
    })),
    oldest_still_standing: oldest.map((r) => ({ ...propRow(r), year_built: r.year_built })),
    largest_vacant_land_holdings_by_owner_group: vacantHoldings.map((r) => ({
      owner_group_id: r.owner_group_id,
      name: r.canonical_name,
      owner_type: r.owner_type,
      lots: r.lots,
      total_lot_area_sqft: r.total_lot_area,
      total_market_value: r.total_market_value,
    })),
    largest_single_vacant_lots: largestSingleVacantLots.map((r) => ({ ...propRow(r), lot_area_sqft: r.lot_area })),
  };
  writeFileSync(`${OUT_DIR}/extremes.json`, JSON.stringify(out));
  return out;
}

// ===============================================================================================
// 7. zip_league.json
// ===============================================================================================
function buildZipLeague() {
  const rows = db
    .prepare(
      `SELECT zip, borough_name, market_value, residential_units, owner_entity_type, property_type, value_band
       FROM properties_v2 WHERE zip IS NOT NULL`
    )
    .all() as { zip: string; borough_name: string; market_value: number | null; residential_units: number | null; owner_entity_type: string; property_type: string; value_band: string }[];

  const nullZipCount = (db.prepare("SELECT COUNT(*) n FROM properties_v2 WHERE zip IS NULL").get() as { n: number }).n;
  const MIN_LOTS = 10; // drops PO-box / single-building zip codes that aren't real neighborhoods

  type Acc = {
    borough: string; lots: number; totalValue: number; values: number[]; residentialUnits: number;
    llc: number; government: number; propertyTypeCounts: Map<string, number>; valueBandCounts: Map<string, number>;
  };
  const byZip = new Map<string, Acc>();
  for (const r of rows) {
    let a = byZip.get(r.zip);
    if (!a) a = { borough: r.borough_name, lots: 0, totalValue: 0, values: [], residentialUnits: 0, llc: 0, government: 0, propertyTypeCounts: new Map(), valueBandCounts: new Map() };
    a.lots++;
    a.totalValue += r.market_value ?? 0;
    if (r.market_value && r.market_value > 0) a.values.push(r.market_value);
    a.residentialUnits += r.residential_units ?? 0;
    if (r.owner_entity_type === "LLC") a.llc++;
    if (r.owner_entity_type === "Government") a.government++;
    a.propertyTypeCounts.set(r.property_type, (a.propertyTypeCounts.get(r.property_type) ?? 0) + 1);
    a.valueBandCounts.set(r.value_band, (a.valueBandCounts.get(r.value_band) ?? 0) + 1);
    byZip.set(r.zip, a);
  }

  const sqftByZip = new Map<string, number>();
  // Build per-zip median psf from the same trimmed dataset used in sqft_percentiles.json
  const psfLists = new Map<string, number[]>();
  for (const r of getTrimmedSqftRows()) {
    if (!r.zip) continue;
    if (!psfLists.has(r.zip)) psfLists.set(r.zip, []);
    psfLists.get(r.zip)!.push(r.psf);
  }
  for (const [zip, arr] of psfLists) {
    arr.sort((a, b) => a - b);
    sqftByZip.set(zip, round(percentile(arr, 0.5), 2));
  }

  const VALUE_BANDS = ["<$500K", "$500K–1M", "$1M–2M", "$2M–5M", "$5M–10M", "$10M–20M", "$20M–50M", "$50M+"];

  const zips = [...byZip.entries()]
    .filter(([, a]) => a.lots >= MIN_LOTS)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([zip, a]) => {
      a.values.sort((x, y) => x - y);
      const dominant = [...a.propertyTypeCounts.entries()].sort((x, y) => y[1] - x[1])[0];
      return {
        zip,
        borough: a.borough,
        lots: a.lots,
        total_market_value: a.totalValue,
        median_market_value: Math.round(percentile(a.values, 0.5)),
        median_price_per_sqft: sqftByZip.get(zip) ?? null,
        residential_units: a.residentialUnits,
        llc_share: round(a.llc / a.lots),
        government_share: round(a.government / a.lots),
        dominant_property_type: dominant ? dominant[0] : null,
        value_band_distribution: VALUE_BANDS.map((band) => ({ band, count: a.valueBandCounts.get(band) ?? 0 })),
      };
    });

  const out = {
    meta: {
      ...meta,
      description: "One row per NYC zip code: lots, value, median $/sqft, residential units, LLC/government ownership share, dominant property type, and an 8-bucket value-band mini-distribution for small-multiple bars.",
      exclusions: `Rows with zip IS NULL excluded (${nullZipCount} rows citywide). Zips with fewer than ${MIN_LOTS} lots excluded as non-neighborhood codes (single-skyscraper PO-box zips, campus zips, etc.) — see DATA_DICTIONARY.md zip normalization note. median_price_per_sqft reuses the same trimmed (0.5%/99.5%) $/sqft population as sqft_percentiles.json and is null when a zip has fewer than 5 valid $/sqft lots.`,
      zip_count: zips.length,
    },
    zips,
  };
  writeFileSync(`${OUT_DIR}/zip_league.json`, JSON.stringify(out));
  return out;
}

// ===============================================================================================
// 8. ownership_concentration.json
// ===============================================================================================
function buildOwnershipConcentration() {
  const ownerGroupTotals = db
    .prepare(
      `SELECT og.owner_group_id, og.canonical_name, og.owner_type, COUNT(*) lots, SUM(p.market_value) mv
       FROM properties_v2 p JOIN owner_groups og ON p.owner_group_id = og.owner_group_id
       GROUP BY og.owner_group_id
       ORDER BY mv DESC`
    )
    .all() as { owner_group_id: number; canonical_name: string; owner_type: string; lots: number; mv: number }[];

  const totalCitywideValue = citywide.mv;
  const cumulative: { cumulative_value: number; owner_groups: number }[] = [];
  let running = 0;
  for (const r of ownerGroupTotals) {
    running += r.mv;
    cumulative.push({ cumulative_value: running, owner_groups: cumulative.length + 1 });
  }
  const cutoffs = [10, 50, 100, 500, ownerGroupTotals.length];
  const cumulativeShares = cutoffs.map((n) => {
    const idx = Math.min(n, cumulative.length) - 1;
    const point = cumulative[idx];
    return {
      top_n: n === ownerGroupTotals.length ? "all" : n,
      owner_groups: point.owner_groups,
      cumulative_value: point.cumulative_value,
      share_of_citywide_market_value: round(point.cumulative_value / totalCitywideValue),
    };
  });

  const entityTotals = db
    .prepare(`SELECT owner_entity_type, SUM(market_value) mv, COUNT(*) n FROM properties_v2 GROUP BY owner_entity_type`)
    .all() as { owner_entity_type: string; mv: number; n: number }[];
  const government = entityTotals.find((r) => r.owner_entity_type === "Government")!;
  const individual = entityTotals.find((r) => r.owner_entity_type === "Individual")!;
  const privateEntityTypes = ["LLC", "Corporation", "Partnership", "Trust/Estate", "Nonprofit/Institution", "Cooperative corporation", "Housing company"];
  const privateEntity = entityTotals.filter((r) => privateEntityTypes.includes(r.owner_entity_type)).reduce((a, r) => ({ mv: a.mv + r.mv, n: a.n + r.n }), { mv: 0, n: 0 });
  const unknownOther = entityTotals.find((r) => r.owner_entity_type === "Unknown/Other")!;

  const llcByBorough = db
    .prepare(
      `SELECT borough_name, SUM(market_value) total_mv, SUM(CASE WHEN owner_entity_type = 'LLC' THEN market_value ELSE 0 END) llc_mv,
              COUNT(*) total_lots, SUM(CASE WHEN owner_entity_type = 'LLC' THEN 1 ELSE 0 END) llc_lots
       FROM properties_v2 GROUP BY borough_name`
    )
    .all() as { borough_name: string; total_mv: number; llc_mv: number; total_lots: number; llc_lots: number }[];

  const groupsOver1B = ownerGroupTotals.filter((r) => r.mv > 1_000_000_000).length;
  const groupsOver100M = ownerGroupTotals.filter((r) => r.mv > 100_000_000).length;

  const out = {
    meta: {
      ...meta,
      description: "Concentration of NYC property value in the top entity owner-groups: cumulative value share at top 10/50/100/500/all, government vs private-entity vs individual splits, LLC share by borough, and thresholds for $1B+ / $100M+ owner groups.",
      exclusions: "Owner-group ranking uses only rows with a resolved owner_group_id (entity-only per OWNER_CONSOLIDATION_METHODOLOGY.md — never Individual or Unknown/Other). Government/private-entity/individual split uses all rows regardless of grouping, bucketed purely by owner_entity_type (a classification, never a name).",
    },
    total_entity_owner_groups: ownerGroupTotals.length,
    cumulative_value_share: cumulativeShares,
    ownership_splits: {
      government: { lots: government.n, market_value: government.mv, share_of_citywide_value: round(government.mv / totalCitywideValue) },
      private_entity_aggregate: { lots: privateEntity.n, market_value: privateEntity.mv, share_of_citywide_value: round(privateEntity.mv / totalCitywideValue) },
      individual: { lots: individual.n, market_value: individual.mv, share_of_citywide_value: round(individual.mv / totalCitywideValue) },
      unknown_other: { lots: unknownOther.n, market_value: unknownOther.mv, share_of_citywide_value: round(unknownOther.mv / totalCitywideValue) },
    },
    llc_share_by_borough: llcByBorough.map((r) => ({
      borough: r.borough_name,
      llc_share_of_value: round(r.llc_mv / r.total_mv),
      llc_share_of_lots: round(r.llc_lots / r.total_lots),
    })),
    owner_groups_over_1b: groupsOver1B,
    owner_groups_over_100m: groupsOver100M,
  };
  writeFileSync(`${OUT_DIR}/ownership_concentration.json`, JSON.stringify(out));
  return { out, top1: ownerGroupTotals[0], top10Share: cumulativeShares[0] };
}

// ===============================================================================================
// 9. rent_overlays.json
// ===============================================================================================
function buildRentOverlays() {
  // "Structural candidates": pre-1974, 6+ unit multifamily rental stock (the classic ETPA/RSL
  // applicability heuristic). residential_units >= 6, property_type in the two apartment
  // rollups (walk-up/elevator) or small multifamily with 6+ units, year_built known and < 1974.
  const candidates = db
    .prepare(
      `SELECT bbl, borough_name, zip FROM properties_v2
       WHERE ease_code IS NULL
         AND year_built > 0 AND year_built < 1974
         AND residential_units >= 6
         AND property_type IN ('walk-up apt', 'elevator apt', 'small multifamily')`
    )
    .all() as { bbl: string; borough_name: string; zip: string | null }[];

  const stabilizedBbls = new Set(
    (db.prepare(`SELECT bbl FROM rent_stabilized`).all() as { bbl: string }[]).map((r) => r.bbl)
  );

  type Acc = { candidates: number; stabilized: number };
  const byBorough = new Map<string, Acc>();
  const byZip = new Map<string, Acc>();
  for (const c of candidates) {
    const isStab = stabilizedBbls.has(c.bbl) ? 1 : 0;
    const b = byBorough.get(c.borough_name) ?? { candidates: 0, stabilized: 0 };
    b.candidates++; b.stabilized += isStab;
    byBorough.set(c.borough_name, b);
    if (c.zip) {
      const z = byZip.get(c.zip) ?? { candidates: 0, stabilized: 0 };
      z.candidates++; z.stabilized += isStab;
      byZip.set(c.zip, z);
    }
  }

  const by_borough = [...byBorough.entries()]
    .sort((a, b) => b[1].candidates - a[1].candidates)
    .map(([borough, a]) => ({ borough, structural_candidates: a.candidates, hcr_registered: a.stabilized, stabilized_share: round(a.stabilized / a.candidates) }));

  const MIN_ZIP_CANDIDATES = 15;
  const by_zip = [...byZip.entries()]
    .filter(([, a]) => a.candidates >= MIN_ZIP_CANDIDATES)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([zip, a]) => ({ zip, structural_candidates: a.candidates, hcr_registered: a.stabilized, stabilized_share: round(a.stabilized / a.candidates) }));

  // 421-a vs J-51 by building-age decade of the underlying property (join on bbl, non-easement rows)
  const abateRows = db
    .prepare(
      `SELECT p.year_built, r.y421a, r.j51
       FROM rent_stabilized r JOIN properties_v2 p ON p.bbl = r.bbl AND p.ease_code IS NULL`
    )
    .all() as { year_built: number | null; y421a: number; j51: number }[];

  const byDecadeAbate = new Map<string, { y421a: number; j51: number; buildings: number }>();
  for (const r of abateRows) {
    const decade = decadeBucket(r.year_built);
    const a = byDecadeAbate.get(decade) ?? { y421a: 0, j51: 0, buildings: 0 };
    a.buildings++; a.y421a += r.y421a; a.j51 += r.j51;
    byDecadeAbate.set(decade, a);
  }
  const abatements_by_decade = DECADE_ORDER.filter((d) => byDecadeAbate.has(d)).map((decade) => {
    const a = byDecadeAbate.get(decade)!;
    return { decade, hcr_buildings: a.buildings, count_421a: a.y421a, count_j51: a.j51 };
  });

  // Stabilized stock by owner entity type (join stabilized bbl -> properties_v2 non-easement row)
  const byOwnerType = db
    .prepare(
      `SELECT p.owner_entity_type, COUNT(*) n
       FROM rent_stabilized r JOIN properties_v2 p ON p.bbl = r.bbl AND p.ease_code IS NULL
       GROUP BY p.owner_entity_type
       ORDER BY n DESC`
    )
    .all() as { owner_entity_type: string; n: number }[];

  const out = {
    meta: {
      ...meta,
      description: "Rent-stabilization (HCR 2024 registration) overlays: stabilized share of pre-1974 6+ unit multifamily structural-candidate stock by borough/zip, 421-a vs J-51 abatement counts by building-age decade, and stabilized building counts by owner entity type.",
      exclusions:
        "'Structural candidates' = non-easement rows (ease_code IS NULL) with 1 <= year_built < 1974, residential_units >= 6, and property_type in (walk-up apt, elevator apt, small multifamily) — a proxy for buildings that could plausibly fall under NYC rent stabilization law, not a legal determination. Zip breakdown requires >= 15 candidates to avoid single-block noise. The rent_stabilized table's bbl (no ease_code) is joined only to each BBL's non-easement properties_v2 row to avoid double-counting the small number of easement-duplicated BBLs. See RENT_REGULATION_METHODOLOGY.md for HCR source/join-quality details.",
    },
    stabilized_share_of_structural_candidates: { by_borough, by_zip },
    abatements_by_decade,
    stabilized_stock_by_owner_entity_type: byOwnerType.map((r) => ({ owner_entity_type: r.owner_entity_type, hcr_registered_buildings: r.n })),
  };
  writeFileSync(`${OUT_DIR}/rent_overlays.json`, JSON.stringify(out));
  return out;
}

// ===============================================================================================
// 10. story.json — curated findings pack, computed last so it can pull real numbers from above
// ===============================================================================================
function buildStory(inputs: {
  taxBurden: ReturnType<typeof buildTaxBurden>;
  exemptions: ReturnType<typeof buildExemptions>;
  ownership: ReturnType<typeof buildOwnershipConcentration>;
  extremes: ReturnType<typeof buildExtremes>;
  timeline: ReturnType<typeof buildTimeline>;
  zipLeague: ReturnType<typeof buildZipLeague>;
  rentOverlays: ReturnType<typeof buildRentOverlays>;
}) {
  const { taxBurden, exemptions, ownership, extremes, timeline, zipLeague, rentOverlays } = inputs;

  const c1 = taxBurden.class1Ratio * 100, c2 = taxBurden.class2Ratio * 100, c4 = taxBurden.class4Ratio * 100;
  const topOwner = ownership.top1;
  const top10Share = ownership.top10Share;
  const topExempt = exemptions.topOwner;

  const decadeByLots = [...timeline.decades].filter((d) => d.decade !== "Unknown" && d.decade !== "<1900").sort((a, b) => b.lots - a.lots)[0];
  const mostValuableLot = extremes.most_valuable_single_lots[0];
  const largestVacantHolder = extremes.largest_vacant_land_holdings_by_owner_group[0];

  const boroughStabilized = [...rentOverlays.stabilized_share_of_structural_candidates.by_borough].sort((a, b) => b.stabilized_share - a.stabilized_share);
  const highestStabBorough = boroughStabilized[0];
  const lowestStabBorough = boroughStabilized[boroughStabilized.length - 1];

  const richestZip = [...zipLeague.zips].sort((a, b) => b.median_market_value - a.median_market_value)[0];

  const govSplit = ownership.out.ownership_splits.government;
  const individualSplit = ownership.out.ownership_splits.individual;

  const findings = [
    {
      id: "class1-vs-class2-assessment-gap",
      headline_stat: `Class 1 homes are assessed at just ~${round(c1, 1)}% of market value, versus ~${round(c2, 1)}% for Class 2 apartments and ~${round(c4, 1)}% for Class 4 commercial property.`,
      value: round(c1, 1),
      comparison: { class_2: round(c2, 1), class_4: round(c4, 1) },
      supporting_series: taxBurden.out.citywide_by_base_class_family.map((r: any) => ({ label: r.label, value: round(r.citywide_assessed_to_market_ratio * 100, 1) })),
      source_file: "tax_burden.json",
    },
    {
      id: "top10-owner-groups-value-share",
      headline_stat: `The 10 largest entity owner-groups control ${round(top10Share.share_of_citywide_market_value * 100, 2)}% of citywide market value — out of ${ownership.out.total_entity_owner_groups.toLocaleString()} tracked entity ownership groups.`,
      value: round(top10Share.share_of_citywide_market_value * 100, 2),
      comparison: { owner_groups_tracked: ownership.out.total_entity_owner_groups },
      supporting_series: ownership.out.cumulative_value_share.map((r: any) => ({ label: `top ${r.top_n}`, value: round(r.share_of_citywide_market_value * 100, 2) })),
      source_file: "ownership_concentration.json",
    },
    {
      id: "largest-single-owner",
      headline_stat: `${topOwner.canonical_name} is the single largest entity property owner in NYC by assessed market value, with ${topOwner.lots.toLocaleString()} lots.`,
      value: topOwner.mv,
      comparison: { lots: topOwner.lots, owner_type: topOwner.owner_type },
      supporting_series: [],
      source_file: "ownership_concentration.json",
    },
    {
      id: "top-exempt-owner",
      headline_stat: `${topExempt!.canonical_name} carries the single largest tax-exempt property value of any entity owner in the city.`,
      value: topExempt!.exempt,
      comparison: { lots: topExempt!.lots, owner_type: topExempt!.owner_type },
      supporting_series: [],
      source_file: "exemptions.json",
    },
    {
      id: "individual-vs-corporate-value",
      headline_stat: `Individually-owned lots make up ${round((individualSplit.lots / citywide.n) * 100, 1)}% of all NYC properties by count but only ${round(individualSplit.share_of_citywide_value * 100, 1)}% of citywide market value — government holds ${round(govSplit.share_of_citywide_value * 100, 1)}%.`,
      value: round(individualSplit.share_of_citywide_value * 100, 1),
      comparison: { individual_lot_share_pct: round((individualSplit.lots / citywide.n) * 100, 1), government_value_share_pct: round(govSplit.share_of_citywide_value * 100, 1) },
      supporting_series: [
        { label: "Individual", value: round(individualSplit.share_of_citywide_value * 100, 1) },
        { label: "Government", value: round(govSplit.share_of_citywide_value * 100, 1) },
        { label: "Private entity", value: round(ownership.out.ownership_splits.private_entity_aggregate.share_of_citywide_value * 100, 1) },
      ],
      source_file: "ownership_concentration.json",
    },
    {
      id: "most-valuable-lot",
      headline_stat: `The single most valuable lot in NYC — ${mostValuableLot.address}, ${mostValuableLot.borough} — is assessed at $${(mostValuableLot as any).market_value.toLocaleString()} in market value.`,
      value: (mostValuableLot as any).market_value,
      comparison: { address: mostValuableLot.address, borough: mostValuableLot.borough },
      supporting_series: extremes.most_valuable_single_lots.slice(0, 5).map((r: any) => ({ label: r.address, value: r.market_value })),
      source_file: "extremes.json",
    },
    {
      id: "peak-construction-decade",
      headline_stat: `The ${decadeByLots.decade} produced more of NYC's current building stock than any other decade — ${decadeByLots.lots.toLocaleString()} lots still standing today, dominated by ${decadeByLots.dominant_property_type?.property_type ?? "n/a"}.`,
      value: decadeByLots.lots,
      comparison: { dominant_property_type: decadeByLots.dominant_property_type?.property_type },
      supporting_series: timeline.decades.filter((d) => d.decade !== "Unknown").map((d) => ({ label: d.decade, value: d.lots })),
      source_file: "timeline.json",
    },
    {
      id: "rent-stabilization-borough-gap",
      headline_stat: `${highestStabBorough.borough} has the highest share of its pre-1974, 6+ unit apartment stock registered as rent-stabilized (${round(highestStabBorough.stabilized_share * 100, 1)}%), versus just ${round(lowestStabBorough.stabilized_share * 100, 1)}% in ${lowestStabBorough.borough}.`,
      value: round(highestStabBorough.stabilized_share * 100, 1),
      comparison: { lowest_borough: lowestStabBorough.borough, lowest_share_pct: round(lowestStabBorough.stabilized_share * 100, 1) },
      supporting_series: boroughStabilized.map((r) => ({ label: r.borough, value: round(r.stabilized_share * 100, 1) })),
      source_file: "rent_overlays.json",
    },
    {
      id: "richest-zip-by-median-value",
      headline_stat: `${richestZip.zip} (${richestZip.borough}) has the highest median property value of any NYC zip with a meaningful lot count — $${richestZip.median_market_value.toLocaleString()}.`,
      value: richestZip.median_market_value,
      comparison: { zip: richestZip.zip, borough: richestZip.borough },
      supporting_series: [...zipLeague.zips].sort((a, b) => b.median_market_value - a.median_market_value).slice(0, 5).map((z) => ({ label: z.zip, value: z.median_market_value })),
      source_file: "zip_league.json",
    },
    {
      id: "largest-vacant-land-holder",
      headline_stat: `${largestVacantHolder.name} holds the largest vacant-land portfolio of any entity owner — ${largestVacantHolder.total_lot_area_sqft.toLocaleString()} sqft across ${largestVacantHolder.lots} lots.`,
      value: largestVacantHolder.total_lot_area_sqft,
      comparison: { lots: largestVacantHolder.lots, owner_type: largestVacantHolder.owner_type },
      supporting_series: extremes.largest_vacant_land_holdings_by_owner_group.slice(0, 5).map((r: any) => ({ label: r.name, value: r.total_lot_area_sqft })),
      source_file: "extremes.json",
    },
  ];

  const out = {
    meta: {
      ...meta,
      description: "Curated pack of the strongest single findings across all analytics files, for a scrollytelling page. Every number here is computed directly from the same queries as the source_file it cites — nothing invented.",
    },
    findings,
  };
  writeFileSync(`${OUT_DIR}/story.json`, JSON.stringify(out));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Run everything
// ---------------------------------------------------------------------------------------------

const taxBurden = buildTaxBurden();
console.log("tax_burden.json written");
const treemap = buildTreemap();
console.log("treemap.json written");
const timeline = buildTimeline();
console.log("timeline.json written");
const exemptions = buildExemptions();
console.log("exemptions.json written");
const sqft = buildSqftPercentiles();
console.log("sqft_percentiles.json written");
const extremes = buildExtremes();
console.log("extremes.json written");
const zipLeague = buildZipLeague();
console.log("zip_league.json written");
const ownership = buildOwnershipConcentration();
console.log("ownership_concentration.json written");
const rentOverlays = buildRentOverlays();
console.log("rent_overlays.json written");
const story = buildStory({ taxBurden, exemptions, ownership, extremes, timeline, zipLeague, rentOverlays });
console.log("story.json written");

// ---------------------------------------------------------------------------------------------
// Validation vs data/aggregates.json
// ---------------------------------------------------------------------------------------------
console.log("\n=== Validation ===");
console.log(`Citywide lots: ${citywide.n.toLocaleString()} (expect 1,167,962)`);
console.log(`Citywide market value: $${citywide.mv.toLocaleString()} (expect ~$1.915T-ish, actual ~$1.911T per aggregates.json)`);
console.log(`Citywide assessed value: $${citywide.av.toLocaleString()}`);

db.close();
console.log("\nDone.");
