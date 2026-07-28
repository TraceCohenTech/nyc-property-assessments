# Architecture

## Routes

| Route | Type | Data source |
|---|---|---|
| `/` | Static | `data/aggregates.json`, `data/insights.json` (build-time bundle) |
| `/explorer` | Static shell + client fetch | `ExplorerClient` fetches `/api/properties` (debounced, URL-synced filters) |
| `/properties/[bbl]` | Dynamic (SSR) | `lib/explorer/getProperty.ts` → `lib/db.ts` (Turso/SQLite) |
| `/owners` | Static | `data/owners/index.json` |
| `/owners/[slug]` | SSG, 500 generated paths | `data/owners/<slug>.json` (one file per consolidated owner entity) |
| `/boroughs` | Static | `data/aggregates.json` |
| `/boroughs/[borough]` | SSG, 5 generated paths | `data/borough/<borough>.json` |
| `/housing` | Static | `data/aggregates.json`, `data/insights.json` |
| `/value-concentration` | Static | `data/aggregates.json`, `data/owners/index.json` |
| `/tax-classes` | Static | Editorial content, no DB dependency |
| `/methodology` | Static | Editorial content, documents every source/confidence level |
| `/rent-regulation` | Static shell + client fetch | `LookupTool` fetches `/rent-regulation/api/lookup` → `lib/db.ts` `rent_stabilized` table |
| `/map` | Static "coming soon" shell | `data/aggregates.json` (top-ZIP cards only) — no live map, see Deferred map plan below |
| `/api/properties` | Dynamic route handler | `lib/db.ts` `properties_v2` (filters/sort/pagination) |
| `/api/properties/[bbl]` | Dynamic route handler | `lib/db.ts` `properties_v2` + `owner_groups` |
| `/api/export` | Dynamic route handler | `lib/db.ts` `properties_v2`, streamed CSV, 50K row cap |
| `/api/search` | Dynamic route handler | `lib/db.ts` `properties_v2` + `properties_fts` — legacy homepage quick-search, now on the same backend as everything else (see history below) |
| `/rent-regulation/api/lookup` | Dynamic route handler | `lib/db.ts` `rent_stabilized` + `properties_v2` |
| `/sitemap.xml` | Generated (`app/sitemap.ts`) | Static routes + borough slugs + owner slugs; excludes `/properties/[bbl]` (1.17M dynamic pages) and `/api/*` |
| `/opengraph-image` | Generated (`app/opengraph-image.tsx`, `next/og`) | Static branded card, real stats from `data/aggregates.json` baked in at build time |

## Data flow: raw files → ETL → SQLite/Turso + static JSON → pages/APIs

```
NYC DOF FY2027 PROPMAST files (fixed-width, 2 files: TC1, TC2-4)
        │
        ▼  scripts/etl/01_parse_raw_to_csv.ts
   clean CSV (1,167,962 rows, one row per BBL+ease_code)
        │
        ├──▶ scripts/etl/06_build_sqlite.ts ──▶ db/properties.db (SQLite)
        │       - properties_v2 (main table)                │
        │       - owner_groups / owner_aliases               │  turso db create
        │         (entity classification + consolidation,    │  --from-file
        │          lib/owners/classify.ts + normalize.ts)     ▼
        │       - properties_fts (FTS5 trigram search index) Turso (libSQL, production)
        │
        ├──▶ scripts/etl/08_ingest_hcr.ts ──▶ rent_stabilized table
        │       (NYS HCR 2024 building registration PDFs → parsed → BBL-joined)
        │       also writes data/rent/*.json
        │
        ├──▶ scripts/etl/04_build_aggregates.ts ──▶ data/aggregates.json, data/insights.json,
        │       (citywide + per-borough + per-ZIP + per-tax-class rollups)  data/borough/*.json
        │
        └──▶ scripts/etl/05_build_owner_profiles.ts ──▶ data/owners/*.json
                (500 consolidated owner-entity profiles, index.json, alias-index.json)

Runtime:
  lib/db.ts → @libsql/client → TURSO_DATABASE_URL (prod) or file:db/properties.db (dev fallback)
  Static JSON in data/ is imported directly at build time by pages that don't need live queries
  (home, boroughs, housing, value-concentration, tax-classes) — no DB round-trip for those pages.
  Pages that need live filtering/search/pagination (explorer, property detail, owner search,
  rent-regulation lookup) go through the API routes, which hit lib/db.ts directly.
```

`scripts/etl/02_load_properties_v2.ts` and `scripts/load-db.mjs` are **historical** — they
loaded the same clean CSV into the original Neon Postgres backend used during early development.
Production has fully cut over to SQLite/Turso; those two scripts are kept only for provenance and
are excluded from the TypeScript build (`tsconfig.json`) since the `pg` package was removed from
`package.json` dependencies in the Turso cutover.

## Why Turso

The original build used Neon Postgres for the live `/api/search` route (see git history / the
"HISTORICAL" notes in `app/api/search/route.ts`'s prior version). Neon's free-tier storage cap
(~512MB) blocked loading the full 1.17M-row citywide dataset — see `DATA_QUALITY_REPORT.md`'s
"Storage constraint" section — and its address/owner text search had no supporting trigram index
under that cap, resulting in **611ms Parallel Seq Scans** on common search terms (`EXPLAIN
ANALYZE`, `q=BROADWAY`, `PRODUCT_AUDIT.md`).

Turso (managed libSQL/SQLite) was chosen for the full rebuild because:
1. **No practical storage ceiling** for a ~1GB SQLite file at Turso's pricing — the entire
   citywide dataset loads in one shot, no partial-load workaround needed.
2. **SQLite FTS5** gives a real trigram-equivalent full-text index over address + owner without
   a separate search service. Local warm-cache benchmarks against `db/properties.db` (identical
   schema to the Turso copy): BBL prefix lookup ~0.04ms, borough+tax-class filter ~34ms, FTS5
   address search ~1.2ms, market-value range scan ~0.06ms — all one to two orders of magnitude
   faster than the old 611ms Neon seq scan, and Turso's edge replication keeps read latency low
   from Vercel's serverless functions.
3. **`@libsql/client` speaks the same wire protocol locally and remotely** — `lib/db.ts` uses one
   client interface for both the local file DB (dev) and the hosted Turso DB (prod), so there's
   no separate local-vs-prod query dialect to maintain.
4. **`better-sqlite3`** (synchronous, in-process) is used only in the ETL scripts for fast bulk
   writes when building `db/properties.db` — it's a devDependency-shaped tool, not part of the
   request-serving runtime.

## Deferred map plan

`/map` currently renders a static "coming soon" shell (top-5-ZIP cards from `data/aggregates.json`,
an honest "planned" label, a link to `/methodology`). A prior work-in-progress attempt at a full
MapLibre GL lot-level map (geocoding via MapPLUTO centroids, `components/map/MapExplorer.tsx`,
`app/api/map/`, `scripts/etl/07_geocode.ts` / `07b_build_map_geojson.ts`) was left mid-build with
a broken TypeScript build (a MapLibre typing error) and was removed as out of scope for this wave
per product direction — map is deliberately deferred, not shipped in a half-working state.

To resume it in a future wave:
1. Re-add a `07_geocode.ts` step: join `properties_v2` to NYC Dept of City Planning's **MapPLUTO**
   shapefile/CSV by BBL, writing `latitude`/`longitude` onto `properties_v2` (columns already
   exist in the schema, currently `NULL` for all rows — see `db/schema.sql`'s `geocoding_status`
   column, default `'pending'`).
2. Precompute borough- and ZIP-level choropleth GeoJSON (`data/map/*.geojson`) at build time —
   don't serve per-request geometry for 1.17M points.
3. Add a bbox-gated `/api/map/properties` route for the point layer at high zoom (never return
   more than a few thousand points per request).
4. Rebuild `components/map/MapExplorer.tsx` against the current MapLibre GL types (the prior
   attempt's break was a typing mismatch, not an architectural problem) and re-add `maplibre-gl`
   to `package.json`.
5. Wire `/map`'s metadata and copy back to "live" once the above is verified working end-to-end,
   including a privacy check — individual-owner points must not expose the raw owner name via
   map tooltips/popups any more than the list/detail APIs do.

## Privacy architecture

`lib/owners/classify.ts` is the single source of truth for entity-type classification (used by
both the ETL, at write time, to set `owner_entity_type` / build `owner_groups`, and by
`lib/ownerPrivacy.ts` at read time as a defense-in-depth second check). `displayOwner()` /
`isEntityOwner()` gate every place an owner name reaches a response: `/api/properties`,
`/api/properties/[bbl]`, `/api/export`, `/api/search`, and the owner-profile ETL (`05_build_
owner_profiles.ts` never writes a profile file for an `Individual`-classified owner in the first
place — profiles aren't filtered at read time, they never exist on disk for individuals). Related-
property lookups (`lib/explorer/getProperty.ts`'s "other properties by this owner") are skipped
entirely — not just filtered — for individual owners, since even property addresses alone can be
a doxxing vector once tied to a person's name. Covered by `tests/privacy.test.ts`.
