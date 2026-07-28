# Product Audit — NYC Property Assessment Explorer (Phase 1)

Audited 2026-07-28. Inspection only, no code changes. Live: https://nyc-property-assessments.vercel.app · Repo: TraceCohenTech/nyc-property-assessments.

## Correction to the initiating brief

The brief for this audit assumed a **1,647,962-row Neon table vs. a 1,167,962-row aggregate JSON**, and a `scripts/load-db.mjs` schema mismatch (missing `block`/`lot`/`taxable_value`). Neither is true as of this audit:

- Live Neon `properties` table: **`SELECT count(*)` = 1,167,962`**, verified via direct `pg` connection with `.env.local`'s `DATABASE_URL_UNPOOLED`.
- `data/aggregates.json` → `citywide.total_properties` = **1,167,962**, `meta.total_rows_processed` = **1,167,962**. Exact match.
- `information_schema.columns` for `properties` matches `scripts/load-db.mjs`'s `CREATE TABLE` exactly (`id, bbl, borough, owner, address, zip, bldg_class, tax_class, market_value, assessed_value, year_built, sqft, units`) — no `block`/`lot`/`taxable_value` columns exist on the live table.
- Production `/` and `/api/search` were curled directly and return numbers/rows consistent with the repo and DB (e.g. BBL `1008710031` returns the same owner/address/values in both the DB sample query and the live API).

**Conclusion: there is currently no row-count or schema discrepancy.** The 1.65M figure does not correspond to anything found in the live DB, the JSON, or the deployed site. Most likely explanation: a stale/intermediate state from earlier in the build (a partial or duplicate load that was later replaced by the current, correct 1.17M load) that no longer exists — `git log` shows only two commits (`Initial commit from Create Next App`, `Build NYC FY2027 property assessment dashboard`), and the current Neon table was created fresh by the `DROP TABLE IF EXISTS properties` at the top of `load-db.mjs`, so any earlier 1.65M-row load, if it ever existed, has been overwritten. **1,167,962 is the canonical, verified row count** — treat it as ground truth for the rebuild; do not "reconcile" it against 1.65M.

## What currently works

- **Static homepage** (`app/page.tsx`) is fully prerendered (`initialRevalidateSeconds: false` in `.next/prerender-manifest.json`) — fast, cacheable, `x-vercel-cache: HIT` confirmed on live curl.
- **Search API** (`app/api/search/route.ts`) is correctly `force-dynamic`, hits Neon live, and returns correct redacted results — verified live for both a BBL prefix query and a name query.
- **Owner privacy redaction** (`lib/ownerPrivacy.ts`) is applied both server-side (`displayOwner()` in the API route, so raw individual names never leave the server) and matches the same `isEntityOwner()` logic used to filter `top_owners` on the static homepage. Verified live: `q=EDWARD` (a common first name) returns 25 rows, every one `"owner":"Private Owner"`.
- BBL prefix search is fast: `EXPLAIN ANALYZE` shows an index scan on `idx_properties_bbl`, 0.15ms.
- Design tokens (`lib/colors.ts`) are pre-vetted for the "no purple/pink" and CVD-safe rules and used consistently across all 5 chart components in `components/charts/Charts.tsx`.
- Tailwind v4 is correctly wired (`@tailwindcss/postcss` + `@import "tailwindcss"` in `app/globals.css`, no `tailwind.config.*` file, which is correct/expected for v4 — earlier build issues mentioned in the brief are not present in this codebase).
- No SQLite references anywhere in the repo (`grep -rli sqlite` returns nothing) — the brief's caveat about possible stale SQLite mentions doesn't apply here.
- No campaign-finance/political cross-contamination: grepped `app/components/lib/data/scripts` for `campaign|contribution|donor|candidate|CFB|mayoral|election|PAC` — zero hits. `~/nyc-campaign-finance` is confirmed to be a genuinely separate project with its own donor/candidate/mayoral data files.

## What is technically fragile

1. **Free-text owner/address search is a full sequential scan with no supporting index**, despite `pg_trgm` being installed. `EXPLAIN ANALYZE` on `q=BROADWAY` (a common term): **Parallel Seq Scan, 611ms**, `Rows Removed by Filter: 386840` per worker. `load-db.mjs`'s own comment acknowledges this tradeoff ("Neon free tier is 512MB, GIN trigram indexes... would blow the budget") but 600ms+ per common-word query will not hold up under real traffic or a larger rebuild dataset.
2. **Data is duplicated in two places with no sync mechanism**: `data/aggregates.json` (build-time, bundled into the static homepage) and the live Neon `properties` table (queried only by `/api/search`). Nothing enforces they stay consistent; they happened to match today by luck of both being generated from the same load. Any future partial reload of one and not the other silently desyncs the headline stats from the live search results.
3. **3,791 duplicate BBL groups (8,017 rows)** exist in the live table — no unique constraint on `bbl`, no dedup step in `load-db.mjs`. A rebuild adding a property-detail page keyed by BBL will need to decide which duplicate row wins, or the detail page will silently be nondeterministic.
4. **`scripts/load-db.mjs` hardcodes an absolute path** to a source CSV inside the Claude scratchpad (`CSV_PATH = "/private/tmp/claude-501/.../property_search.csv"`) — that file is ephemeral/session-scoped and does not exist in the repo or in any durable location. The load script as committed **cannot be re-run** by a future engineer or CI process without first re-deriving that CSV from the raw DOF PROPMAST files. There is no ETL script in the repo for that step — it happened out-of-band during today's build session and isn't reproducible from what's checked in.
5. **No `UNIQUE` or `NOT NULL` constraints** beyond `id`/`bbl`/`borough` NOT NULL — `owner` (43 nulls), `address` (658 nulls) are nullable with no defaults, and the API/UI render `"—"` for these but a rebuild adding filters/sorts on owner or address needs to handle nulls explicitly.
6. **`.vercel/` is committed to the working tree but gitignored** (confirmed in `.gitignore`) — fine — but note `.env.local` is also correctly gitignored; a rebuild agent must re-pull env vars via `vercel env pull`, they are not in git history.
7. **DATABASE_URL is a pooled Neon connection** used directly in the Next.js API route (`neon(process.env.DATABASE_URL!)` — no fallback, no error message if unset beyond a runtime crash. `scripts/load-db.mjs` prefers `DATABASE_URL_UNPOOLED` for the bulk load (correct choice) but the app itself only ever reads `DATABASE_URL`.
8. **Single 60-char `VARCHAR` cap on `owner`** — real DOF owner strings (especially trust/estate language, e.g. row 1 in the sample: `"SAMUEL RUGGLES CONSERVANCY TRUST U/T/A D T 6-12-24"`, already 51 chars) are close to truncation risk; longer LLC/trust names will be silently cut off with no truncation indicator in the UI.
9. **`age_distribution` bucket ("Unknown" for missing year-built) and `year_built` SMALLINT** — `load-db.mjs` guards against out-of-range SMALLINT values (`yr > 0 && yr < 32767`) but does not sanity-check absurd-but-in-range values (e.g. `year_built: 1` would pass). Not observed in the sample but not actively prevented.
10. **No tests, no CI, no lint-on-commit** — `package.json` has a bare `lint` script but nothing wired to run it automatically; `eslint.config.mjs` is standard `eslint-config-next` defaults only.

## What is confusing in the UI

- The hero and footer both describe the dataset as "1.17M+ properties" / cite `meta.total_rows_processed`, which is accurate to the current data — but if a rebuild changes the canonical row count (e.g. by adding tax class 3/utility rows currently filtered out, condo sub-lots, etc.), every hardcoded "1.17M" and "1.6M+" string needs to be found and updated (see Hardcoded values below) — there's no single source of truth constant for "the current headline row count" that both the hero copy and the meta description in `app/layout.tsx` pull from.
- `app/layout.tsx`'s meta description says "1.17M+ NYC properties, $1.9T in total market value" as a hardcoded string — this is a static SEO description independent of `data/aggregates.json`, so it will silently drift from the real numbers on any future data refresh.
- Search section copy says "Search the full 1.6M+ row roll" (`app/page.tsx` line 353) — **this directly contradicts the verified 1,167,962-row reality and the "1.17M+" figure used everywhere else on the same page.** This is very likely the actual source of the "1.65M" figure referenced in the audit brief — a leftover/typo'd copy string, not an actual data discrepancy. This should be corrected to "1.17M+" for consistency in the very next pass.
- Zip table and owners table both start at a 25-row `limit` with a "show 25 more" button with no upper bound shown to the user (e.g. no "showing 25 of 191" until they've clicked through) until they reach the end.
- The four boroughs shown as bar/KPI cards are unlabeled as to sort order changing between the hero (sorted by `total_assessed_value`) and the "By borough" section table (sorted by `total_market_value`) — a user comparing the two will see different orderings for what looks like the same ranking.

## What should be removed

- Unused default Next.js starter assets in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) — grepped across `app/` and `components/`, none are referenced anywhere.
- The stray "1.6M+ row roll" copy in `app/page.tsx` (see above) — factually wrong, should be reconciled to 1.17M or to whatever the rebuild's new canonical count becomes.
- `AGENTS.md`'s boilerplate "This is NOT the Next.js you know" warning is a generic template note, not project-specific — harmless but noise for a new engineer skimming root docs.

## What should be preserved

- **`lib/ownerPrivacy.ts` in full**, including its word-boundary-token approach (avoiding false positives like "CO" matching inside "COLE") and its dual application point (API route + static homepage's `top_owners` filter). This is the single most legally/ethically load-bearing piece of logic in the app and any rebuild must keep individual owners redacted both in any new UI (e.g. a future property-detail page) and any new API endpoint.
- The static/dynamic split: bundling aggregate JSON into the static homepage (fast, cheap, cacheable) while routing only live lookups through the DB (`force-dynamic` search route) is the right architecture and should extend to new routes rather than making everything dynamic.
- `lib/colors.ts`'s pre-validated categorical palette and `CHART_TOOLTIP_STYLE`/`AXIS_TICK`/`GRID_STROKE` tokens — reuse these for any new charts rather than inventing new ad hoc colors.
- The BBL-prefix index strategy (`idx_properties_bbl`, verified fast) — extend this pattern (targeted btree indexes on exact lookup columns) rather than reaching for GIN/trigram indexes given the stated Neon free-tier size constraint.

## What should be redesigned

- **Search relevance/performance**: the ILIKE-seq-scan-plus-similarity-sort approach is the single biggest architectural risk for a "full public real-estate intelligence platform" — a rebuild adding more search surface (multi-field filters, autocomplete, map search) needs either a real full-text/trigram index (accepting the Neon storage cost, or upgrading tier) or a separate search service.
- **Data pipeline reproducibility**: `scripts/load-db.mjs` should not depend on a hand-built, ephemeral CSV at a scratchpad path. A rebuild needs a committed, re-runnable ETL from the raw DOF PROPMAST TC1/TC234 fixed-width files straight through to both the Neon load and the `data/aggregates.json` regeneration, so the two can never silently diverge again.
- **Hardcoded headline numbers**: `app/layout.tsx` metadata strings and any future marketing copy should derive from `data/aggregates.json` at build time (or a small generated constants file) rather than being typed by hand in JSX/metadata.
- Owner name storage: 60-char `VARCHAR` truncation should be reconsidered (either raised, or truncation flagged in the UI) before adding any feature (e.g. owner detail pages) that relies on exact/full owner strings.

## What should be added

- A canonical "as of" / "generated" timestamp and row-count constant, exposed once and consumed everywhere (hero, footer, meta description, search copy) so all headline numbers can never drift apart the way the "1.17M" vs "1.6M+" text already has.
- A `UNIQUE` constraint (or documented dedup pass) on `bbl` before any BBL-keyed detail page is built, given the 3,791 duplicate groups found live.
- Some minimal reproducible ETL script (checked into `scripts/`) that goes from the raw PROPMAST TC1/TC234 extracts to both `data/aggregates.json` and the Neon load in one pass, replacing the current one-off, non-reproducible `load-db.mjs` + scratchpad CSV.
- Basic route/API smoke tests or a CI check, given there are currently zero automated checks beyond `next build`'s own type-checking.
