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

export type Concentration = {
  curve: ConcentrationPoint[];
  top_n: number;
  pct_lots_for_50pct_value: number;
  pct_lots_for_80pct_value: number;
  lots_above_10m: number;
  lots_above_50m: number;
};

export type OwnershipByType = { type: string; lots: number; total_value: number };

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

export type InsightsData = {
  placeholder?: boolean;
  meta: { generated_at: string; canonical_row_count: number; note?: string };
  value_bands: ValueBand[];
  concentration: Concentration;
  ownership: Ownership;
  housing: Housing;
  borough_headliners: BoroughHeadliner[];
};
