# Data Quality Report — FY2027 PROPMAST → properties_v2

Computed from the full canonical 1,167,962-row clean CSV (`scripts/etl/01_parse_raw_to_csv.ts`
output) unless noted otherwise. Re-run the ad-hoc analysis scripts used to produce these numbers
via `node --import tsx <script>` against
`.../scratchpad/nyc_property_etl_v2/properties_v2.csv`.

## ⚠️ Storage constraint (read this first)

This Neon project has a **~512MB total storage cap** shared with the still-live `properties`
table (currently 298MB — see `scripts/load-db.mjs`'s original comment, which already flagged this
as the free-tier limit). `properties_v2`'s required column width (untruncated `owner_raw` TEXT,
~30 analytical columns, 2 GIN trigram indexes) is **fundamentally too wide to fit the full
1,167,962-row dataset in the remaining headroom** — the bare table alone (no indexes) extrapolates
to ~492MB at full scale, more than double the ~207MB that was available.

**Current state:** `properties_v2` holds a real, complete, correctly-indexed load of **Staten
Island + Bronx (246,465 of 1,167,962 rows, 21%)** — chosen as the two smallest boroughs so the
loaded data is internally consistent (two whole boroughs, not an arbitrary sample) for
Explorer/UI development and index-performance verification. `owner_groups` (679 rows) and
`owner_aliases` (1,656 rows) are populated for this subset only.

**This does NOT affect the dashboards' accuracy.** `data/aggregates.json`, `data/insights.json`,
and `data/borough/*.json` are computed directly from the full 1,167,962-row CSV
(`scripts/etl/04_build_aggregates.ts`) — a pure file-processing step with no storage constraint —
so all citywide numbers, concentration curves, borough medians, etc. are 100% accurate against
the complete canonical dataset regardless of what fits in Postgres.

**To complete the citywide DB load:** increase the Neon project's storage allocation (e.g. the
Neon "Launch" plan), then re-run `node --env-file=.env.local --import tsx
scripts/etl/02_load_properties_v2.ts` with `ETL_CSV_PATH` pointed at the full
`properties_v2.csv` (no code changes needed — the script already processes whatever CSV it's
given). Regenerate the full CSV first via `scripts/etl/01_parse_raw_to_csv.ts` if it's not still
in the scratchpad. This is the #1 open item for whichever wave owns the Explorer's live
row-level search/filter/pagination against the full dataset.

## Summary counts (full 1,167,962-row canonical dataset)

| Check | Count | % |
|---|---:|---:|
| Total rows | 1,167,962 | 100% |
| Duplicate BBLs (old table, resolved) | 3,791 groups / 8,017 rows | 0.69% |
| Duplicate `bbl_full` (new key) | **0** | 0% |
| Invalid borough code | 0 | 0% |
| Missing owner (`owner_raw` blank) | 43 | 0.004% |
| `"UNAVAILABLE OWNER"` literal placeholder | 11,946 | 1.02% |
| Missing/invalid zip (blank or literal `"0"`) | 24,575 | 2.10% |
| Negative market value | 0 | 0% |
| Negative assessed value | 0 | 0% |
| Assessed value > market value (should never happen) | 0 | 0% |
| Year-built anomalies (<1400 or >2100, nulled) | 2 (source values, nulled at load) | ~0% |
| Owner classified `Unknown/Other` | 9,711 distinct owners (of 935,559 distinct) | 1.04% of distinct owners |
| Residential units > 2,000 (outlier, plausible for NYCHA superblocks) | 12 | — |
| Building area > 5,000,000 sqft (outlier, plausible for hospitals/superblocks) | 13 | — |

## Duplicate BBLs — root cause and resolution

See `DATA_DICTIONARY.md` "Primary key / BBL de-duplication". Confirmed via direct inspection: 100%
of the old table's duplicate-BBL groups are **easement (`EASE`) records** sharing a parent
parcel's BBL (e.g. `2025390020` had 10 PTS records: the base parcel plus 9 lettered easements
A–M owned by NYS DOT / Metro-North / NYC DEP / NYC Transit). `properties_v2` resolves this with a
synthetic `bbl_full = bbl + ease_code` unique key. **Not** a condo-lot duplication issue — condo
units already have distinct LOT numbers in the source data and were never duplicated.

## Missing / invalid values

- **43 rows with a blank owner field** — all appear to be REUC-adjacent or otherwise unusual
  parcels; too few to warrant special handling, left as `owner_raw = NULL` (`owner_entity_type =
  Unknown/Other`, privacy-safe to display since there's no name to protect).
- **11,946 rows with the literal string `"UNAVAILABLE OWNER"`** — a DOF placeholder, not a real
  redaction (i.e. distinct from our own `PRIVATE_OWNER_LABEL`). Classified `Unknown/Other`.
- **24,575 rows with missing/invalid zip.** 601 are genuinely blank; ~23,970 have the raw
  `ZIP_CODE` field set to the literal string `"0"` rather than blank — overwhelmingly government,
  parks, and utility-easement parcels with no mailing address. `transform.ts`'s
  `normalizeZip()` treats both cases as `NULL` rather than storing a fake zip code (a fix applied
  mid-build — the first ETL pass stored `"0"` literally; caught and corrected before finalizing).

## Normalization collisions (owner consolidation coverage)

See `OWNER_CONSOLIDATION_METHODOLOGY.md` for full detail. Citywide: 935,559 distinct raw owner
strings. Government: all 844 distinct government-classified strings collapse into 18 curated
agency buckets (full coverage). Private entities: 3,264 groups formed from exact
normalized-string collisions, covering 6,856 raw spellings (i.e. ~2,100 avg group members-per-2,
meaning most collision groups are simple 2-3-variant punctuation/spacing differences, not large
fan-in) — 243,752 private-entity owners remain correctly ungrouped singletons.

## Outlier spot-checks

- **Extreme value-per-building-sqft** (computed but not stored — see Storage constraint in
  `DATA_DICTIONARY.md`): a handful of lots show >$10,000/sqft, e.g. BBL `3027400022` (building
  class `Z0`, theme park/misc — near-zero recorded `GROSS_SQFT` against a large market value) and
  several `4068021xxx` BBLs (building class `R3`, small condo units with a tiny recorded gross
  sqft in the source data). These are source-data artifacts (buildings genuinely having tiny or
  zero recorded `GROSS_SQFT` while carrying real market value), not an ETL bug — any UI computing
  $/sqft on the fly should treat `building_area` as unreliable below some floor (e.g. <100 sqft)
  and fall back to null rather than a nonsensical per-sqft figure.
- **Residential/total units:** 12 lots exceed 2,000 residential units — plausible for large NYCHA
  developments and superblocks (spot-checked a sample, all NYCHA-owned). Not treated as errors.
- **Building area >5M sqft:** 13 lots, spot-checked as large hospital campuses / institutional
  superblocks (e.g. major medical centers) — plausible, not errors.
- **Year-built:** only 2 source rows had a `YRBUILT` value outside the plausible (1400, 2100]
  range; both nulled by `transform.ts` rather than stored. No `YRBUILT = 1` sentinel-value rows
  were found in this extract (a known DOF anomaly pattern in some other years' rolls) — the guard
  is kept defensively.

## Government/entity classification spot-checks

Manually verified against the spec's required examples (also covered by
`tests/owners.classify.test.ts`, 13/13 passing): `DEPARTMENT OF EDUCATION` → Government, `NYC
PARKS` → Government, `NEW YORK UNIVERSITY` → Nonprofit/Institution, `XYZ OWNER LLC` → LLC, `JOHN
SMITH` → Individual, `JOHN SMITH REVOCABLE TRUST` → Trust/Estate, `RIVERBAY CORPORATION` →
Housing company, `GLEN OAKS VILLAGE OWNERS INC` → Cooperative corporation. A classification bug
was found and fixed mid-build: punctuated suffixes (`"44 WEST 11TH STREET, L.L.C."`, `"29 CHELSEA
SQUARE NORTH, L.P."`) were falling through to `Unknown/Other` because the LLC/Partnership regexes
ran against the raw uppercased string, where `\bLLC\b` doesn't match `L.L.C.` (periods break the
word boundary) — fixed by running those specific checks against the punctuation-normalized string
instead (`lib/owners/classify.ts`). Foreign diplomatic missions (`"PERMANENT MISSION OF..."`,
`"...REPUBLIC OF..."`) were also found misclassified as `Unknown/Other` and added as a Government
pattern (sovereign-owned property).

## Condo-lot duplication check

No condo-lot duplication found. Each condo unit (`building_class` starting `R`) has its own
distinct `LOT` number in the source data (confirmed via direct inspection — condo unit lots are
sequential, e.g. `1001`, `1002`, ... within a block), so `bbl` (boro+block+lot) is already unique
per condo unit without needing `ease_code`. The only source of BBL duplication was easements (see
above).

## Known limitations (carried forward from DATA_DICTIONARY.md)

- Source-truncated owner names (DOF's raw `OWNER` field is fixed-width at 80 chars).
- `geocoding_status = 'pending'` for 100% of rows — lat/long deferred to a later wave.
- `properties_v2` DB load is partial (Staten Island + Bronx) pending a Neon storage increase; all
  JSON aggregate/insight files are computed from the full dataset and unaffected.
