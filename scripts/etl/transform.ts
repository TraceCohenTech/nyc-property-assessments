// Shared row-transform logic: raw PROPMAST tab-delimited fields -> clean properties_v2 row.
// Field indices below are 1-indexed to match db/pts_property_master_layout.md exactly; we
// convert to 0-indexed array access via `f(n)`.

import { classifyOwnerEntityType } from "../../lib/owners/classify";
import { normalizeOwnerName } from "../../lib/owners/normalize";
import buildingClassCodes from "../../db/building_class_codes.json" with { type: "json" };

const BOROUGH_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

function parseSignedInt(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^([+-]?)0*(\d+)$/);
  if (!m) {
    // fall back to a plain parseInt for oddly-formatted fields
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }
  const sign = m[1] === "-" ? -1 : 1;
  const digits = m[2] || "0";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  return sign * n;
}

function trimOrNull(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const s = raw.trim();
  return s === "" ? null : s;
}

function valueBand(marketValue: number | null): string {
  if (marketValue === null || marketValue < 0) return "Unknown";
  if (marketValue < 500_000) return "<$500K";
  if (marketValue < 1_000_000) return "$500K–1M";
  if (marketValue < 2_000_000) return "$1M–2M";
  if (marketValue < 5_000_000) return "$2M–5M";
  if (marketValue < 10_000_000) return "$5M–10M";
  if (marketValue < 20_000_000) return "$10M–20M";
  if (marketValue < 50_000_000) return "$20M–50M";
  return "$50M+";
}

export function buildingClassDescription(code: string | null): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (!c) return null;
  const exact = (buildingClassCodes.codes as Record<string, string>)[c];
  if (exact) return exact;
  const letter = c[0];
  const letterName = (buildingClassCodes.letters as Record<string, string>)[letter];
  return letterName ? `${letterName} - Type ${c}` : `Unclassified - Type ${c}`;
}

export type PropertyType =
  | "one-family"
  | "two-family"
  | "small multifamily"
  | "walk-up apt"
  | "elevator apt"
  | "condo"
  | "coop"
  | "office"
  | "retail"
  | "industrial"
  | "hotel"
  | "parking/garage"
  | "mixed-use residential"
  | "utility"
  | "vacant land"
  | "government/institutional"
  | "entertainment/assembly"
  | "other";

export function derivePropertyType(
  bldgClass: string | null,
  residentialUnits: number | null,
  coopNumber: number | null
): PropertyType {
  if (coopNumber && coopNumber > 0) return "coop";
  if (!bldgClass) return "other";
  const letter = bldgClass.trim().toUpperCase()[0];
  switch (letter) {
    case "A":
      return "one-family";
    case "B":
      return "two-family";
    case "C":
      return residentialUnits !== null && residentialUnits > 0 && residentialUnits <= 10
        ? "small multifamily"
        : "walk-up apt";
    case "D":
      return "elevator apt";
    case "R":
      return "condo";
    case "K":
      return "retail";
    case "O":
      return "office";
    case "E":
    case "F":
      return "industrial";
    case "G":
      return "parking/garage";
    case "H":
      return "hotel";
    case "V":
      return "vacant land";
    case "U":
    case "T":
      return "utility";
    case "I":
    case "M":
    case "N":
    case "P":
    case "Q":
    case "W":
    case "Y":
      return "government/institutional";
    case "S":
      return "mixed-use residential";
    case "J":
      return "entertainment/assembly";
    default:
      return "other";
  }
}

export type CleanRow = {
  bbl: string;
  ease_code: string | null;
  bbl_full: string;
  borough_code: string;
  borough_name: string;
  block: string;
  lot: string;
  house_number_lo: string | null;
  house_number_hi: string | null;
  street_name: string | null;
  full_address: string | null;
  zip: string | null;
  owner_raw: string | null;
  owner_normalized: string | null;
  owner_entity_type: string;
  tax_class: string | null;
  building_class: string | null;
  building_class_description: string | null;
  property_type: PropertyType;
  residential_units: number | null;
  total_units: number | null;
  commercial_units: number | null;
  year_built: number | null;
  lot_area: number | null;
  building_area: number | null;
  market_value: number | null;
  assessed_value: number | null;
  taxable_value: number | null;
  exempt_value: number | null;
  value_band: string;
  value_per_resid_unit: number | null;
  value_per_total_unit: number | null;
  value_per_bldg_sqft: number | null;
  coop_number: number | null;
  source_year: string;
  source_dataset: string;
};

/** raw: array of the 139 tab-split fields (1-indexed access via f(n)), sourceDataset: which raw file this came from */
export function transformRow(fields: string[], sourceDataset: string): CleanRow | null {
  const f = (n: number) => fields[n - 1];

  const rectype = trimOrNull(f(7));
  if (rectype !== "1") return null; // ordinary real estate only (all rows in both source files are RECTYPE=1, but guard defensively)

  const boro = trimOrNull(f(2));
  const block = trimOrNull(f(3));
  const lot = trimOrNull(f(4));
  const ease = trimOrNull(f(5));
  if (!boro || !block || !lot) return null;

  const bbl = `${boro}${block.padStart(5, "0")}${lot.padStart(4, "0")}`;
  const bbl_full = ease ? `${bbl}${ease}` : bbl;

  // FIN* fields are primary; fall back to TEN* (tentative) when FIN* is blank.
  const finMktTot = parseSignedInt(f(47));
  const finActTot = parseSignedInt(f(49));
  const finActExTot = parseSignedInt(f(50));
  const finTxbTot = parseSignedInt(f(54));
  const finTaxClass = trimOrNull(f(56));

  const tenMktTot = parseSignedInt(f(25));
  const tenActTot = parseSignedInt(f(27));
  const tenTaxClass = trimOrNull(f(34));

  const marketValue = finMktTot ?? tenMktTot;
  const assessedValue = finActTot ?? tenActTot;
  const taxClass = finTaxClass ?? tenTaxClass;

  const bldgClass = trimOrNull(f(72));
  const ownerRaw = trimOrNull(f(73));
  const houseLo = trimOrNull(f(75));
  const houseHi = trimOrNull(f(76));
  const streetName = trimOrNull(f(77));
  const zip = trimOrNull(f(78));

  const yrBuiltRaw = parseSignedInt(f(91));
  const yearBuilt = yrBuiltRaw && yrBuiltRaw > 1400 && yrBuiltRaw <= 2100 ? yrBuiltRaw : null;

  const coopApts = parseSignedInt(f(98)); // residential units
  const units = parseSignedInt(f(99)); // total units
  const coopNumber = parseSignedInt(f(102));
  const landArea = parseSignedInt(f(89));
  const grossSqft = parseSignedInt(f(122));

  const residentialUnits = coopApts;
  const totalUnits = units;
  const commercialUnits =
    totalUnits !== null && residentialUnits !== null && totalUnits >= residentialUnits
      ? totalUnits - residentialUnits
      : null;

  let houseAddr: string | null = null;
  if (houseLo) {
    houseAddr = houseHi && houseHi !== houseLo ? `${houseLo}-${houseHi}` : houseLo;
  }
  const fullAddress =
    houseAddr && streetName
      ? `${houseAddr} ${streetName}`
      : streetName
        ? streetName
        : null;

  const ownerEntityType = classifyOwnerEntityType(ownerRaw);
  const ownerNormalized = ownerRaw ? normalizeOwnerName(ownerRaw) : null;

  const propertyType = derivePropertyType(bldgClass, residentialUnits, coopNumber);

  const valuePerResidUnit =
    marketValue !== null && residentialUnits && residentialUnits > 0
      ? Math.round(marketValue / residentialUnits)
      : null;
  const valuePerTotalUnit =
    marketValue !== null && totalUnits && totalUnits > 0
      ? Math.round(marketValue / totalUnits)
      : null;
  const valuePerBldgSqft =
    marketValue !== null && grossSqft && grossSqft > 0
      ? Math.round((marketValue / grossSqft) * 100) / 100
      : null;

  return {
    bbl,
    ease_code: ease,
    bbl_full,
    borough_code: boro,
    borough_name: BOROUGH_NAMES[boro] ?? "Unknown",
    block,
    lot,
    house_number_lo: houseLo,
    house_number_hi: houseHi,
    street_name: streetName,
    full_address: fullAddress,
    zip: zip && zip.length >= 5 ? zip.slice(0, 5) : zip,
    owner_raw: ownerRaw,
    owner_normalized: ownerNormalized,
    owner_entity_type: ownerEntityType,
    tax_class: taxClass,
    building_class: bldgClass,
    building_class_description: buildingClassDescription(bldgClass),
    property_type: propertyType,
    residential_units: residentialUnits,
    total_units: totalUnits,
    commercial_units: commercialUnits,
    year_built: yearBuilt,
    lot_area: landArea,
    building_area: grossSqft,
    market_value: marketValue,
    assessed_value: assessedValue,
    taxable_value: finTxbTot,
    exempt_value: finActExTot,
    value_band: valueBand(marketValue),
    value_per_resid_unit: valuePerResidUnit,
    value_per_total_unit: valuePerTotalUnit,
    value_per_bldg_sqft: valuePerBldgSqft,
    coop_number: coopNumber && coopNumber > 0 ? coopNumber : null,
    source_year: "FY2027",
    source_dataset: sourceDataset,
  };
}
