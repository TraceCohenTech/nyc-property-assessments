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
