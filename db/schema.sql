-- properties_v2, owner_groups, owner_aliases — the new canonical data model.
-- Built ALONGSIDE the live `properties` table (never dropped/altered here). A later wave
-- cuts the app over once the UI/Explorer agents have migrated their queries.
--
-- Generated/applied by scripts/etl/02_load_properties_v2.ts and
-- scripts/etl/03_build_owner_groups.ts — this file documents the schema for reference; the
-- scripts are the source of truth for exact DDL executed against Neon.

CREATE TABLE IF NOT EXISTS properties_v2 (
  id SERIAL PRIMARY KEY,
  bbl VARCHAR(10) NOT NULL,               -- standard 10-digit NYC BBL (boro+block+lot). NOT unique alone — easement
                                           -- parcels share the parent lot's BBL (see ease_code).
  ease_code VARCHAR(1),                   -- PTS EASE code (A/B/E/F-M/N/P/R/S/U), null for the ordinary parcel row
  bbl_full VARCHAR(11) NOT NULL UNIQUE,   -- bbl + ease_code — the true unique row key, resolves the 3,791 dup-BBL
                                           -- groups found in the old `properties` table (all were easement rows:
                                           -- ROW/utility easements sharing the parent lot's BBL, e.g. NYS DOT /
                                           -- Metro-North / NYC DEP easement parcels on the same block+lot).
  borough_code VARCHAR(1) NOT NULL,
  borough_name VARCHAR(13) NOT NULL,
  block VARCHAR(5) NOT NULL,
  lot VARCHAR(4) NOT NULL,
  house_number_lo VARCHAR(12),
  house_number_hi VARCHAR(12),
  street_name VARCHAR(30),
  full_address VARCHAR(60),
  zip VARCHAR(5),
  owner_raw TEXT,                         -- untruncated (old table truncated to VARCHAR(60) and lost trust names)
  owner_normalized TEXT,
  owner_entity_type VARCHAR(24) NOT NULL, -- Individual|LLC|Corporation|Partnership|Trust/Estate|Government|
                                           -- Nonprofit/Institution|Cooperative corporation|Housing company|Unknown/Other
  owner_group_id INTEGER REFERENCES owner_groups(owner_group_id),
  tax_class VARCHAR(2),
  building_class VARCHAR(4),
  building_class_description TEXT,
  property_type VARCHAR(32) NOT NULL,
  residential_units INTEGER,
  total_units INTEGER,
  commercial_units INTEGER,
  year_built SMALLINT,
  lot_area INTEGER,
  building_area INTEGER,
  market_value BIGINT,
  assessed_value BIGINT,
  taxable_value BIGINT,
  exempt_value BIGINT,
  value_band VARCHAR(16) NOT NULL,
  -- value_per_resid_unit / value_per_total_unit / value_per_bldg_sqft are intentionally NOT
  -- stored columns (Neon project storage cap — see "Storage constraint" in
  -- DATA_QUALITY_REPORT.md). They're computed by the ETL and present in data/aggregates.json +
  -- insights.json; per-property values should be computed on read from market_value /
  -- residential_units / total_units / building_area (cheap integer math, no need to store).
  latitude DOUBLE PRECISION,              -- null until a later wave geocodes from MapPLUTO centroids
  longitude DOUBLE PRECISION,
  geocoding_status VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending|geocoded|failed|not_applicable
  coop_number INTEGER,
  source_year VARCHAR(8) NOT NULL,
  source_dataset VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_groups (
  owner_group_id SERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  owner_type VARCHAR(24) NOT NULL,        -- same enum as owner_entity_type
  display_name TEXT NOT NULL,
  confidence VARCHAR(10) NOT NULL,        -- Confirmed|High|Medium|Low|Unresolved
  evidence_type VARCHAR(32) NOT NULL,     -- curated-agency-list|exact-normalized-match|manual
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owner_aliases (
  id SERIAL PRIMARY KEY,
  owner_name_raw TEXT NOT NULL,
  owner_name_normalized TEXT NOT NULL,
  owner_group_id INTEGER REFERENCES owner_groups(owner_group_id),
  match_type VARCHAR(24) NOT NULL,        -- curated-agency|exact-normalized|singleton
  confidence VARCHAR(10) NOT NULL,        -- Confirmed|High|Medium|Low|Unresolved
  source VARCHAR(32) NOT NULL DEFAULT 'fy2027-pts',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the Explorer's filter surface.
CREATE INDEX IF NOT EXISTS idx_pv2_bbl ON properties_v2 (bbl);
CREATE INDEX IF NOT EXISTS idx_pv2_borough ON properties_v2 (borough_code);
CREATE INDEX IF NOT EXISTS idx_pv2_zip ON properties_v2 (zip);
CREATE INDEX IF NOT EXISTS idx_pv2_owner_normalized ON properties_v2 (owner_normalized);
CREATE INDEX IF NOT EXISTS idx_pv2_owner_group_id ON properties_v2 (owner_group_id);
CREATE INDEX IF NOT EXISTS idx_pv2_tax_class ON properties_v2 (tax_class);
CREATE INDEX IF NOT EXISTS idx_pv2_building_class ON properties_v2 (building_class);
CREATE INDEX IF NOT EXISTS idx_pv2_property_type ON properties_v2 (property_type);
CREATE INDEX IF NOT EXISTS idx_pv2_market_value ON properties_v2 (market_value);
CREATE INDEX IF NOT EXISTS idx_pv2_residential_units ON properties_v2 (residential_units);
CREATE INDEX IF NOT EXISTS idx_pv2_year_built ON properties_v2 (year_built);

-- Trigram indexes (pg_trgm already installed on this Neon project) -- kills the 611ms
-- unindexed ILIKE '%term%' seq scan the old `properties` table had on address/owner search.
CREATE INDEX IF NOT EXISTS idx_pv2_full_address_trgm ON properties_v2 USING GIN (full_address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pv2_owner_normalized_trgm ON properties_v2 USING GIN (owner_normalized gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_owner_aliases_normalized ON owner_aliases (owner_name_normalized);
CREATE INDEX IF NOT EXISTS idx_owner_aliases_group_id ON owner_aliases (owner_group_id);
