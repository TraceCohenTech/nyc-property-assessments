// Step 4 of the ETL: compute data/aggregates.json, data/insights.json, and
// data/borough/[name].json from the FULL clean CSV (produced by 01_parse_raw_to_csv.ts) — NOT
// from the DB. This is deliberate: the Neon project's storage cap means properties_v2 currently
// holds only a partial load (see DATA_QUALITY_REPORT.md), but these aggregate/insight JSON
// files are static build output with no storage constraint, so they're computed against the
// full accurate 1,167,962-row canonical dataset regardless of how much fits in Postgres.
//
// Output shapes conform EXACTLY to lib/types.ts's `Aggregates` and `InsightsData` types (owned
// by the UI agent) — this script does not redefine those contracts, it fills them.
//
// Usage: node --import tsx scripts/etl/04_build_aggregates.ts

import { createReadStream, writeFileSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { isEntityOwner } from "../../lib/owners/classify";

const CSV_PATH =
  process.env.ETL_CSV_PATH ||
  "/private/tmp/claude-501/-Users-tracecohen/53b5d2a0-92e3-47c6-8be9-1fa515de539f/scratchpad/nyc_property_etl_v2/properties_v2.csv";

const REPO_ROOT = new URL("../../", import.meta.url);
const DATA_DIR = new URL("data/", REPO_ROOT);
const BOROUGH_DIR = new URL("data/borough/", REPO_ROOT);
mkdirSync(BOROUGH_DIR, { recursive: true });

const BOROUGHS = ["Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"];

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

function median(sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 0;
  const mid = Math.floor(sortedAsc.length / 2);
  return sortedAsc.length % 2 === 0 ? (sortedAsc[mid - 1] + sortedAsc[mid]) / 2 : sortedAsc[mid];
}

type Row = {
  bbl: string;
  borough_code: string;
  borough_name: string;
  zip: string;
  owner_raw: string;
  owner_entity_type: string;
  tax_class: string;
  building_class: string;
  property_type: string;
  residential_units: number | null;
  total_units: number | null;
  year_built: number | null;
  building_area: number | null;
  market_value: number | null;
  assessed_value: number | null;
  taxable_value: number | null;
};

async function main() {
  console.log(`Streaming ${CSV_PATH} ...`);
  const rl = createInterface({ input: createReadStream(CSV_PATH), crlfDelay: Infinity });
  let header: string[] | null = null;
  const idx: Record<string, number> = {};

  let totalRows = 0;
  let citywideMarket = 0;
  let citywideAssessed = 0;
  let citywideTaxable = 0;

  const marketValues: number[] = []; // for concentration curve + medians (kept full precision)

  // Per-borough accumulators
  type BoroughAcc = {
    count: number;
    market: number;
    assessed: number;
    taxable: number;
    marketValues: number[];
    residentialUnits: number;
    yearBuiltSum: number;
    yearBuiltCount: number;
    valuePerResidUnit: number[];
    taxClassCounts: Map<string, { count: number; market: number; assessed: number }>;
    propertyTypeCounts: Map<string, number>;
    valueBandCounts: Map<string, number>;
    entityTypeCounts: Map<string, { count: number; market: number; units: number }>;
    zipCounts: Map<string, { count: number; market: number; assessed: number }>;
    ownerAgg: Map<string, { count: number; assessed: number; market: number }>;
    topProperties: { bbl: string; market: number; owner: string; building_class: string }[];
  };
  function newBoroughAcc(): BoroughAcc {
    return {
      count: 0,
      market: 0,
      assessed: 0,
      taxable: 0,
      marketValues: [],
      residentialUnits: 0,
      yearBuiltSum: 0,
      yearBuiltCount: 0,
      valuePerResidUnit: [],
      taxClassCounts: new Map(),
      propertyTypeCounts: new Map(),
      valueBandCounts: new Map(),
      entityTypeCounts: new Map(),
      zipCounts: new Map(),
      ownerAgg: new Map(),
      topProperties: [],
    };
  }
  const byBorough = new Map<string, BoroughAcc>();
  for (const b of BOROUGHS) byBorough.set(b, newBoroughAcc());

  // Citywide accumulators
  const cwTaxClass = new Map<string, { count: number; market: number; assessed: number; taxable: number }>();
  const cwTaxClassSample = new Map<string, number[]>(); // capped reservoir for median_market_value_sample
  const cwZip = new Map<string, { borough: string; count: number; market: number; assessed: number; bldgClassCounts: Map<string, number> }>();
  const cwBuildingClass = new Map<string, { count: number; assessed: number }>();
  const cwOwner = new Map<string, { count: number; assessed: number; market: number }>();
  const cwAgeBucket = new Map<string, { count: number; assessed: number }>();
  const cwEntityType = new Map<string, { count: number; market: number; units: number }>();
  const cwUnitSizeBand = new Map<string, { lots: number; units: number }>();
  const cwResidUnitsByBorough = new Map<string, number>();
  let pre1940Lots = 0;
  let pre1940Units = 0;
  let pre1974MultiLots = 0;
  let pre1974MultiUnits = 0;
  let llcLots = 0,
    llcValue = 0;
  let govLots = 0,
    govValue = 0;
  let lotsAbove10m = 0;
  let lotsAbove50m = 0;

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
  function valueBand(mv: number | null): string {
    if (mv === null || mv < 0) return "Unknown";
    if (mv < 500_000) return "<$500K";
    if (mv < 1_000_000) return "$500K–1M";
    if (mv < 2_000_000) return "$1M–2M";
    if (mv < 5_000_000) return "$2M–5M";
    if (mv < 10_000_000) return "$5M–10M";
    if (mv < 20_000_000) return "$10M–20M";
    if (mv < 50_000_000) return "$20M–50M";
    return "$50M+";
  }
  function unitBand(u: number): string {
    if (u <= 1) return "1";
    if (u === 2) return "2";
    if (u <= 5) return "3–5";
    if (u <= 10) return "6–10";
    if (u <= 20) return "11–20";
    if (u <= 50) return "21–50";
    if (u <= 100) return "51–100";
    if (u <= 250) return "101–250";
    if (u <= 500) return "251–500";
    if (u <= 1000) return "501–1000";
    return "1000+";
  }

  for await (const line of rl) {
    if (!header) {
      header = parseCsvLine(line);
      header.forEach((h, i) => (idx[h] = i));
      continue;
    }
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const g = (col: string) => f[idx[col]] ?? "";
    const gi = (col: string): number | null => {
      const v = g(col);
      return v === "" ? null : parseInt(v, 10);
    };

    const boroughName = g("borough_name");
    const marketValue = gi("market_value");
    const assessedValue = gi("assessed_value") ?? 0;
    const taxableValue = gi("taxable_value") ?? 0;
    const ownerRaw = g("owner_raw");
    const entityType = g("owner_entity_type");
    const taxClass = g("tax_class") || "Unknown";
    const bldgClass = g("building_class") || "Unknown";
    const propertyType = g("property_type") || "other";
    const zip = g("zip");
    const yearBuilt = gi("year_built");
    const residUnits = gi("residential_units") ?? 0;
    const bbl = g("bbl");

    totalRows++;
    const mv = marketValue ?? 0;
    citywideMarket += mv;
    citywideAssessed += assessedValue;
    citywideTaxable += taxableValue;
    marketValues.push(mv);

    if (mv >= 10_000_000) lotsAbove10m++;
    if (mv >= 50_000_000) lotsAbove50m++;

    // tax class
    if (!cwTaxClass.has(taxClass)) cwTaxClass.set(taxClass, { count: 0, market: 0, assessed: 0, taxable: 0 });
    const tc = cwTaxClass.get(taxClass)!;
    tc.count++;
    tc.market += mv;
    tc.assessed += assessedValue;
    tc.taxable += taxableValue;
    {
      const sample = cwTaxClassSample.get(taxClass) ?? [];
      if (sample.length < 5000) {
        sample.push(mv);
        cwTaxClassSample.set(taxClass, sample);
      }
    }

    // zip
    if (zip) {
      if (!cwZip.has(zip)) cwZip.set(zip, { borough: boroughName, count: 0, market: 0, assessed: 0, bldgClassCounts: new Map() });
      const z = cwZip.get(zip)!;
      z.count++;
      z.market += mv;
      z.assessed += assessedValue;
      z.bldgClassCounts.set(bldgClass[0] || "?", (z.bldgClassCounts.get(bldgClass[0] || "?") ?? 0) + 1);
    }

    // building class
    if (!cwBuildingClass.has(bldgClass)) cwBuildingClass.set(bldgClass, { count: 0, assessed: 0 });
    const bc = cwBuildingClass.get(bldgClass)!;
    bc.count++;
    bc.assessed += assessedValue;

    // owner (raw, not masked -- UI masks at render time via isEntityOwner)
    if (ownerRaw) {
      if (!cwOwner.has(ownerRaw)) cwOwner.set(ownerRaw, { count: 0, assessed: 0, market: 0 });
      const o = cwOwner.get(ownerRaw)!;
      o.count++;
      o.assessed += assessedValue;
      o.market += mv;
    }

    // age
    const ab = ageBucket(yearBuilt);
    if (!cwAgeBucket.has(ab)) cwAgeBucket.set(ab, { count: 0, assessed: 0 });
    const a = cwAgeBucket.get(ab)!;
    a.count++;
    a.assessed += assessedValue;

    // entity type / ownership
    if (!cwEntityType.has(entityType)) cwEntityType.set(entityType, { count: 0, market: 0, units: 0 });
    const et = cwEntityType.get(entityType)!;
    et.count++;
    et.market += mv;
    et.units += residUnits;
    if (entityType === "LLC") {
      llcLots++;
      llcValue += mv;
    }
    if (entityType === "Government") {
      govLots++;
      govValue += mv;
    }

    // housing
    if (residUnits > 0) {
      const band = unitBand(residUnits);
      if (!cwUnitSizeBand.has(band)) cwUnitSizeBand.set(band, { lots: 0, units: 0 });
      const ub = cwUnitSizeBand.get(band)!;
      ub.lots++;
      ub.units += residUnits;
    }
    cwResidUnitsByBorough.set(boroughName, (cwResidUnitsByBorough.get(boroughName) ?? 0) + residUnits);
    if (yearBuilt && yearBuilt > 0 && yearBuilt < 1940) {
      pre1940Lots++;
      pre1940Units += residUnits;
    }
    if (yearBuilt && yearBuilt > 0 && yearBuilt < 1974 && residUnits >= 6) {
      pre1974MultiLots++;
      pre1974MultiUnits += residUnits;
    }

    // per-borough
    const bAcc = byBorough.get(boroughName);
    if (bAcc) {
      bAcc.count++;
      bAcc.market += mv;
      bAcc.assessed += assessedValue;
      bAcc.taxable += taxableValue;
      bAcc.marketValues.push(mv);
      bAcc.residentialUnits += residUnits;
      if (yearBuilt && yearBuilt > 0) {
        bAcc.yearBuiltSum += yearBuilt;
        bAcc.yearBuiltCount++;
      }
      if (residUnits > 0 && mv > 0) bAcc.valuePerResidUnit.push(mv / residUnits);

      if (!bAcc.taxClassCounts.has(taxClass)) bAcc.taxClassCounts.set(taxClass, { count: 0, market: 0, assessed: 0 });
      const btc = bAcc.taxClassCounts.get(taxClass)!;
      btc.count++;
      btc.market += mv;
      btc.assessed += assessedValue;

      bAcc.propertyTypeCounts.set(propertyType, (bAcc.propertyTypeCounts.get(propertyType) ?? 0) + 1);
      const vb = valueBand(marketValue);
      bAcc.valueBandCounts.set(vb, (bAcc.valueBandCounts.get(vb) ?? 0) + 1);

      if (!bAcc.entityTypeCounts.has(entityType)) bAcc.entityTypeCounts.set(entityType, { count: 0, market: 0, units: 0 });
      const bet = bAcc.entityTypeCounts.get(entityType)!;
      bet.count++;
      bet.market += mv;
      bet.units += residUnits;

      if (zip) {
        if (!bAcc.zipCounts.has(zip)) bAcc.zipCounts.set(zip, { count: 0, market: 0, assessed: 0 });
        const bz = bAcc.zipCounts.get(zip)!;
        bz.count++;
        bz.market += mv;
        bz.assessed += assessedValue;
      }

      if (ownerRaw && isEntityOwner(ownerRaw)) {
        if (!bAcc.ownerAgg.has(ownerRaw)) bAcc.ownerAgg.set(ownerRaw, { count: 0, assessed: 0, market: 0 });
        const bo = bAcc.ownerAgg.get(ownerRaw)!;
        bo.count++;
        bo.assessed += assessedValue;
        bo.market += mv;
      }

      bAcc.topProperties.push({ bbl, market: mv, owner: ownerRaw, building_class: bldgClass });
    }

    if (totalRows % 200000 === 0) console.log(`  ${totalRows} rows processed...`);
  }

  console.log(`Total rows processed: ${totalRows}`);

  // ---------- aggregates.json (existing shape, extended freely) ----------
  const boroughsOut = BOROUGHS.map((name) => {
    const b = byBorough.get(name)!;
    const byTaxClass: Record<string, unknown> = {};
    for (const [tc, v] of b.taxClassCounts) {
      byTaxClass[tc] = {
        count: v.count,
        total_market_value: v.market,
        total_assessed_value: v.assessed,
        assessment_ratio: v.market > 0 ? v.assessed / v.market : 0,
      };
    }
    return {
      borough: name,
      count: b.count,
      total_market_value: b.market,
      total_assessed_value: b.assessed,
      total_taxable_value: b.taxable,
      avg_market_value: b.count > 0 ? Math.round(b.market / b.count) : 0,
      assessment_ratio: b.market > 0 ? b.assessed / b.market : 0,
      by_tax_class: byTaxClass,
    };
  });

  const taxClassesOut = [...cwTaxClass.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tax_class, v]) => ({
      tax_class,
      count: v.count,
      total_market_value: v.market,
      total_assessed_value: v.assessed,
      total_taxable_value: v.taxable,
      assessment_ratio: v.market > 0 ? v.assessed / v.market : 0,
      mean_market_value: v.count > 0 ? Math.round(v.market / v.count) : 0,
      median_market_value_sample: median((cwTaxClassSample.get(tax_class) ?? []).slice().sort((a, b) => a - b)),
    }));

  const zipsOut = [...cwZip.entries()].map(([zip, v]) => {
    let topLetter = "?";
    let topCount = -1;
    for (const [letter, c] of v.bldgClassCounts) {
      if (c > topCount) {
        topCount = c;
        topLetter = letter;
      }
    }
    return {
      zip,
      borough: v.borough,
      count: v.count,
      total_market_value: v.market,
      total_assessed_value: v.assessed,
      avg_market_value: v.count > 0 ? Math.round(v.market / v.count) : 0,
      top_bldg_class_letter: topLetter,
    };
  });

  const buildingClassesOut = [...cwBuildingClass.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([building_class, v]) => ({ building_class, count: v.count, total_assessed_value: v.assessed }));

  const topOwnersOut = [...cwOwner.entries()]
    .sort((a, b) => b[1].assessed - a[1].assessed)
    .slice(0, 300)
    .map(([owner, v]) => ({ owner, property_count: v.count, total_assessed_value: v.assessed, total_market_value: v.market }));

  const ageDistributionOut = [...cwAgeBucket.entries()].map(([bucket, v]) => ({
    bucket,
    count: v.count,
    total_assessed_value: v.assessed,
  }));

  const aggregates = {
    citywide: {
      total_properties: totalRows,
      total_market_value: citywideMarket,
      total_assessed_value: citywideAssessed,
      total_taxable_value: citywideTaxable,
    },
    boroughs: boroughsOut,
    tax_classes: taxClassesOut,
    zips: zipsOut,
    building_classes: buildingClassesOut,
    top_owners: topOwnersOut,
    age_distribution: ageDistributionOut,
    meta: {
      total_rows_processed: totalRows,
      bad_rows_skipped: 0,
      source_files: ["PROPMAST_TC1_2027_FIN.txt", "PROPMAST_TC234_T2027_FIN.TXT"],
      generated_note: "NYC DOF FY2027 Property Assessment Roll (Tax Classes 1,2,3,4)",
      generated_at: new Date().toISOString(),
    },
  };
  writeFileSync(new URL("aggregates.json", DATA_DIR), JSON.stringify(aggregates));
  console.log("Wrote data/aggregates.json");

  // ---------- insights.json (matches lib/types.ts InsightsData exactly) ----------
  marketValues.sort((a, b) => b - a); // descending
  const totalValue = citywideMarket;
  let cum = 0;
  const curve: { pct_lots: number; pct_value: number }[] = [];
  let pct50Idx = -1;
  let pct80Idx = -1;
  const curveSampleEvery = Math.max(1, Math.floor(marketValues.length / 200));
  for (let i = 0; i < marketValues.length; i++) {
    cum += marketValues[i];
    const cumPct = totalValue > 0 ? cum / totalValue : 0;
    if (pct50Idx === -1 && cumPct >= 0.5) pct50Idx = i;
    if (pct80Idx === -1 && cumPct >= 0.8) pct80Idx = i;
    if (i % curveSampleEvery === 0 || i === marketValues.length - 1) {
      curve.push({ pct_lots: Math.round(((i + 1) / marketValues.length) * 1000) / 1000, pct_value: Math.round(cumPct * 1000) / 1000 });
    }
  }
  const pctLotsFor50 = pct50Idx >= 0 ? (pct50Idx + 1) / marketValues.length : 1;
  const pctLotsFor80 = pct80Idx >= 0 ? (pct80Idx + 1) / marketValues.length : 1;

  function topNStats(n: number) {
    const slice = marketValues.slice(0, n);
    const value = slice.reduce((s, v) => s + v, 0);
    return { n, total_value: value, share: totalValue > 0 ? value / totalValue : 0 };
  }
  const topNBreakdown = [100, 1000, 10000, 50000].map(topNStats);

  const valueBandsAgg = new Map<string, { lots: number; market: number }>();
  for (const v of marketValues) {
    const b = valueBand(v);
    if (!valueBandsAgg.has(b)) valueBandsAgg.set(b, { lots: 0, market: 0 });
    const x = valueBandsAgg.get(b)!;
    x.lots++;
    x.market += v;
  }
  const bandOrder = ["<$500K", "$500K–1M", "$1M–2M", "$2M–5M", "$5M–10M", "$10M–20M", "$20M–50M", "$50M+", "Unknown"];
  const valueBandsOut = bandOrder
    .filter((b) => valueBandsAgg.has(b))
    .map((band) => {
      const v = valueBandsAgg.get(band)!;
      return {
        band,
        lots: v.lots,
        total_market_value: v.market,
        share_lots: totalRows > 0 ? v.lots / totalRows : 0,
        share_value: totalValue > 0 ? v.market / totalValue : 0,
        avg_value: v.lots > 0 ? Math.round(v.market / v.lots) : 0,
      };
    });

  const byEntityType = [...cwEntityType.entries()]
    .sort((a, b) => b[1].market - a[1].market)
    .map(([type, v]) => ({ type, lots: v.count, total_value: v.market, residential_units: v.units }));

  const unitSizeBandOrder = ["1", "2", "3–5", "6–10", "11–20", "21–50", "51–100", "101–250", "251–500", "501–1000", "1000+"];
  const unitSizeBandsOut = unitSizeBandOrder
    .filter((b) => cwUnitSizeBand.has(b))
    .map((band) => ({ band, lots: cwUnitSizeBand.get(band)!.lots, units: cwUnitSizeBand.get(band)!.units }));

  const residUnitsByBoroughOut = BOROUGHS.map((b) => ({ borough: b, units: cwResidUnitsByBorough.get(b) ?? 0 }));

  // Borough headliners: for each borough, find a superlative it leads on citywide, else default
  // to a total-value framing.
  const boroughStats = BOROUGHS.map((name) => {
    const b = byBorough.get(name)!;
    return { name, market: b.market, count: b.count, units: b.residentialUnits, avg: b.count > 0 ? b.market / b.count : 0 };
  });
  const leaderByValue = [...boroughStats].sort((a, b) => b.market - a.market)[0];
  const leaderByLots = [...boroughStats].sort((a, b) => b.count - a.count)[0];
  const leaderByUnits = [...boroughStats].sort((a, b) => b.units - a.units)[0];
  const leaderByAvg = [...boroughStats].sort((a, b) => b.avg - a.avg)[0];
  const fmtUSD = (n: number) => `$${(n / 1_000_000_000).toFixed(1)}B`;
  const fmtNum = (n: number) => n.toLocaleString("en-US");
  const boroughHeadlinersOut = boroughStats.map((b) => {
    if (b.name === leaderByValue.name)
      return { borough: b.name, headline: "Holds the most total property value in the city", stat: `${fmtUSD(b.market)} total market value` };
    if (b.name === leaderByLots.name)
      return { borough: b.name, headline: "Has the most tax lots of any borough", stat: `${fmtNum(b.count)} lots` };
    if (b.name === leaderByUnits.name)
      return { borough: b.name, headline: "Has the most residential units of any borough", stat: `${fmtNum(b.units)} residential units` };
    if (b.name === leaderByAvg.name)
      return { borough: b.name, headline: "Has the highest average property value", stat: `${fmtUSD(b.avg)} avg. market value per lot` };
    return { borough: b.name, headline: "Ranks among the five boroughs by total value", stat: `${fmtUSD(b.market)} total market value` };
  });

  const insights = {
    meta: {
      generated_at: new Date().toISOString(),
      canonical_row_count: totalRows,
      note: "Computed from the full FY2027 PROPMAST roll (all 1,167,962 rows) by the data-layer ETL — see scripts/etl/04_build_aggregates.ts.",
    },
    value_bands: valueBandsOut,
    concentration: {
      curve,
      top_n: 1000,
      pct_lots_for_50pct_value: Math.round(pctLotsFor50 * 1000) / 1000,
      pct_lots_for_80pct_value: Math.round(pctLotsFor80 * 1000) / 1000,
      lots_above_10m: lotsAbove10m,
      lots_above_50m: lotsAbove50m,
      // Extra detail beyond the InsightsData contract (safe to ignore, useful for future UI):
      top_n_breakdown: topNBreakdown,
    },
    ownership: {
      by_entity_type: byEntityType,
      llc: { lots: llcLots, total_value: llcValue },
      government: { lots: govLots, total_value: govValue },
    },
    housing: {
      unit_size_bands: unitSizeBandsOut,
      residential_units_by_borough: residUnitsByBoroughOut,
      pre_1940: { lots: pre1940Lots, units: pre1940Units },
      pre_1974_multifamily: { lots: pre1974MultiLots, units: pre1974MultiUnits },
    },
    borough_headliners: boroughHeadlinersOut,
  };
  writeFileSync(new URL("insights.json", DATA_DIR), JSON.stringify(insights));
  console.log("Wrote data/insights.json (placeholder flag cleared)");

  // ---------- data/borough/[name].json ----------
  for (const name of BOROUGHS) {
    const b = byBorough.get(name)!;
    const sortedMv = [...b.marketValues].sort((a, c) => a - c);
    const sortedVpu = [...b.valuePerResidUnit].sort((a, c) => a - c);
    const medianMarket = median(sortedMv);
    const medianVpu = median(sortedVpu);
    const avgYearBuilt = b.yearBuiltCount > 0 ? Math.round(b.yearBuiltSum / b.yearBuiltCount) : null;

    const taxClassDist = [...b.taxClassCounts.entries()].map(([tax_class, v]) => ({
      tax_class,
      count: v.count,
      total_market_value: v.market,
      total_assessed_value: v.assessed,
    }));
    const propertyTypeDist = [...b.propertyTypeCounts.entries()]
      .sort((a, c) => c[1] - a[1])
      .map(([property_type, count]) => ({ property_type, count }));
    const valueBandDist = [...b.valueBandCounts.entries()].map(([band, count]) => ({ band, count }));
    const entityMix = [...b.entityTypeCounts.entries()]
      .sort((a, c) => c[1].market - a[1].market)
      .map(([type, v]) => ({ type, lots: v.count, total_value: v.market, residential_units: v.units }));
    const zipBreakdown = [...b.zipCounts.entries()]
      .sort((a, c) => c[1].count - a[1].count)
      .map(([zip, v]) => ({ zip, count: v.count, total_market_value: v.market, total_assessed_value: v.assessed }));
    const topEntityOwners = [...b.ownerAgg.entries()]
      .sort((a, c) => c[1].assessed - a[1].assessed)
      .slice(0, 50)
      .map(([owner, v]) => ({ owner, property_count: v.count, total_assessed_value: v.assessed, total_market_value: v.market }));
    const topProperties = [...b.topProperties]
      .sort((a, c) => c.market - a.market)
      .slice(0, 50)
      .map((p) => ({ bbl: p.bbl, market_value: p.market, owner_display: isEntityOwner(p.owner) ? p.owner : "Private Owner", building_class: p.building_class }));

    const boroughJson = {
      borough: name,
      meta: { generated_at: new Date().toISOString(), row_count: b.count },
      totals: {
        count: b.count,
        total_market_value: b.market,
        total_assessed_value: b.assessed,
        total_taxable_value: b.taxable,
        residential_units: b.residentialUnits,
      },
      medians: {
        median_market_value: medianMarket,
        median_value_per_resid_unit: Math.round(medianVpu),
        avg_year_built: avgYearBuilt,
      },
      tax_class_distribution: taxClassDist,
      property_type_distribution: propertyTypeDist,
      value_band_distribution: valueBandDist,
      entity_mix: entityMix,
      zip_breakdown: zipBreakdown,
      top_entity_owners: topEntityOwners,
      top_properties: topProperties,
    };
    const fname = name.toLowerCase().replace(/\s+/g, "-");
    writeFileSync(new URL(`${fname}.json`, BOROUGH_DIR), JSON.stringify(boroughJson));
    console.log(`Wrote data/borough/${fname}.json (${b.count} rows)`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
