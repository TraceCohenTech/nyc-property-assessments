export type Citywide = {
  total_properties: number;
  total_market_value: number;
  total_assessed_value: number;
  total_taxable_value: number;
};

export type BoroughByTaxClass = {
  count: number;
  total_market_value: number;
  total_assessed_value: number;
  assessment_ratio: number;
};

export type Borough = {
  borough: string;
  count: number;
  total_market_value: number;
  total_assessed_value: number;
  total_taxable_value: number;
  avg_market_value: number;
  assessment_ratio: number;
  by_tax_class: Record<string, BoroughByTaxClass>;
};

export type TaxClass = {
  tax_class: string;
  count: number;
  total_market_value: number;
  total_assessed_value: number;
  total_taxable_value: number;
  assessment_ratio: number;
  mean_market_value: number;
  median_market_value_sample: number;
};

export type Zip = {
  zip: string;
  borough: string;
  count: number;
  total_market_value: number;
  total_assessed_value: number;
  avg_market_value: number;
  top_bldg_class_letter: string;
};

export type BuildingClass = { building_class: string; count: number; total_assessed_value: number };

export type Owner = { owner: string; property_count: number; total_assessed_value: number; total_market_value: number };

export type AgeBucket = { bucket: string; count: number; total_assessed_value: number };

export type Meta = { total_rows_processed: number; bad_rows_skipped: number; source_files: string[] };

export type Aggregates = {
  citywide: Citywide;
  boroughs: Borough[];
  tax_classes: TaxClass[];
  zips: Zip[];
  building_classes: BuildingClass[];
  top_owners: Owner[];
  age_distribution: AgeBucket[];
  meta: Meta;
};

/**
 * data/insights.json contract, produced by the DATA agent (see PRODUCT_AUDIT / build brief).
 * The UI layer seeded a placeholder (data/insights.json, `placeholder: true`) matching this
 * shape; the data agent overwrites it with computed values and clears the flag. All UI code
 * consuming this type must tolerate the placeholder (same shape, approximate numbers) and
 * degrade gracefully (optional chaining / fallbacks) if a future field is ever missing.
 */
export type ValueBand = {
  band: string;
  lots: number;
  total_market_value: number;
  share_lots: number;
  share_value: number;
  avg_value: number;
};

export type ConcentrationPoint = { pct_lots: number; pct_value: number };

export type TopNBreakdownRow = { n: number; total_value: number; share: number };

export type Concentration = {
  curve: ConcentrationPoint[];
  top_n: number;
  pct_lots_for_50pct_value: number;
  pct_lots_for_80pct_value: number;
  lots_above_10m: number;
  lots_above_50m: number;
  top_n_breakdown: TopNBreakdownRow[];
};

export type OwnershipByType = { type: string; lots: number; total_value: number; residential_units: number };

export type Ownership = {
  by_entity_type: OwnershipByType[];
  llc: { lots: number; total_value: number };
  government: { lots: number; total_value: number };
};

export type UnitSizeBand = { band: string; lots: number; units: number };
export type ResidentialUnitsByBorough = { borough: string; units: number };

export type Housing = {
  unit_size_bands: UnitSizeBand[];
  residential_units_by_borough: ResidentialUnitsByBorough[];
  pre_1940: { lots: number; units: number };
  pre_1974_multifamily: { lots: number; units: number };
};

export type BoroughHeadliner = { borough: string; headline: string; stat: string };

/**
 * data/owners/index.json + data/owners/[slug].json contracts, produced by
 * scripts/etl/05_build_owner_profiles.ts. ENTITY-ONLY — Individual and Unknown/Other owners
 * are never grouped, ranked, or profiled here (see OWNER_CONSOLIDATION_METHODOLOGY.md).
 */
export type OwnerConfidence = "high" | "medium" | "low";

export type OwnerIndexRow = {
  slug: string;
  name: string;
  owner_type: string;
  confidence: OwnerConfidence;
  lots: number;
  total_market_value: number;
  total_assessed_value: number;
  residential_units: number;
  total_units: number;
  borough_count: number;
  boroughs: string[];
};

export type OwnersIndex = {
  meta: { generated_at: string; source_row_count: number; method_note: string };
  owners: OwnerIndexRow[];
};

export type OwnerAlias = { raw: string; lots: number };
export type OwnerBoroughDistRow = { borough: string; lots: number; total_market_value: number };
export type OwnerCountDistRow = { lots: number } & Record<string, string | number>;
export type OwnerTopProperty = {
  bbl: string;
  address: string;
  borough: string;
  market_value: number;
  residential_units: number;
  total_units: number;
  building_class: string;
};

export type OwnerProfile = {
  slug: string;
  name: string;
  owner_type: string;
  confidence: OwnerConfidence;
  evidence: string;
  alias_count: number;
  aliases: OwnerAlias[];
  totals: {
    lots: number;
    total_market_value: number;
    total_assessed_value: number;
    residential_units: number;
    total_units: number;
    borough_count: number;
  };
  borough_distribution: OwnerBoroughDistRow[];
  property_type_distribution: { property_type: string; lots: number }[];
  tax_class_distribution: { tax_class: string; lots: number }[];
  value_band_distribution: { band: string; lots: number }[];
  year_built_distribution: { bucket: string; lots: number }[];
  zip_spread: { zip: string; lots: number }[];
  top_properties: OwnerTopProperty[];
  meta: { generated_at: string };
};

/** data/borough/[slug].json contract, produced by scripts/etl/04_build_aggregates.ts. */
export type BoroughProfile = {
  borough: string;
  meta: { generated_at: string; row_count: number };
  totals: {
    count: number;
    total_market_value: number;
    total_assessed_value: number;
    total_taxable_value: number;
    residential_units: number;
  };
  medians: { median_market_value: number; median_value_per_resid_unit: number; avg_year_built: number };
  tax_class_distribution: { tax_class: string; count: number; total_market_value: number; total_assessed_value: number }[];
  property_type_distribution: { property_type: string; count: number }[];
  value_band_distribution: { band: string; count: number }[];
  entity_mix: { type: string; lots: number; total_value: number; residential_units: number }[];
  zip_breakdown: { zip: string; count: number; total_market_value: number; total_assessed_value: number }[];
  top_entity_owners: Owner[];
  top_properties: { bbl: string; market_value: number; owner_display: string; building_class: string }[];
};

export type InsightsData = {
  placeholder?: boolean;
  meta: { generated_at: string; canonical_row_count: number; note?: string };
  value_bands: ValueBand[];
  concentration: Concentration;
  ownership: Ownership;
  housing: Housing;
  borough_headliners: BoroughHeadliner[];
};
