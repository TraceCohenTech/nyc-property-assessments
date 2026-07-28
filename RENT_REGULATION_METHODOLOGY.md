# Rent Regulation — Methodology

How `/rent-regulation` is built: source files, parse method, the BBL join, the estimate layer,
and every caveat that governs how this data may (and may not) be described.

## Source files

**Primary source: the official NYC Rent Guidelines Board "Rent Stabilized Building Lists"** —
five PDFs, one per borough, published at
[rentguidelinesboard.cityofnewyork.us/resources/rent-stabilized-building-lists](https://rentguidelinesboard.cityofnewyork.us/resources/rent-stabilized-building-lists/).
These are RGB's own re-publication of **NYS Homes & Community Renewal (HCR)'s annual building
registration file** — RGB's page states the release is "2024 Building Registrations filed with
NYS Homes and Community Renewal (HCR), as of November 2025."

No community mirror (e.g. nycdb) was used. A real attempt at the official PDFs was made first
and succeeded — they are clean, vector-text tables (not scanned images), fully parseable with
`pdftotext -layout`. Files ingested:

| Borough | Source URL | Rows parsed |
|---|---|---|
| Manhattan | `.../2024-DHCR-Bldg-File-Manhattan.pdf` | 14,497 |
| Brooklyn | `.../2024-DHCR-Bldg-File-Brooklyn.pdf` | 17,614 |
| Bronx | `.../2024-DHCR-Bldg-File-Bronx.pdf` | 7,955 |
| Queens | `.../2024-DHCR-Bldg-File-Queens.pdf` | 10,374 |
| Staten Island | `.../2024-DHCR-Bldg-File-Staten-Island.pdf` | 439 |

Total: **50,879 raw rows**, 0 dropped as unparseable (see parse-quality section below). Full
URL prefix: `https://rentguidelinesboard.cityofnewyork.us/wp-content/uploads/2025/12/`.

**Release year: 2024** registrations (the most recent RGB has published as of this build).
Source fields per row: ZIP, BLDGNO1/STREET1/STSUFX1 (primary address), BLDGNO2/STREET2/STSUFX2
(secondary address, e.g. a corner address), CITY, COUNTY (NYS county code), STATUS1/STATUS2/STATUS3
(free-text status flags), BLOCK, LOT.

## Parse method

The PDFs are fixed-width tables rendered with a proportional font, extracted via
`pdftotext -layout` (Homebrew poppler, already present in this environment — no OCR needed).

The RGB header row (`ZIP BLDGNO1 STREET1 ...`) repeats on every page. **Column x-offsets drift
by 1-2 characters page to page** (an artifact of `-layout`'s proportional-font column-position
heuristic, not a true monospace grid) — a naive parser using only the *first* page's header
offsets for the whole document fails badly on later pages: an early version of this script
measured an **85% column-slice failure rate on Bronx and Queens** using that approach. The fix:
recompute column offsets from the **most recently seen header line**, not a single global one.
That change took the failure rate to **0.16% (Manhattan only), 0% everywhere else** —
production-quality for a public PDF table.

The residual Manhattan cases are rows where a long secondary street name (e.g. "ADAM CLAYTON
POWELL JR BLVD") wraps across 2-3 physical PDF text lines, pushing BLOCK/LOT off the row
entirely. These are recovered with a fallback: scan up to 3 following lines for a trailing
`(\d+)\s+(\d+)$` pair (block, then lot) and merge. After that fallback, **0 rows were dropped
as genuinely unparseable** across all 50,879 source rows (`unparseable_rows_dropped: 0` in
`data/rent/hcr_buildings_raw.json` meta — the field exists and is checked on every rerun; it is
not hardcoded to zero, it happened to measure zero on this ingest).

## BBL normalization

`bbl = borough_digit + block.padStart(5, "0") + lot.padStart(4, "0")` — the standard 10-digit
NYC BBL, borough digit mapped from the source file (Manhattan=1, Bronx=2, Brooklyn=3, Queens=4,
Staten Island=5), matching the same convention `properties_v2.bbl` uses in `db/properties.db`.

Addresses are recorded as `BLDGNO1 STREET1 STSUFX1`, uppercased, whitespace-collapsed. Secondary
address fields (BLDGNO2/STREET2/STSUFX2) are parsed but not currently surfaced in the UI (kept
in `hcr_buildings_raw.json` for future use — e.g. corner buildings with two addressable faces).

## Dedupe rules

Multiple RGB rows can point at the same BBL (a corner-address entry and a plain-address entry
for the same building, or duplicate registration entries). Rows are grouped by `bbl`; within a
group, **all distinct STATUS1/2/3 values across every raw row are unioned** into that BBL's
`status_codes[]`, and the boolean flags (`y421a`, `j51`, `coop_condo_conversion`, `hotel_sro`,
`garden_complex`) are re-derived from the unioned set — so a flag set by any one raw row survives
the dedupe. Result: **50,879 raw rows → 47,278 distinct BBLs** (1,290 BBLs had 2+ raw rows).

Flag detection is a case-insensitive substring match against the unioned status text:
- `y421a`: contains `421-A`
- `j51`: contains `J-51`
- `coop_condo_conversion`: contains `COOP/CONDO` (covers `COOP/CONDO`, `NON-EVICT COOP/CONDO`,
  `COOP/CONDO PLAN FILE`)
- `hotel_sro`: contains `HOTEL`, `SRO`, or `ROOMING HOUSE`
- `garden_complex`: contains `GARDEN COMPLEX`

## Join to the roll: method and confidence

Each of the 47,278 deduped HCR BBLs is looked up against `properties_v2.bbl` in `db/properties.db`
in three tiers, in order:

1. **`exact_bbl`** — direct BBL equality. **47,272 of 47,278 (99.99%)** matched this way.
2. **`address_assisted`** — no exact BBL match. First checks whether any `properties_v2` row on
   the *same borough+block* has a condominium building class (`building_class LIKE 'R%'`) — this
   is the **"condo billing-lot quirk"**: HCR's file can carry a building's pre-conversion base
   lot, while the FY2027 roll has since split that block into individual condo unit lots (each
   with its own BBL, none of which equal the original base-lot BBL). If found, the HCR row is
   matched at `address_assisted` confidence and its residential-unit count for aggregation
   purposes is the **sum of residential units across every condo-unit lot on that block**. If no
   condo lots are found on the block, falls back to the single highest-residential-unit lot
   sharing the same borough+block (covers minor block re-numbering between the HCR file's
   vintage and the FY2027 roll).
3. **`unmatched`** — no match at either tier.

**Result on this ingest: 47,272 exact_bbl + 5 address_assisted + 1 unmatched = a 99.998% match
rate.** Of the 5 address_assisted matches, **all 5 fell into the condo billing-lot quirk
bucket** (`condo_quirk_bucket: 5` in `data/rent/rent_summary.json`) — i.e. every non-exact match
in this run was a base-lot-vs-condo-units situation, not a genuine address mismatch. The single
unmatched BBL is recorded with `join_confidence: "unmatched"` and excluded from all "confirmed"
aggregates (but retained in `hcr_buildings.json` for transparency).

`join_confidence` semantics: `exact_bbl` = safe to treat as a direct hit; `address_assisted` =
matched via block-level reasoning, treat borough/unit-count aggregates as approximate for that
row; `unmatched` = on the HCR list but not resolvable against this roll snapshot at all.

## The "likely structural candidate" layer — an ESTIMATE, not a registration

Computed live from `properties_v2`, independent of the HCR file:

```sql
year_built > 0 AND year_built < 1974
AND residential_units >= 6
AND tax_class LIKE '2%'                                   -- Class 2 (multifamily rental/coop/condo)
AND (building_class LIKE 'C%' OR building_class LIKE 'D%'  -- C = walk-up apt, D = elevator apt
     OR building_class LIKE 'S%')                          -- S = primarily-residential mixed-use
AND building_class NOT LIKE 'R%'                           -- excludes condo UNIT lots
```

This is the classic statutory profile for rent-stabilization eligibility under the NYC Rent
Stabilization Law (buildings with 6+ units built before 1/1/1974, outside the individually-sold
condo-unit-lot universe) — but it is **derived purely from DOF roll fields, matches nothing
against any registration filing, and is always labeled "estimate" everywhere it appears in the
UI** (metric cards, chart captions, status-definition card). It measured **52,970 lots /
1,695,278 estimated residential units** citywide on this roll snapshot.

Per-BBL candidate flags are **not** persisted in any public data file (`hcr_buildings.json`,
`rent_summary.json`) — only the aggregate counts are, per the product spec's privacy/accuracy
posture. The live `/rent-regulation/api/lookup` route does evaluate this SQL predicate
per-lookup (not stored), so a single-building lookup can still surface
`likely_structural_candidate` status for a building outside the HCR list.

## Overlap: candidate estimate vs. HCR-confirmed reality

| | Count |
|---|---|
| In both (candidate AND HCR-confirmed) | 36,990 |
| Candidate-only (structurally eligible, not on HCR list) | 15,980 |
| HCR-confirmed-only (not a structural candidate) | 10,288 |

Read this as: **~70% of structural candidates are in fact HCR-confirmed** (36,990 / 52,970), a
sanity-check that the heuristic is directionally sound — but ~30% are not, for legitimate
reasons (buildings that deregulated, buildings HCR's file is missing for administrative reasons,
or false positives in the age/size/class heuristic — e.g. a co-op that was never actually rent
stabilized). Symmetrically, 10,288 HCR-confirmed buildings fall outside the candidate profile
(younger buildings that qualified via 421-a/J-51, buildings under 6 units, etc.) — proof that the
"estimate" layer and the "confirmed" layer measure genuinely different things and neither should
be presented as a substitute for the other.

## Every caveat, in one place

- **Building-level, not unit-level.** HCR's list identifies buildings with ≥1 registered
  stabilized unit — never how many units, never which units. A listed building can mix
  stabilized, market-rate, rent-controlled, commercial, and owner-occupied units.
- **Rent-controlled ≠ rent-stabilized.** Two distinct legal regimes. This dataset and this page
  cover stabilization (the HCR building list) only; rent control is never modeled or implied.
- **No building is ever labeled "rent controlled/stabilized" for being old + multifamily alone.**
  That profile only ever surfaces as `likely_structural_candidate`, explicitly marked an
  estimate, both in the UI and in every data file.
- **"Not identified" ≠ "not stabilized."** A building absent from the current HCR file and the
  candidate profile is `not_identified` — administrative gaps, HCR file lag, and address-mismatch
  edge cases all produce false negatives. Absence of evidence is not evidence of absence.
- **No individual owner or tenant is ever named.** Owner rankings on this page use the site's
  existing entity-only `owner_groups` consolidation (`OWNER_CONSOLIDATION_METHODOLOGY.md`) —
  Individual and Unknown/Other owners are excluded from the top-owners table entirely, and no
  tenant-level information exists anywhere in this pipeline.
- **Address search on the lookup tool depends on DOF's own street-name spelling** (e.g. the roll
  spells "10th Avenue" as `10 AVENUE`, not `10TH AVE`), same as the rest of the site's address
  search (`/api/properties`) — a BBL search is always exact regardless of spelling.
- **Vintage mismatch.** The HCR file (2024 registrations) and the DOF roll (FY2027) are not the
  same point in time — a building can have changed status, been demolished, or been resubdivided
  between the two snapshots. `join_confidence` communicates match mechanism, not currency.

## Data files

- `data/rent/hcr_buildings_raw.json` — every one of the 50,879 raw parsed source rows, before
  BBL-level dedup. Includes `parse_note` on rows recovered via the wrapped-line fallback.
- `data/rent/hcr_buildings.json` — 47,278 rows, one per distinct BBL, with `status_codes[]`,
  the five boolean flags, `source_file`, `source_year`, and `join_confidence`.
- `data/rent/rent_summary.json` — every page-level aggregate: join stats, confirmed-building
  breakdowns (borough / value band / owner entity type / unit band / age band / property type /
  flag counts), the candidate-layer totals, the overlap stats, and the top-25 entity owner
  groups (by number of HCR-confirmed buildings, excluding the generic "Other Government Agency"
  catch-all bucket, which isn't one distinguishable owner).
- `db/properties.db` → `rent_stabilized` table — one row per matched HCR BBL (`bbl` primary key,
  `hcr_listed`, all five flags, `status_codes` as JSON text, `join_confidence`, `source_year`).
  Written in a single batched transaction at the end of `scripts/etl/08_ingest_hcr.ts`, with
  `busy_timeout = 30000` set before the transaction, to play safely alongside concurrent writers
  to the same SQLite file.

## Regenerating

```
node --import tsx scripts/etl/08_ingest_hcr.ts
```

Downloads the 5 PDFs to `HCR_SCRATCH_DIR` (defaults to a scratch path outside the repo; override
via env var) if not already cached there, re-extracts and re-parses from scratch, re-joins
against the current `db/properties.db`, and rewrites all three `data/rent/*.json` files plus the
`rent_stabilized` table. Idempotent.

## Future enrichments (schema reserved, not invented)

These are explicitly **not** implemented — no fields for them exist in the current data files,
and no placeholder/fake values were ever generated for them. Listed here so a future wave knows
where they'd plug in, and so nothing on this page is mistaken for already covering them:

- **HPD registrations/violations** — building-level code-enforcement context (would join on
  BBL, same as this pipeline).
- **DOB (Dept. of Buildings)** — permits, certificates of occupancy, complaint history.
- **ACRIS** — deed/mortgage records; would let this page show whether an HCR-confirmed building
  has recently sold or been refinanced (a common trigger for stabilization disputes).
- **RPIE** — DOF's income & expense filings; not public at the lot level, would need a different
  access path if ever pursued.
- **Mitchell-Lama** — a separate NYC/NYS regulated-affordability program, related to but
  distinct from rent stabilization; would need its own source file and its own status value
  (never conflated with `hcr_confirmed`).
- **NYCHA** — public housing is a separate regulatory regime entirely (not rent-stabilized in
  the HCR sense); NYCHA-owned buildings that happen to also appear on the HCR list are already
  captured today via the normal `owner_entity_type = 'Government'` path, but a dedicated "public
  housing" status/flag is not implemented.

## Suggested `/methodology` source-status table line

For the agent owning `/methodology`'s data-source status table, replace the existing "planned"
row for HCR data with:

> `HCR rent-regulation registration files` — **Available**. NYS HCR's 2024 building registration
> file (via NYC Rent Guidelines Board's official PDFs), joined to the roll by BBL at a 99.998%
> match rate (47,277 of 47,278 buildings). Building-level only — identifies buildings with ≥1
> registered stabilized unit, not unit counts. See `/rent-regulation` and
> `RENT_REGULATION_METHODOLOGY.md` for the full write-up.
