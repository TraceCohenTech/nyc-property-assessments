# Owner Consolidation Methodology

Two layers, computed in-memory during `scripts/etl/02_load_properties_v2.ts` (loaded inline into
the INSERT — see "Why inline, not a follow-up UPDATE" below) and persisted to `owner_groups` +
`owner_aliases`:

1. **Normalization** (`lib/owners/normalize.ts`) — collapses formatting-only spelling variants
   to one canonical string.
2. **Classification** (`lib/owners/classify.ts`) — labels each owner with an entity type.
3. **Consolidation** (`scripts/etl/governmentGroups.ts` + the grouping logic in
   `02_load_properties_v2.ts`) — decides which distinct raw owner strings should be treated as
   "the same owner" for aggregation purposes.

## 1. Normalization rules

`normalizeOwnerName(raw)`:
1. Uppercase.
2. `&` → `AND`.
3. Strip punctuation noise (periods, commas, apostrophes, quotes, semicolons, colons,
   parens, `#`) — keep letters/digits/spaces/hyphens.
4. Collapse whitespace runs to a single space, trim.
5. Canonicalize suffix spelling variants so they normalize identically regardless of
   punctuation/spacing: `L L C` / `L.L.C.` / `LLC` → `LLC`; `L P` / `L.P.` → `LP`; `LLP` variants →
   `LLP`; `LLLP` variants → `LLLP`; `INCORPORATED` → `INC`; `CORPORATION` → `CORP`; `COMPANY` →
   `CO`; `ASSOCIATES` → `ASSOC`; `ASSOCIATION` → `ASSN`.

This is a **formatting normalization only** — it does not decide entity type. Classification
(`classifyOwnerEntityType`) runs its LLC/Partnership/Trust/Cooperative regex checks against this
normalized string specifically so a punctuated suffix (`"44 WEST 11TH STREET, L.L.C."`) still
matches `\bLLC\b` — but its Government/Housing-company/Corporation/Nonprofit checks run against
the original uppercased-but-unnormalized string, since those rely on exact phrase substrings
(e.g. `"DEPARTMENT OF"`) that shouldn't have their formatting altered.

## 2. Entity-type classification (`lib/owners/classify.ts`)

Categories: `Individual`, `LLC`, `Corporation`, `Partnership`, `Trust/Estate`, `Government`,
`Nonprofit/Institution`, `Cooperative corporation`, `Housing company`, `Unknown/Other`.

Rule order (first match wins), and why:

1. **Government** — checked first and most aggressively, per product requirement. Matches a
   curated phrase list (`GOVERNMENT_PHRASES` — `"DEPARTMENT OF"`, `"CITY OF NEW YORK"`, `"NYCHA"`,
   `"MTA"`, agency abbreviations, etc.), a bare `NYC `/`NYC` prefix/suffix catch, and a foreign
   diplomatic-mission pattern (`"PERMANENT MISSION"`, `"CONSULATE"`, `"EMBASSY"`, `"REPUBLIC OF"`,
   `"KINGDOM OF"` — sovereign-government-owned property).
2. **Housing company** — curated list of known Mitchell-Lama / limited-equity corporations
   (Riverbay, Parkchester, Starrett City, Rochdale Village, ...) plus an `HDFC` /
   `"HOUSING DEVELOPMENT FUND"` pattern. Checked before generic Corporation because these are
   themselves usually `"... CORPORATION"` strings.
3. **Cooperative corporation** — the `"... OWNERS INC/CORP"` naming pattern, the standard NYC
   convention for a residential co-op's title-holding corporation (e.g. `"GLEN OAKS VILLAGE
   OWNERS INC"`). Checked on the normalized string so `"OWNERS, INC."` still matches.
4. **Trust/Estate** — `TRUST`, `TRUSTEE`, `"ESTATE OF"`, `"LIVING TRUST"`, `REVOCABLE`.
5. **Corporation** (private utility carve-out) — `CON EDISON`, `NATIONAL GRID`, `VERIZON`,
   `AMAZON.COM` are large private corporate landowners, not government, despite the old
   `ownerPrivacy.ts` heuristic bucketing them with government phrases for privacy purposes.
6. **Nonprofit/Institution** — `UNIVERSITY`, `COLLEGE`, `SCHOOL`, `CHURCH`/`TEMPLE`/`SYNAGOGUE`/
   `MOSQUE`/`PARISH`/`CONGREGATION`, `HOSPITAL`, `FOUNDATION`, `MUSEUM`, `LIBRARY`, `SOCIETY`,
   `YMCA`/`YWCA`, `ASSN`/`ASSOCIATION` (as a whole word), `DIOCESE`, `CHARITABLE`, etc.
7. **LLC** — `\bLLC\b` on the normalized string.
8. **Partnership** — `\bLLP\b`, `\bLLLP\b`, `\bLP\b`, `PARTNERS`, `PARTNERSHIP` on the normalized
   string.
9. **Corporation** — a broad word-token set (`CORP`, `INC`, `CO`, `REALTY`, `HOLDINGS`, `GROUP`,
   `MANAGEMENT`, `PROPERTIES`, `INVESTMENTS`, `DEVELOPMENT`, `CONDOMINIUM`, `CONDO`, `COOP`,
   `APARTMENTS`, `REIT`, `FUND`, `TOWERS`, `PLAZA`, `BANK`, ...).
10. **Individual** — last-resort heuristic, NEVER a keyword match: 2–5 space-separated word
    tokens, no digits. Deliberately conservative — if it doesn't look like a plausible personal
    name, it falls to `Unknown/Other` instead, never `Individual`.
11. **Unknown/Other** — everything else (blank, `"UNAVAILABLE OWNER"`, address-as-owner data
    artifacts, garbage tokens, single ambiguous words with a digit, etc.).

### Privacy semantics vs. classification semantics

`lib/owners/classify.ts::isEntityOwner()` (used by `lib/ownerPrivacy.ts`, unchanged public API)
is intentionally **stricter** than the classification label above in one direction: it also
carries forward the *original* pre-refactor `ownerPrivacy.ts` heuristic word/phrase list as a
safety net, OR'd with the new classifier. This guarantees the refactor can only ever **extend**
privacy protection, never weaken it — a string the old heuristic protected as an entity (even one
`classifyOwnerEntityType` would now more narrowly bucket as `Unknown/Other`, like a bare
`"...FUND"` or `"...COOP"` mention) is still treated as a safe-to-display entity. Blank / empty
owner strings are always treated as safe to display (no personal data to protect).

## 3. Consolidation (owner_groups / owner_aliases)

### Government — aggressive, curated

`scripts/etl/governmentGroups.ts` defines ~18 curated canonical agencies (NYC Parks, HPD, DCAS,
DOT, DOE/School Construction Authority, NYCHA, Port Authority, MTA, DEP, DSNY, NYPD, FDNY, HHC,
DASNY, US Government, State of NY, City of NY general), each with a list of substring/regex
matches against the uppercased raw name. Any `Government`-classified owner that doesn't hit one
of these specific agencies still gets grouped into a generic **"Other NYC / NY / US Government
Agency"** bucket (confidence `Medium`) rather than left ungrouped — government ownership analysis
should never fragment by spelling.

Confidence: `Confirmed` for a curated-agency match, `Medium` for the generic fallback bucket.

### Private entities (LLC, Corporation, Partnership, Trust/Estate, Nonprofit/Institution,
Cooperative corporation, Housing company) — conservative, exact-match only

Per product rule: **never merge on shared address, shared managing agent, or partial name
overlap.** The only consolidation signal used is an **exact `owner_normalized` string match** —
i.e., two raw owner strings are merged into one group only if they differ purely by
punctuation/spacing/suffix-spelling (`"123 MAIN ST LLC"` vs `"123 Main St. L.L.C."` vs `"123  MAIN
ST  L L C"` all normalize identically). A "group" only exists if **2 or more distinct raw
spellings** collapse to the same normalized string — a normalized name with only one raw spelling
behind it is a singleton, not a group (`owner_group_id` stays null; nothing was actually
consolidated).

Confidence: `High` for every private group created this way (the match is exact and mechanical,
not fuzzy). Evidence type: `exact-normalized-match`.

### Individual / Unknown/Other — never grouped

Per privacy policy, individual owners are never linked into an `owner_group` (there is no
legitimate product need to consolidate people's identities across parcels, and doing so would
compound privacy exposure). `Unknown/Other` owners are likewise left ungrouped since there's no
reliable signal to consolidate on.

### Why grouping happens inline during the INSERT, not as a follow-up UPDATE

The straightforward implementation — bulk `INSERT` into `properties_v2` first, then run a
separate pass to compute `owner_groups`/`owner_aliases` and `UPDATE properties_v2 SET
owner_group_id = ...` — was tried first and failed under this Neon project's storage cap: even a
metadata-only backfill `UPDATE` touching every row needs temporary headroom for Postgres MVCC to
write new row versions, and the project was already near its cap. The final pipeline instead does
a first CSV pass (owner classification + consolidation, entirely in memory, zero DB writes),
inserts `owner_groups` first, then does a second CSV pass that INSERTs `properties_v2` rows with
`owner_group_id` already resolved from an in-memory map — no UPDATE ever touches `properties_v2`.
This also made `owner_aliases` far smaller: an earlier version stored an alias row for **every**
distinct owner including ungrouped singletons (203,187 rows for the SI+Bronx subset alone, mostly
individuals with `owner_group_id = null`), which by itself blew the storage budget. The current
pipeline only stores `owner_aliases` rows for owners that are actually part of a group (1,656 rows
for the loaded subset) — a singleton's `owner_raw`/`owner_normalized` already live directly on its
`properties_v2` row, so a redundant no-op alias row adds no analytical value.

## Citywide owner statistics (computed from the full 1,167,962-row canonical dataset)

935,559 distinct raw owner strings citywide. Entity-type distribution (distinct owners, not
property count):

| Entity type | Distinct owners |
|---|---|
| Individual | 674,396 |
| LLC | 134,368 |
| Trust/Estate | 65,449 |
| Corporation | 40,628 |
| Unknown/Other | 9,711 |
| Nonprofit/Institution | 4,931 |
| Government | 844 |
| Housing company | 1,668 |
| Cooperative corporation | 1,727 |
| Partnership | 1,837 |

Government: all 844 distinct government-classified owner strings collapse into the 18 curated
agency buckets (+ the generic fallback bucket) — full agency-level consolidation citywide.

Private-entity consolidation citywide: 3,264 groups formed from 2+ distinct raw spellings,
covering 6,856 raw owner strings (243,752 private-entity owners are singletons — a single known
spelling, correctly left ungrouped).

**Note:** `owner_groups`/`owner_aliases` are currently persisted in Neon only for the partial DB
load (Staten Island + Bronx, 246,465 properties) — see "Storage constraint" in
`DATA_QUALITY_REPORT.md`. The citywide statistics above were computed by running the same
classification/normalization/consolidation logic against the full CSV outside the DB, to report
accurate full-dataset figures regardless of what currently fits in Postgres. Re-running
`scripts/etl/02_load_properties_v2.ts` against the full CSV once storage increases will persist
the full citywide `owner_groups`/`owner_aliases` tables with no code changes needed.
