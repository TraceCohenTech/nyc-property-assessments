# `data/analytics/` — Analytics Layer

Built by `scripts/etl/09_build_analytics.ts` (step 9 of the ETL, read-only against
`db/properties.db`). Run with:

```
node --import tsx scripts/etl/09_build_analytics.ts
```

Safe to re-run — every file is fully rebuilt from `properties_v2` / `owner_groups` /
`rent_stabilized` each time (no incremental state).

## Privacy rule (hard, applies to every file below)

Any owner-level field is **entity-only**. Concretely: every per-owner leaderboard/grouping in
this directory is built by joining on a non-null `owner_group_id`, which — by construction in
`scripts/etl/05_build_owner_profiles.ts` (see `OWNER_CONSOLIDATION_METHODOLOGY.md`) — is **never**
assigned to `Individual` or `Unknown/Other` owners, and is only assigned to a *repeated* private
entity name (exact `owner_normalized` match) or a curated government agency. A singleton
private LLC/Corp/etc. that owns only one lot has `owner_group_id = NULL` and is therefore
excluded from every named-owner list here — it only shows up in aggregate counts bucketed by
`owner_entity_type` (a classification, never a name). No individual's name appears anywhere in
this directory.

**Known consequence worth flagging**: because grouping requires an *exact* repeated name match,
`ownership_concentration.json`'s "3,282 tracked entity owner groups" understate true corporate
concentration — many single-building holding-company LLCs (a common NYC ownership structure)
never get grouped and are invisible to the top-N leaderboards, even though they're correctly
counted as `LLC` in the aggregate splits. Treat the top-N owner-group numbers as a conservative
floor on concentration, not a ceiling.

## Validation baseline

All files are built from the same `properties_v2` scan, cross-checked at script end against
`data/aggregates.json`:

- Lots: **1,167,962** (exact match)
- Citywide market value: **$1,911,446,867,962** (~$1.91T)
- Citywide assessed value: **$536,131,027,415**
- Citywide exempt value: **$176,885,449,301**

---

## `tax_burden.json`

Effective assessment ratios (`SUM(assessed_value)/SUM(market_value)` and
`SUM(taxable_value)/SUM(market_value)`) by tax class and by borough, plus per-lot ratio
percentiles (p10/p25/median/p75/p90).

- `citywide_by_base_class_family` — rolled up to the 4 statutory classes (1/2/3/4; subclasses
  1A-1D and 2A-2C merged into their parent).
- `citywide_by_tax_class` — full detail at the raw `tax_class` code (1, 1A, 1B, 1C, 1D, 2, 2A,
  2B, 2C, 3, 4).
- `matrix_by_tax_class_x_borough` / `matrix_by_family_x_borough` — same metrics crossed with
  borough.
- `meta.caption` has a ready-to-use sentence with the real class 1 vs 2 vs 4 numbers baked in.

**Exclusions**: rows with `market_value <= 0` dropped (ratio undefined).

**Key finding**: Class 1 (1-3 family homes) assesses at **~6.0%** of market value citywide vs
**~45.0%** for Class 2 (apartments/co-ops/condos) and Class 3/4 — this is a structural gap set by
NY State's RPTL §1805 assessment-ratio caps, not a market artifact, and it's essentially a flat
line across all 5 boroughs (checked via the borough matrix).

## `treemap.json`

Hierarchy `NYC -> borough -> property_type -> building_class`, each node
`{name, lots, market_value}`.

**Exclusions**: rows with `building_class IS NULL` dropped. Building-class leaves under a given
`(borough, property_type)` parent with `market_value < $100,000,000` are collapsed into a
per-parent `"Other"` leaf (`prune_threshold_usd` in `meta`) to keep the node count sane for a
treemap chart.

## `timeline.json`

Per construction-decade rollup: `lots`, `residential_units`, `total_market_value`,
`by_borough` (stacked breakdown), and the `dominant_property_type` (by lot count) that decade.

Decade buckets: `<1900` (all pre-1900 construction, sparse long tail), `1900s`...`2020s`
(standard decade = `floor(year_built/10)*10`), `Unknown` (year_built NULL or 0 — the DB guards
`year_built` to the range `(1400, 2100]` per `DATA_DICTIONARY.md`, but ~10% of rows still have no
value on file).

**Exclusions**: none — every row lands in exactly one bucket.

**Key finding**: the **1920s** produced more of NYC's still-standing building stock than any
other decade (192,358 lots), dominated by `one-family` homes — the classic outer-borough
rowhouse/bungalow building boom.

## `exemptions.json`

- `by_borough` / `by_tax_class` / `by_owner_entity_type` — exempt vs. taxable vs. market value,
  plus `share_of_value_exempt = exempt / (exempt + taxable)`.
- `government_nonprofit_vs_private` — the same split collapsed to two buckets.
- `top_20_exempt_entity_owner_groups` — entity-only (see privacy rule above), ranked by total
  exempt value.

**Exclusions**: the top-owner list requires a non-null `owner_group_id` (entity-only).

**Key finding**: NYC Parks & Recreation is the single largest exempt-value owner
(**$16.9B exempt** across 5,053 lots); citywide, government+nonprofit lots are **49.1% exempt by
value** vs. **19.0%** for the private-aggregate bucket (which still includes co-ops/condos'
partial abatements, hence non-zero).

## `sqft_percentiles.json`

`$/sqft = market_value / building_area`, percentile distributions (p10/p25/median/p75/p90) by
`property_type x borough`, plus a per-zip median (`by_zip`).

**Exclusions**: requires `building_area > 0` and `market_value > 0`. The **top/bottom 0.5%** of
the *citywide* `$/sqft` distribution is trimmed as outliers (data-entry artifacts: sub-10sqft
outbuilding records, near-zero misfires) **before** any grouping — the same trimmed population
feeds `zip_league.json`'s `median_price_per_sqft` for consistency. Per-zip rows additionally
require `n >= 5` valid lots (189 of ~240 raw zip codes clear this bar).

**Key finding**: Manhattan condo $/sqft is remarkably tight (p10 $234 → p90 $541, ~2.3x spread)
compared to the outer boroughs, where the spread is far wider (Bronx condo p10 $70 → p90 $422,
~6x) — a handful of new-construction luxury condo buildings sit next to legacy low-value stock
inside the same borough/property_type bucket.

## `extremes.json`

Top-25 leaderboards: `biggest_by_residential_units`, `biggest_by_building_area`,
`most_valuable_single_lots`, `highest_value_per_residential_unit` (min 10 units),
`oldest_still_standing`, `largest_vacant_land_holdings_by_owner_group` (entity-only, ranked by
summed `lot_area`), `largest_single_vacant_lots`.

**Exclusions**: the relevant metric field must be `> 0`. `highest_value_per_residential_unit`
requires `residential_units >= 10` to avoid 1-2-unit noise. `oldest_still_standing` requires
`year_built > 1700` (sub-1700 rows in this dataset are near-certainly data errors — the DB's
guard floor is 1400, which is implausible for an NYC structure still standing). Vacant-land
leaderboards require `property_type = 'vacant land'` and `lot_area > 0`; the owner-group version
requires a non-null `owner_group_id` (entity-only). Individual-lot rows carry
`owner_group_name: null` unless that lot's owner resolved to an entity group — never an
individual's name.

**Key finding (surprising)**: the single most valuable "lot" in NYC by market value is
**154-68 Brookville Blvd, Queens at $18.88B** — this isn't a data error, it's **JFK Airport**
(owned by the Port Authority of NY & NJ, classified `utility`/building class `T1`, ~4,920-acre
lot), assessed as one PTS record.

## `zip_league.json`

One row per zip: `borough`, `lots`, `total_market_value`, `median_market_value`,
`median_price_per_sqft` (from the same trimmed population as `sqft_percentiles.json`),
`residential_units`, `llc_share` / `government_share` (fraction of lots), `dominant_property_type`,
and `value_band_distribution` (the 8 existing `value_band` buckets, as counts, for small-multiple
bars).

**Exclusions**: rows with `zip IS NULL` excluded (24,575 rows citywide — mostly government/park/
utility parcels with no mailing address, see `DATA_DICTIONARY.md`). Zips with fewer than 10 lots
excluded as non-neighborhood codes (single-skyscraper PO-box zips like 10154/10167, campus zips,
the fictitious `12345`, out-of-city zips that leak into the source data like Pelham NY's `10803`).
**185 zips clear the bar** (spec estimate was ~191 — close; the gap is exactly these long-tail
single-building/bogus codes).

## `ownership_concentration.json`

- `cumulative_value_share` — top 10/50/100/500/all entity owner-groups' share of **citywide**
  market value (not just entity-controlled value).
- `ownership_splits` — government / private-entity-aggregate / individual / unknown-other, each
  as lots + market value + share of citywide value.
- `llc_share_by_borough` — LLC share of value and of lot count, per borough.
- `owner_groups_over_1b` / `owner_groups_over_100m` — counts of entity owner-groups whose summed
  market value exceeds $1B / $100M.

**Exclusions**: see the privacy-rule note above re: singleton LLCs being invisible to the
owner-group ranking. Splits by `owner_entity_type` use all rows (no grouping requirement).

**Key finding**: the top 10 tracked entity owner-groups control only **8.0%** of citywide value
(NYC Parks & Rec, NYC DOE/SCA, Port Authority, NYCHA, etc. — government dominates the *tracked*
top since private ownership is far more fragmented under the exact-name-match method). Manhattan
has by far the highest LLC value-share (**43.3%**) vs. Staten Island's **7.7%**. 16 entity groups
individually control >$1B in property value; 61 control >$100M.

## `rent_overlays.json`

- `stabilized_share_of_structural_candidates` — HCR-registered share of "structural candidate"
  stock (see below), by borough and by zip.
- `abatements_by_decade` — 421-a vs. J-51 counts among HCR-registered buildings, by the
  underlying building's construction decade.
- `stabilized_stock_by_owner_entity_type` — HCR-registered building counts by owner entity type.

**Exclusions**: "structural candidate" = a non-easement `properties_v2` row (`ease_code IS NULL`,
to avoid double-counting the ~3,791 easement-duplicated BBLs) with `1 <= year_built < 1974`,
`residential_units >= 6`, and `property_type IN ('walk-up apt', 'elevator apt', 'small
multifamily')` — a structural proxy for "could plausibly be rent-stabilized" per the classic
ETPA/RSL applicability rule, **not** a legal determination. Zip breakdown requires >= 15
candidates. `rent_stabilized.bbl` (no ease code) is joined only to each BBL's non-easement
`properties_v2` row. See `RENT_REGULATION_METHODOLOGY.md` for the HCR source and join-quality
detail (99.99% match rate on the 47,278 HCR-listed buildings).

**Key finding**: Queens has the highest stabilized share of its pre-1974 6+ unit stock
(**83.5%**) vs. Staten Island's **50.5%** (small denominator, few pre-1974 6+ unit buildings
there at all). 421-a counts are concentrated almost entirely in the 2000s-2020s (new-construction
abatement), while J-51 skews toward 1900s-1930s prewar buildings (renovation abatement) — exactly
what each program is designed to do.

## `story.json`

10 curated findings for a scrollytelling page, each
`{id, headline_stat, value, comparison, supporting_series, source_file}`. Every number is pulled
directly from the corresponding file above (`source_file`) — nothing invented. See the file for
the full list; highlights: the Class 1/2/4 assessment gap, JFK Airport as the single most
valuable lot, NYC Parks & Rec as both the largest entity owner and the largest exempt-value
owner, the 1920s construction peak, and the Queens vs. Staten Island rent-stabilization gap.
