# Analytics Definitions

Every metric shown in the app, its exact formula, and what it excludes. All figures derive from
the NYC DOF FY2027 PROPMAST assessment roll (Tax Classes 1–4) unless noted. See
`DATA_DICTIONARY.md` for raw source-field mapping and `DATA_QUALITY_REPORT.md` for known data
issues.

## Tax lot count

**Definition**: one row per `bbl_full` (BBL + easement code) in `properties_v2`. A standard tax
lot has `ease_code IS NULL`; easement parcels (utility/ROW easements — NYS DOT, Metro-North, NYC
DEP, etc.) share their parent lot's 10-digit BBL but get their own row (distinct `bbl_full`)
because they can carry their own assessed value. **1,167,962 total rows** citywide.

**Exclusions**: when a page says "N properties" filtered by some criterion, it is counting
`bbl_full` rows matching that filter — a parent lot with 2 easement rows counts as up to 3 "lots"
if all 3 match the filter. Deduplicating to unique base-BBL parcels is not done anywhere in the
UI (there is no toggle for it); `/properties/[bbl]` explicitly lists sibling easement rows so
this is visible, not hidden.

## Market value

**Definition**: DOF's `market_value` field as published on the FY2027 roll — DOF's own estimate
of a property's full market value, computed via DOF's statutory valuation methods per tax class
(sales-comparison for Class 1, income-capitalization for most Class 2/4, cost approach for
utilities/special-purpose). **Not** an appraisal, sale price, or assessed value.

**Exclusions**: null for a small number of exempt/government/special parcels where DOF does not
publish a market value; treated as `NULL`, never coerced to 0, and excluded from
sum/average aggregates (not counted as $0).

## Assessed value

**Definition**: DOF's `assessed_value` — the value actually used to compute property tax, after
statutory assessment-ratio caps and phase-in rules (these differ by tax class; Class 1 has
aggressive year-over-year assessment-increase caps that keep `assessed_value` well below
`market_value` for many owner-occupied homes). This is **not** simply `market_value × a fixed
ratio** — the caps are property-specific and path-dependent on prior years' assessments, which
this single-year roll snapshot cannot fully reconstruct; the app reports the roll's published
figure as-is and does not attempt to back out the cap math.

## Taxable value / Exempt value

**Definition**: `taxable_value` = the portion of `assessed_value` actually subject to tax, after
any exemptions (e.g. STAR, 421-a, J-51, government/nonprofit full exemptions) are subtracted.
`exempt_value` = the exempted portion. For most fully-exempt parcels (government buildings,
houses of worship, some nonprofits), `taxable_value` is 0 and `exempt_value` equals
`assessed_value`.

**Exclusions**: exemption *type* (which program granted the exemption) is not in this dataset —
only the resulting dollar amounts. A property showing a large exempt value could be under any of
dozens of NYC/NYS exemption programs; this app cannot distinguish them.

## Residential units vs. total units

**Definition**: `residential_units` = DOF's count of residential units on the lot.
`total_units` = DOF's count of all units (residential + commercial + other). For 1-4 family
homes these are usually equal; for mixed-use buildings `total_units > residential_units`.

**Units used for "value per unit"**: the app's `value_per_unit` calculation
(`app/api/properties/route.ts`'s `toListItem`) uses `residential_units || total_units || null` —
i.e. prefers the residential count, falls back to total units only if residential is null/zero,
and is `null` (never divides by zero or shows a misleading $0/unit) when both are null/zero.

## Value per unit / value per sqft

**Formulas**:
- `value_per_unit = round(market_value / units)` where `units` is as defined above.
- `value_per_sqft = round((market_value / building_area) * 100) / 100` (2 decimal places).

**Exclusions**: both are `null` when `market_value` is null, when the denominator is null, or
when the denominator is 0 (no division-by-zero rows). Vacant land and most utility/parking lots
have `building_area = 0` or `null` and so never get a `value_per_sqft` figure. These are
per-property point calculations — the citywide/borough "value per unit" figures shown on
`/housing` are computed differently, as an aggregate ratio (`sum(market_value) / sum(units)`
across the relevant cohort), not an average of per-property ratios, to avoid small-denominator
lots skewing the average.

## LLC-owned value / owner-group value

**Definition**: sum of `market_value` across all rows where `owner_entity_type = 'LLC'` (for
"LLC-owned value") or across all rows sharing an `owner_group_id` (for a specific owner-group's
portfolio value, shown on `/owners/[slug]`).

**Owner grouping caveat**: `owner_group_id` reflects **name-based consolidation**
(`OWNER_CONSOLIDATION_METHODOLOGY.md`), not a verified legal beneficial-ownership graph. A
portfolio total on an owner profile reflects properties whose owner string matched that group's
canonical name/alias set — it is not a substitute for ACRIS deed records or a corporate registry
search, and could under- or over-count a real owner's true holdings (see Known Limitations in
`README.md`).

## Entity type (owner classification)

**Categories**: `Individual`, `LLC`, `Corporation`, `Partnership`, `Trust/Estate`, `Government`,
`Nonprofit/Institution`, `Cooperative corporation`, `Housing company`, `Unknown/Other`. Full
rule-by-rule classification logic (first-match-wins order, exact phrase lists, regex patterns) is
documented in `OWNER_CONSOLIDATION_METHODOLOGY.md` and implemented in `lib/owners/classify.ts`.

**Privacy note**: `Individual` is the only category whose raw name is never shown publicly — see
the Privacy sections in `README.md` / `ARCHITECTURE.md`.

## Value band

**Definition**: a fixed bucket derived from `market_value` (`scripts/etl/transform.ts`,
`valueBand()`): `<$500K`, `$500K–1M`, `$1M–2M`, `$2M–5M`, `$5M–10M`, `$10M–20M`, `$20M–50M`,
`$50M+`. Rows with a null or negative `market_value` get `"Unknown"` (excluded from the
`/value-concentration` band breakdowns, which only chart the 8 real bands).

## Property type

**Definition**: a rollup derived from DOF `building_class` (first letter) + `residential_units` +
`coop_number`, computed once at ETL time (`derivePropertyType()` in `scripts/etl/transform.ts`)
and stored as `property_type`. Notable rules: `coop_number > 0` always wins (classified as
`"coop"` regardless of building class letter); Class-C buildings split into `"small
multifamily"` (≤10 residential units) vs. `"walk-up apt"` (11+) since C-class covers both;
Class-R lots are `"condo"`. Full letter-to-category mapping is in `scripts/etl/transform.ts`.
This is a **rollup for filtering/charting convenience**, not DOF's own category system — DOF's
authoritative classification is the raw `building_class` code (see `db/building_class_codes.json`
for the full code table), which the app also surfaces as-is on every property detail page.

## HCR-listed building

**Definition**: a BBL present in NYS HCR's 2024 building registration file (via NYC Rent
Guidelines Board's published PDFs), joined onto `properties_v2` by BBL. **47,277 of 47,278**
source buildings matched (99.998%) — the 1 unmatched building could not be resolved to a current
BBL (address/BBL mismatch in the source PDF; see `RENT_REGULATION_METHODOLOGY.md` for the
specific case).

**Meaning**: "this building has at least one HCR-registered rent-stabilized unit as of the 2024
filing." **Does not mean** every unit in the building is stabilized, and does not report *how
many* units are stabilized (HCR's building-level registration file doesn't include a unit count
per building — only DHCR's non-public unit-level registration system would). Status can also
change year to year (buildings deregulate via high-rent/high-income vacancy decontrol prior to
2019 rules, 421-a/J-51 exemption expiration, substantial rehabilitation, etc.) — this is a
**2024 snapshot**, not a live regulatory status.

## Likely-candidate (rent-stabilization structural-candidate layer)

**Definition**: a heuristic overlay used only on `/rent-regulation` to estimate how many
buildings on the roll *structurally resemble* typical rent-stabilized housing stock, independent
of the HCR list — used to sanity-check the HCR join's coverage, not as a stabilization
determination. Exact SQL predicate (`scripts/etl/08_ingest_hcr.ts`, `CANDIDATE_WHERE`):

```sql
year_built IS NOT NULL AND year_built > 0 AND year_built < 1974
AND residential_units IS NOT NULL AND residential_units >= 6
AND tax_class LIKE '2%'
AND (building_class LIKE 'C%' OR building_class LIKE 'D%' OR building_class LIKE 'S%')
AND building_class NOT LIKE 'R%'
```

i.e.: built before 1974 (the year new construction generally lost automatic stabilization
coverage absent a tax-exemption program), 6+ residential units (the traditional Rent
Stabilization Law threshold), Class 2 (multifamily), building class C/D/S (walk-up, elevator
apt, or mixed-residential-commercial with residential units — not R-class condo unit lots).

**This is NOT a stabilization determination.** It flags buildings that are old enough, large
enough, and the right tax/building class to *plausibly* have stabilized units — many candidate
buildings have since been fully deregulated, converted to condo/co-op, or were never actually
registered. The per-BBL candidate set is used only to compute an aggregate overlap statistic
against the real HCR list (how many candidates are HCR-confirmed vs. not, and vice versa) — it
is explicitly **not persisted as a per-property public flag** (see the code comment: "not
persisted per-BBL in the public JSON, per spec") specifically to avoid the page implying
individual-building certainty it doesn't have.

## Confidence levels (`/methodology`)

Each data source on `/methodology` is labeled `Available`, `Estimated`, or `Planned` to set
accurate expectations: `Available` = joined/computed from a real published source at the stated
match rate; `Estimated` = a modeled/derived figure (e.g. valuation-cap back-outs the app does
*not* attempt, per Assessed Value above — none currently shown as "Estimated"); `Planned` =
described in docs/UI but not yet shipped (currently only geocoding/map coordinates).
