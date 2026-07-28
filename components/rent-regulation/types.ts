// Local type contracts for data/rent/rent_summary.json + data/rent/hcr_buildings.json.
// Kept inside components/rent-regulation/ (rather than the shared lib/types.ts) so this wave
// doesn't touch files owned by concurrently-running agents.

export type RentSummary = {
  meta: {
    generated_at: string;
    source: string;
    source_year: string;
    source_files: string[];
    unparseable_rows_dropped: number;
  };
  join_stats: {
    distinct_hcr_bbls: number;
    exact_bbl: number;
    address_assisted: number;
    condo_quirk_bucket: number;
    unmatched: number;
    match_rate: number;
  };
  confirmed: {
    total_buildings: number;
    by_borough: { borough: string; count: number }[];
    by_value_band: { band: string; count: number }[];
    by_owner_entity_type: { type: string; count: number }[];
    by_unit_band: { band: string; count: number }[];
    by_age_band: { band: string; count: number }[];
    by_property_type: { property_type: string; count: number }[];
    flags: {
      y421a: number;
      j51: number;
      coop_condo_conversion: number;
      hotel_sro: number;
      garden_complex: number;
    };
  };
  candidates: {
    total_lots: number;
    total_estimated_units: number;
    by_borough: { borough: string; lots: number; units: number }[];
    note: string;
  };
  overlap: {
    candidate_and_hcr_confirmed: number;
    candidate_only_not_in_hcr: number;
    hcr_confirmed_not_candidate: number;
  };
  top_entity_owner_groups: {
    owner_group_id: number;
    name: string;
    owner_type: string;
    hcr_buildings: number;
    residential_units: number;
    total_market_value: number;
  }[];
};

export type RentStatus = "hcr_confirmed" | "likely_structural_candidate" | "tax_benefit_regulated" | "unknown" | "not_identified";

export type LookupResult = {
  found: boolean;
  bbl?: string;
  address?: string | null;
  borough?: string;
  status: RentStatus;
  hcr_listed: boolean;
  status_codes?: string[];
  y421a?: boolean;
  j51?: boolean;
  coop_condo_conversion?: boolean;
  hotel_sro?: boolean;
  garden_complex?: boolean;
  join_confidence?: string;
  source_year?: string;
};
