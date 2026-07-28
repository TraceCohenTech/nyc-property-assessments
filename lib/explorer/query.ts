// Shared filter-parsing + SQL WHERE-builder for the Explorer's URL param convention.
// Used by /api/properties, /api/properties/[bbl] (related-properties queries), and
// /api/export so all three agree on exactly what a given filter set means.
//
// URL param convention (documented in app/explorer/page.tsx and the build brief):
//   value_min, value_max     — market value, whole dollars
//   borough                  — full borough name, e.g. "Manhattan"
//   entity                   — all|llc|corp|trust|government|nonprofit
//   tax_class                — "1" | "2" | "3" | "4" (or "1A" etc as DOF sub-classes appear)
//   bldg_class                — DOF building class code, e.g. "R4" (exact) or a single letter
//                               category prefix, e.g. "R" (all condo codes)
//   zip                       — 5-digit zip
//   year_built_min/_max       — construction year bounds
//   q                         — free text address/owner/BBL search
//   sort                      — value_desc|value_asc|count_desc|count_asc (+ extensions below)
//   page                      — 1-indexed results page
// Extensions (backward-compatible additions):
//   units_min/units_max       — total_units bounds
//   property_type             — exact match against the derived property_type rollup
//   value_band                — exact match against the precomputed value_band bucket
//   sqft_min/sqft_max         — building_area bounds

export type SortKey =
  | "value_desc"
  | "value_asc"
  | "count_desc"
  | "count_asc"
  | "year_desc"
  | "year_asc"
  | "units_desc"
  | "units_asc"
  | "address_asc";

const ENTITY_MAP: Record<string, string[]> = {
  llc: ["LLC"],
  corp: ["Corporation"],
  trust: ["Trust/Estate"],
  government: ["Government"],
  nonprofit: ["Nonprofit/Institution"],
};

const SORT_COLUMN: Record<SortKey, string> = {
  value_desc: "market_value",
  value_asc: "market_value",
  count_desc: "market_value", // no meaningful "count" on a per-row list; falls back to value
  count_asc: "market_value",
  year_desc: "year_built",
  year_asc: "year_built",
  units_desc: "total_units",
  units_asc: "total_units",
  address_asc: "full_address",
};

const SORT_DESC: Record<SortKey, boolean> = {
  value_desc: true,
  value_asc: false,
  count_desc: true,
  count_asc: false,
  year_desc: true,
  year_asc: false,
  units_desc: true,
  units_asc: false,
  address_asc: false,
};

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_EXPORT_ROWS = 50_000;

export type ParsedFilters = {
  where: string;
  params: (string | number)[];
  orderBy: string;
  page: number;
  pageSize: number;
  q: string | null;
};

function num(v: string | null): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseFilters(searchParams: URLSearchParams, opts?: { pageSize?: number }): ParsedFilters {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  const valueMin = num(searchParams.get("value_min"));
  const valueMax = num(searchParams.get("value_max"));
  if (valueMin !== null) {
    clauses.push("market_value >= ?");
    params.push(valueMin);
  }
  if (valueMax !== null) {
    clauses.push("market_value <= ?");
    params.push(valueMax);
  }

  const borough = searchParams.get("borough");
  if (borough) {
    clauses.push("borough_name = ?");
    params.push(borough);
  }

  const entity = searchParams.get("entity");
  if (entity && entity !== "all" && ENTITY_MAP[entity]) {
    const types = ENTITY_MAP[entity];
    clauses.push(`owner_entity_type IN (${types.map(() => "?").join(",")})`);
    params.push(...types);
  }

  const taxClass = searchParams.get("tax_class");
  if (taxClass) {
    clauses.push("tax_class = ?");
    params.push(taxClass);
  }

  const bldgClass = searchParams.get("bldg_class");
  if (bldgClass) {
    if (bldgClass.length === 1) {
      clauses.push("building_class LIKE ?");
      params.push(`${bldgClass}%`);
    } else {
      clauses.push("building_class = ?");
      params.push(bldgClass.toUpperCase());
    }
  }

  const zip = searchParams.get("zip");
  if (zip) {
    clauses.push("zip = ?");
    params.push(zip);
  }

  const yearMin = num(searchParams.get("year_built_min"));
  const yearMax = num(searchParams.get("year_built_max"));
  if (yearMin !== null) {
    clauses.push("year_built >= ?");
    params.push(yearMin);
  }
  if (yearMax !== null) {
    clauses.push("year_built <= ?");
    params.push(yearMax);
  }

  const unitsMin = num(searchParams.get("units_min"));
  const unitsMax = num(searchParams.get("units_max"));
  if (unitsMin !== null) {
    clauses.push("total_units >= ?");
    params.push(unitsMin);
  }
  if (unitsMax !== null) {
    clauses.push("total_units <= ?");
    params.push(unitsMax);
  }

  const propertyType = searchParams.get("property_type");
  if (propertyType) {
    clauses.push("property_type = ?");
    params.push(propertyType);
  }

  const valueBand = searchParams.get("value_band");
  if (valueBand) {
    clauses.push("value_band = ?");
    params.push(valueBand);
  }

  const sqftMin = num(searchParams.get("sqft_min"));
  const sqftMax = num(searchParams.get("sqft_max"));
  if (sqftMin !== null) {
    clauses.push("building_area >= ?");
    params.push(sqftMin);
  }
  if (sqftMax !== null) {
    clauses.push("building_area <= ?");
    params.push(sqftMax);
  }

  const q = (searchParams.get("q") || "").trim() || null;
  // q is handled separately (FTS join) by the caller — not folded into `where` here because
  // it needs a different query shape (JOIN properties_fts ... WHERE properties_fts MATCH ?).

  const sortParam = (searchParams.get("sort") as SortKey) || "value_desc";
  const sortKey: SortKey = SORT_COLUMN[sortParam] ? sortParam : "value_desc";
  const orderBy = `${SORT_COLUMN[sortKey]} ${SORT_DESC[sortKey] ? "DESC" : "ASC"}`;

  const page = Math.max(1, Math.floor(num(searchParams.get("page")) ?? 1));
  const requestedSize = num(searchParams.get("page_size"));
  const pageSize = Math.min(
    opts?.pageSize ?? (requestedSize ? Math.max(1, Math.floor(requestedSize)) : DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  return {
    where: clauses.length ? clauses.join(" AND ") : "1=1",
    params,
    orderBy,
    page,
    pageSize,
    q,
  };
}

/** Escapes a user query for the FTS5 trigram MATCH operator (quotes it as a phrase literal). */
export function ftsQuery(q: string): string {
  const cleaned = q.replace(/"/g, '""');
  return `"${cleaned}"`;
}

/** True if q looks like a BBL or BBL prefix (digits only, up to 10 chars). */
export function isBblLike(q: string): boolean {
  return /^\d{1,10}$/.test(q);
}
