// Step 10 of the ETL (map build): computes per-borough and per-ZIP(MODZCTA) aggregate stats
// from properties_v2 + owner_groups and merges them onto the simplified NYC boundary
// GeoJSON (data/map/boroughs_simplified.geojson / zips_simplified.geojson, produced by
// mapshaper from NYC Open Data Borough Boundaries [gthc-hcne] + MODZCTA [pri4-ifjk]) to
// produce the final data/map/boroughs.geojson and data/map/zips.geojson the /map page reads.
//
// A MODZCTA zone can bundle multiple raw ZIP codes (its `zcta` property is a comma list,
// e.g. "10001, 10119, 10199") — properties_v2.zip is matched against every code in that list.
//
// Read-only against db/properties.db. Safe to re-run any time; only writes the two output
// GeoJSON files.
//
// Usage: node --import tsx scripts/etl/10_build_map_geojson.ts

import Database from "better-sqlite3";
import { readFileSync, writeFileSync } from "node:fs";
import { isEntityOwner } from "../../lib/owners/classify";

const DB_PATH = new URL("../../db/properties.db", import.meta.url).pathname;
const MAP_DIR = new URL("../../data/map/", import.meta.url).pathname;

const BOROUGH_NAME_BY_CODE: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

type Row = {
  bbl: string;
  borough_name: string;
  zip: string | null;
  owner_entity_type: string;
  owner_group_id: number | null;
  owner_normalized: string | null;
  owner_raw: string | null;
  tax_class: string | null;
  property_type: string;
  residential_units: number | null;
  market_value: number | null;
  latitude: number | null;
  longitude: number | null;
};

type AreaAgg = {
  count: number;
  marketValues: number[];
  residentialUnits: number;
  taxClassCounts: Map<string, number>;
  propertyTypeCounts: Map<string, number>;
  llcCount: number;
  governmentCount: number;
  ownerValue: Map<string, number>; // ownerName -> summed market value (entity owners only)
};

function newAgg(): AreaAgg {
  return {
    count: 0,
    marketValues: [],
    residentialUnits: 0,
    taxClassCounts: new Map(),
    propertyTypeCounts: new Map(),
    llcCount: 0,
    governmentCount: 0,
    ownerValue: new Map(),
  };
}

function bump(map: Map<string, number>, key: string | null | undefined, by = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + by);
}

function topKey(map: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = -1;
  for (const [k, n] of map) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function summarize(agg: AreaAgg) {
  agg.marketValues.sort((a, b) => a - b);
  const total = agg.marketValues.reduce((s, v) => s + v, 0);
  const topOwners = [...agg.ownerValue.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, value]) => ({ name, total_market_value: Math.round(value) }));

  return {
    property_count: agg.count,
    total_market_value: Math.round(total),
    median_market_value: Math.round(median(agg.marketValues)),
    value_per_lot: agg.count > 0 ? Math.round(total / agg.count) : 0,
    residential_units: agg.residentialUnits,
    dominant_tax_class: topKey(agg.taxClassCounts),
    dominant_property_type: topKey(agg.propertyTypeCounts),
    llc_share: agg.count > 0 ? agg.llcCount / agg.count : 0,
    government_share: agg.count > 0 ? agg.governmentCount / agg.count : 0,
    top_owners: topOwners,
  };
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });

  console.log("Loading owner_groups display names ...");
  const ownerGroupName = new Map<number, string>();
  for (const r of db.prepare(`SELECT owner_group_id, display_name FROM owner_groups`).all() as {
    owner_group_id: number;
    display_name: string;
  }[]) {
    ownerGroupName.set(r.owner_group_id, r.display_name);
  }

  console.log("Reading properties_v2 ...");
  const rows = db
    .prepare(
      `SELECT bbl, borough_name, zip, owner_entity_type, owner_group_id, owner_normalized, owner_raw,
              tax_class, property_type, residential_units, market_value, latitude, longitude
       FROM properties_v2`
    )
    .all() as Row[];
  db.close();
  console.log(`Loaded ${rows.length.toLocaleString()} rows.`);

  const boroughAgg = new Map<string, AreaAgg>();
  const zipAgg = new Map<string, AreaAgg>(); // keyed by raw 5-digit zip

  for (const r of rows) {
    const mv = r.market_value ?? 0;
    const isEntity = isEntityOwner(r.owner_raw);
    const ownerName = r.owner_group_id != null ? ownerGroupName.get(r.owner_group_id) : r.owner_normalized || r.owner_raw;

    const boroKey = r.borough_name;
    if (boroKey) {
      const agg = boroughAgg.get(boroKey) ?? newAgg();
      agg.count++;
      agg.marketValues.push(mv);
      agg.residentialUnits += r.residential_units ?? 0;
      bump(agg.taxClassCounts, r.tax_class);
      bump(agg.propertyTypeCounts, r.property_type);
      if (r.owner_entity_type === "LLC") agg.llcCount++;
      if (r.owner_entity_type === "Government") agg.governmentCount++;
      if (isEntity && ownerName) bump(agg.ownerValue as unknown as Map<string, number>, ownerName, mv);
      boroughAgg.set(boroKey, agg);
    }

    if (r.zip && /^\d{5}$/.test(r.zip)) {
      const agg = zipAgg.get(r.zip) ?? newAgg();
      agg.count++;
      agg.marketValues.push(mv);
      agg.residentialUnits += r.residential_units ?? 0;
      bump(agg.taxClassCounts, r.tax_class);
      bump(agg.propertyTypeCounts, r.property_type);
      if (r.owner_entity_type === "LLC") agg.llcCount++;
      if (r.owner_entity_type === "Government") agg.governmentCount++;
      if (isEntity && ownerName) bump(agg.ownerValue as unknown as Map<string, number>, ownerName, mv);
      zipAgg.set(r.zip, agg);
    }
  }

  // ---- Boroughs ----
  console.log("Building boroughs.geojson ...");
  const boroughGeo = JSON.parse(readFileSync(`${MAP_DIR}boroughs_simplified.geojson`, "utf-8"));
  for (const f of boroughGeo.features) {
    const name = f.properties.boroname as string;
    const agg = boroughAgg.get(name);
    f.properties = {
      borough: name,
      borough_code: Object.entries(BOROUGH_NAME_BY_CODE).find(([, v]) => v === name)?.[0] ?? null,
      ...(agg ? summarize(agg) : { property_count: 0 }),
    };
  }
  writeFileSync(`${MAP_DIR}boroughs.geojson`, JSON.stringify(boroughGeo));

  // ---- ZIPs (MODZCTA) ----
  console.log("Building zips.geojson ...");
  const zipGeo = JSON.parse(readFileSync(`${MAP_DIR}zips_simplified.geojson`, "utf-8"));
  let zipMatchedProps = 0;
  for (const f of zipGeo.features) {
    const zctaList: string[] = String(f.properties.zcta || f.properties.modzcta || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = newAgg();
    for (const z of zctaList) {
      const agg = zipAgg.get(z);
      if (!agg) continue;
      merged.count += agg.count;
      merged.marketValues.push(...agg.marketValues);
      merged.residentialUnits += agg.residentialUnits;
      for (const [k, n] of agg.taxClassCounts) bump(merged.taxClassCounts, k, n);
      for (const [k, n] of agg.propertyTypeCounts) bump(merged.propertyTypeCounts, k, n);
      merged.llcCount += agg.llcCount;
      merged.governmentCount += agg.governmentCount;
      for (const [k, v] of agg.ownerValue) merged.ownerValue.set(k, (merged.ownerValue.get(k) ?? 0) + v);
    }
    zipMatchedProps += merged.count;
    f.properties = {
      modzcta: f.properties.modzcta,
      zips: zctaList,
      label: f.properties.label ?? null,
      ...summarize(merged),
    };
  }
  writeFileSync(`${MAP_DIR}zips.geojson`, JSON.stringify(zipGeo));

  console.log(`ZIP geojson accounts for ${zipMatchedProps.toLocaleString()} / ${rows.length.toLocaleString()} properties.`);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
