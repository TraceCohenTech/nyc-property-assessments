# NYC Property Assessment Explorer

A public, searchable explorer over New York City's FY2027 Department of Finance (DOF) property
assessment roll — **1,167,962 tax lots**, **$1.91T** in total market value, across all five
boroughs and Tax Classes 1–4. Search by address, owner, or BBL; filter by borough, tax class,
property type, entity type, and value; drill into owner "entity" profiles (LLCs, corporations,
government agencies, nonprofits); and cross-reference against NYS HCR's rent-stabilization
building registry.

Live: **https://nyc-property-assessments.vercel.app**

## What this is

- **/** — editorial homepage with citywide headline stats and key findings.
- **/explorer** — full filter/search UI over every tax lot (borough, tax class, property type,
  entity type, value range, unit count, year built; sortable, paginated, CSV export).
- **/properties/[bbl]** — a detail page per tax lot (assessed values, building characteristics,
  easements, "other properties by this owner" for entity owners only, nearby comparables).
- **/owners** and **/owners/[slug]** — 500 consolidated owner-entity profiles (LLCs, corporate
  landlords, government agencies, institutions) with portfolio rollups. **Individual owners
  never get a public profile** — see Privacy below.
- **/boroughs** and **/boroughs/[borough]** — per-borough profiles (entity mix, ZIP breakdown,
  top owners/properties) plus a borough comparison tool.
- **/housing** — citywide housing stock composition, unit bands, value-per-unit analysis.
- **/value-concentration** — where market value concentrates (top owners, top ZIPs, entity type
  share of total value).
- **/tax-classes** — a plain-English guide to NYC's four property tax classes.
- **/rent-regulation** — cross-references the assessment roll against NYS HCR's 2024
  rent-stabilized building registration file (see `RENT_REGULATION_METHODOLOGY.md`).
- **/methodology** — full data-sources, computation, and confidence-level documentation.
- **/map** — a "coming soon" shell. Full lot-level geocoding/mapping is planned but not shipped
  (see Known Limitations).

## Privacy rule (hard constraint)

**Individual owners' names never render publicly or leave the server in any API response.**
Only entity owners (LLC, Corporation, Partnership, Trust/Estate, Government,
Nonprofit/Institution, Cooperative corporation, Housing company) are ever displayed by name —
individuals always render as a generic label (e.g. "Private Owner"). This is enforced in
`lib/ownerPrivacy.ts` + `lib/owners/classify.ts` + `components/*/OwnerBadge`, and is covered by
automated tests (`tests/`) that assert no individual owner name appears in `/api/properties`,
`/api/properties/[bbl]`, or `/api/export` output, and that no `data/owners/*.json` profile exists
for an Individual-classified owner.

## Tech stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- Tailwind CSS v4
- Recharts 3 for charts
- SQLite (via `better-sqlite3` for ETL, `@libsql/client` at runtime) — **Turso** in production,
  a local file DB in dev
- Data layer: `properties_v2` / `owner_groups` / `owner_aliases` tables + FTS5 full-text search,
  plus precomputed static JSON aggregates (`data/*.json`) for pages that don't need live queries

## Local setup

```bash
npm install
npm run dev        # http://localhost:3000
```

By default (no `TURSO_DATABASE_URL` set), the app reads `db/properties.db` — a local SQLite file
built by the ETL pipeline (see below). This file is gitignored (841MB+) and must be built
locally or downloaded before `npm run dev` will serve real data; without it, API routes that
depend on `lib/db.ts` will fail to open a database.

### Env vars

| Var | Required | Purpose |
|---|---|---|
| `TURSO_DATABASE_URL` | Production | libSQL/Turso database URL (`libsql://...`). Falls back to local file DB when unset. |
| `TURSO_AUTH_TOKEN` | Production | Turso auth token for the database above. |

Legacy Neon/Postgres env vars (`DATABASE_URL`, `PGHOST`, etc., in `.env.local`) are Vercel-managed
infra left in place from the app's original Neon-backed `/api/search` implementation. They are
**no longer read by any code path** — the app is fully cut over to the SQLite/Turso data layer —
but the Vercel project env vars themselves have not been deleted (infra cleanup, not a code
concern).

## Rebuilding the database (ETL pipeline, run in order)

Source data: NYC DOF's FY2027 PROPMAST files (`PROPMAST_TC1_2027_FIN.txt` for Tax Class 1,
`PROPMAST_TC234_T2027_FIN.TXT` for Tax Classes 2–4) — raw fixed-width property records, not
included in this repo (large, DOF-published; see Source Attribution).

```bash
# 1. Parse raw fixed-width DOF files into a clean CSV
npx tsx scripts/etl/01_parse_raw_to_csv.ts

# 2. HISTORICAL / OPTIONAL — scripts/etl/02_load_properties_v2.ts loaded the same CSV into the
#    original Neon Postgres backend used during early development. Production has since cut
#    over fully to SQLite/Turso; step 6 below builds properties_v2 directly into SQLite from
#    the CSV and does not depend on this step at all. Kept for provenance only — requires
#    `npm install pg` (removed from dependencies in the Turso cutover) to run again.

# 3. (see scripts/etl/governmentGroups.ts) — curated government/agency owner-consolidation list,
#    used inline by steps 2 and 6, not run standalone

# 4. Compute citywide/borough/ZIP/tax-class/building-class aggregates -> data/aggregates.json,
#    data/insights.json, data/borough/*.json
npx tsx scripts/etl/04_build_aggregates.ts

# 5. Build the 500 consolidated owner-entity profiles -> data/owners/*.json (+ index + alias-index)
npx tsx scripts/etl/05_build_owner_profiles.ts

# 6. Build the production SQLite file (better-sqlite3) from the clean CSV — this is what
#    lib/db.ts reads locally and what gets uploaded to Turso
npx tsx scripts/etl/06_build_sqlite.ts
# -> produces db/properties.db (1,167,962 rows, FTS5 search index, all Explorer filter indexes)

# 8. Join NYS HCR's rent-stabilization building registry (2024) onto the roll by BBL
npx tsx scripts/etl/08_ingest_hcr.ts
# -> adds the rent_stabilized table to db/properties.db (47,277 of 47,278 buildings matched,
#    99.998%) and data/rent/*.json
```

There is no committed step "07" — that slot was reserved for lot-level geocoding
(MapPLUTO-centroid join) for the deferred `/map` feature; a future wave can add it back once the
map is prioritized. See `ARCHITECTURE.md` for the deferred map plan.

## Data refresh process (for a future fiscal-year roll)

1. Obtain the new year's PROPMAST files from NYC DOF (Tax Class 1 file + Tax Class 2-4 file).
2. Re-run steps 1→6 above against the new source files. `source_year` / `source_dataset` columns
   on every row track provenance, so old and new rolls are distinguishable if you ever need to
   diff them.
3. Re-run step 8 if a newer HCR rent-stabilization registration file has been published (check
   `rentguidelinesboard.cityofnewyork.us/resources/rent-stabilized-building-lists`).
4. Verify row counts, spot-check a few known BBLs, and diff `data/aggregates.json`'s
   `citywide` totals against the prior year for sanity (a >~5-10% total-market-value swing
   year-over-year is unusual and worth double-checking before shipping).
5. Upload the new `db/properties.db` to a **new** Turso database (`turso db create <name>
   --from-file db/properties.db`) rather than overwriting the live one in place, verify row
   counts with `turso db shell <name> "SELECT COUNT(*) FROM properties_v2;"`, then repoint
   `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` in Vercel and redeploy. Keep the old database around
   until the new one is verified live.

## Deployment

Vercel, project already linked (`.vercel/project.json`). Standard flow:

```bash
git push                 # GitHub
vercel --prod             # Vercel production deploy
```

`db/properties.db` is gitignored — it is **not** deployed as a file; production reads it from
Turso via `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` set in the Vercel project's environment
variables. `data/*.json` static aggregates **are** committed and bundled at build time.

## Known limitations

- **No lot-level map.** `/map` is a "coming soon" shell. Geocoding (MapPLUTO centroid join) and
  the interactive map UI are deferred — see `ARCHITECTURE.md`.
- **Rent regulation is building-level, not unit-level.** The HCR join identifies buildings with
  ≥1 registered stabilized unit; it does not report how many units in a building are stabilized,
  and status can change year to year (registrations lapse, buildings deregulate). See
  `RENT_REGULATION_METHODOLOGY.md` for the full caveat list.
- **Assessment roll only — no sales, permits, violations, or ownership-history data.** ACRIS deed
  history, HPD violations, DOB permits, and RPIE income filings are not included (see Future Data
  Sources below).
- **Owner consolidation is name-matching, not a legal-entity graph.** Two LLCs with unrelated
  ownership but similar names could theoretically be merged by the alias logic; conversely, the
  same beneficial owner operating under many differently-named LLCs will show as many separate
  entities unless a curated alias exists. See `OWNER_CONSOLIDATION_METHODOLOGY.md`.
- **Static owner/borough JSON and the live DB can drift** if one is rebuilt without the other —
  both are generated from the same ETL run, but there's no automated consistency check between
  them yet.

## Source attribution

- **NYC Department of Finance** — FY2027 Property Assessment Roll (PROPMAST files, Tax Classes
  1–4). [nyc.gov/dof](https://www.nyc.gov/site/finance/property/property-assessments.page)
- **NYS Homes & Community Renewal (HCR)**, via the **NYC Rent Guidelines Board**'s published
  building-registration PDFs — 2024 rent-stabilized building list.
  [rentguidelinesboard.cityofnewyork.us](https://rentguidelinesboard.cityofnewyork.us/resources/rent-stabilized-building-lists/)

Full methodology: [`DATA_DICTIONARY.md`](./DATA_DICTIONARY.md),
[`DATA_QUALITY_REPORT.md`](./DATA_QUALITY_REPORT.md),
[`OWNER_CONSOLIDATION_METHODOLOGY.md`](./OWNER_CONSOLIDATION_METHODOLOGY.md),
[`RENT_REGULATION_METHODOLOGY.md`](./RENT_REGULATION_METHODOLOGY.md), and the in-app
[`/methodology`](https://nyc-property-assessments.vercel.app/methodology) page.

See also [`ARCHITECTURE.md`](./ARCHITECTURE.md) (routes, data flow, why Turso, the deferred map
plan) and [`ANALYTICS_DEFINITIONS.md`](./ANALYTICS_DEFINITIONS.md) (every metric's formula and
exclusions).

## Testing

```bash
npx tsc --noEmit    # typecheck
npm run lint        # ESLint
npm test            # node --test suite: owner classification, formatting, query builder,
                     # API integration, privacy assertions
npm run build       # full Next.js production build (518 pages)
```

## Political content

This repository contains **no political or campaign-finance features** — it is a real-estate /
property-assessment product only. A separate campaign-finance application exists as an
independent project and is not part of this repo.
