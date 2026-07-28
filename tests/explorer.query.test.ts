import { test } from "node:test";
import assert from "node:assert/strict";
import { getDb } from "../lib/db";
import { parseFilters, ftsQuery, isBblLike, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../lib/explorer/query";

// These tests run the real query builder (lib/explorer/query.ts) against the real local
// db/properties.db (1.17M rows) — no mocking. For each filter case we independently compute
// the "ground truth" count with a hand-written SQL query and assert the builder's WHERE/params
// produce the identical count, so we're verifying the builder's SQL semantics, not a fixture.

function sp(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params);
}

async function countWithBuilder(params: Record<string, string>, opts?: { pageSize?: number }) {
  const parsed = parseFilters(sp(params), opts);
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT count(*) as c FROM properties_v2 WHERE ${parsed.where}`,
    args: parsed.params,
  });
  return { parsed, total: Number((result.rows[0] as unknown as { c: number }).c) };
}

test("no filters -> WHERE 1=1, matches the full row count", async () => {
  const { parsed, total } = await countWithBuilder({});
  assert.equal(parsed.where, "1=1");
  assert.equal(parsed.params.length, 0);
  const db = getDb();
  const truth = await db.execute("SELECT count(*) as c FROM properties_v2");
  assert.equal(total, Number((truth.rows[0] as unknown as { c: number }).c));
  assert.ok(total > 1_000_000, "expected the full ~1.17M row dataset");
});

test("borough filter matches a hand-written borough_name = ? count", async () => {
  const { total } = await countWithBuilder({ borough: "Manhattan" });
  const db = getDb();
  const truth = await db.execute({ sql: "SELECT count(*) as c FROM properties_v2 WHERE borough_name = ?", args: ["Manhattan"] });
  assert.equal(total, Number((truth.rows[0] as unknown as { c: number }).c));
  assert.ok(total > 100_000);
});

test("tax_class filter is an exact match, not a prefix match (tax_class=2 excludes 2A/2B/2C)", async () => {
  const { total: exact2 } = await countWithBuilder({ tax_class: "2" });
  const db = getDb();
  const truth = await db.execute({ sql: "SELECT count(*) as c FROM properties_v2 WHERE tax_class = '2'", args: [] });
  assert.equal(exact2, Number((truth.rows[0] as unknown as { c: number }).c));

  const prefixed = await db.execute("SELECT count(*) as c FROM properties_v2 WHERE tax_class LIKE '2%'");
  assert.ok(
    Number((prefixed.rows[0] as unknown as { c: number }).c) > exact2,
    "tax_class LIKE '2%' should be a strict superset of exact tax_class='2'"
  );
});

test("bldg_class single-letter prefix vs full exact code", async () => {
  const { parsed: prefixParsed, total: prefixTotal } = await countWithBuilder({ bldg_class: "R" });
  assert.match(prefixParsed.where, /building_class LIKE \?/);
  const db = getDb();
  const truthPrefix = await db.execute("SELECT count(*) as c FROM properties_v2 WHERE building_class LIKE 'R%'");
  assert.equal(prefixTotal, Number((truthPrefix.rows[0] as unknown as { c: number }).c));

  const { parsed: exactParsed, total: exactTotal } = await countWithBuilder({ bldg_class: "R4" });
  assert.match(exactParsed.where, /building_class = \?/);
  const truthExact = await db.execute("SELECT count(*) as c FROM properties_v2 WHERE building_class = 'R4'");
  assert.equal(exactTotal, Number((truthExact.rows[0] as unknown as { c: number }).c));
  assert.ok(prefixTotal >= exactTotal);
});

test("bldg_class lowercase input is uppercased for exact-code matches", async () => {
  const { total } = await countWithBuilder({ bldg_class: "r4" });
  const db = getDb();
  const truth = await db.execute("SELECT count(*) as c FROM properties_v2 WHERE building_class = 'R4'");
  assert.equal(total, Number((truth.rows[0] as unknown as { c: number }).c));
});

test("entity filter maps UI keys (llc/corp/trust/government/nonprofit) to owner_entity_type IN (...)", async () => {
  const { total } = await countWithBuilder({ entity: "llc" });
  const db = getDb();
  const truth = await db.execute("SELECT count(*) as c FROM properties_v2 WHERE owner_entity_type = 'LLC'");
  assert.equal(total, Number((truth.rows[0] as unknown as { c: number }).c));
  assert.ok(total > 0);
});

test("entity=all is a no-op filter (identical to no entity param)", async () => {
  const { total: allTotal } = await countWithBuilder({ entity: "all" });
  const { total: noneTotal } = await countWithBuilder({});
  assert.equal(allTotal, noneTotal);
});

test("unknown entity value is silently ignored (no-op), not an error", async () => {
  const { total } = await countWithBuilder({ entity: "not-a-real-type" });
  const { total: noneTotal } = await countWithBuilder({});
  assert.equal(total, noneTotal);
});

test("value_min/value_max bbox-style range query matches a hand-written BETWEEN count", async () => {
  const { total } = await countWithBuilder({ value_min: "1000000", value_max: "5000000" });
  const db = getDb();
  const truth = await db.execute({
    sql: "SELECT count(*) as c FROM properties_v2 WHERE market_value >= ? AND market_value <= ?",
    args: [1_000_000, 5_000_000],
  });
  assert.equal(total, Number((truth.rows[0] as unknown as { c: number }).c));
  assert.ok(total > 0);
});

test("year_built range and units range compose together with AND semantics", async () => {
  const { parsed, total } = await countWithBuilder({
    year_built_min: "2000",
    year_built_max: "2020",
    units_min: "10",
  });
  assert.match(parsed.where, /year_built >= \?/);
  assert.match(parsed.where, /year_built <= \?/);
  assert.match(parsed.where, /total_units >= \?/);
  const db = getDb();
  const truth = await db.execute({
    sql: "SELECT count(*) as c FROM properties_v2 WHERE year_built >= ? AND year_built <= ? AND total_units >= ?",
    args: [2000, 2020, 10],
  });
  assert.equal(total, Number((truth.rows[0] as unknown as { c: number }).c));
});

test("sqft range, property_type, and value_band filters each match hand-written equivalents", async () => {
  const db = getDb();

  const { total: sqftTotal } = await countWithBuilder({ sqft_min: "1000", sqft_max: "10000" });
  const sqftTruth = await db.execute({
    sql: "SELECT count(*) as c FROM properties_v2 WHERE building_area >= ? AND building_area <= ?",
    args: [1000, 10000],
  });
  assert.equal(sqftTotal, Number((sqftTruth.rows[0] as unknown as { c: number }).c));

  const { total: ptTotal } = await countWithBuilder({ property_type: "condo" });
  const ptTruth = await db.execute({ sql: "SELECT count(*) as c FROM properties_v2 WHERE property_type = ?", args: ["condo"] });
  assert.equal(ptTotal, Number((ptTruth.rows[0] as unknown as { c: number }).c));
  assert.ok(ptTotal > 0);

  const { total: vbTotal } = await countWithBuilder({ value_band: "$50M+" });
  const vbTruth = await db.execute({ sql: "SELECT count(*) as c FROM properties_v2 WHERE value_band = ?", args: ["$50M+"] });
  assert.equal(vbTotal, Number((vbTruth.rows[0] as unknown as { c: number }).c));
  assert.ok(vbTotal > 0);
});

test("multiple filters combine with AND (borough + entity + tax_class narrows monotonically)", async () => {
  const { total: base } = await countWithBuilder({ borough: "Brooklyn" });
  const { total: narrower } = await countWithBuilder({ borough: "Brooklyn", entity: "llc" });
  const { total: narrowest } = await countWithBuilder({ borough: "Brooklyn", entity: "llc", tax_class: "2" });
  assert.ok(narrower <= base);
  assert.ok(narrowest <= narrower);
  assert.ok(narrowest > 0);
});

test("sort key maps to the documented column + direction, and an invalid sort falls back to value_desc", () => {
  const yearDesc = parseFilters(sp({ sort: "year_desc" }));
  assert.equal(yearDesc.orderBy, "year_built DESC");

  const unitsAsc = parseFilters(sp({ sort: "units_asc" }));
  assert.equal(unitsAsc.orderBy, "total_units ASC");

  const addressAsc = parseFilters(sp({ sort: "address_asc" }));
  assert.equal(addressAsc.orderBy, "full_address ASC");

  const bogus = parseFilters(sp({ sort: "not_a_real_sort" }));
  assert.equal(bogus.orderBy, "market_value DESC");

  const none = parseFilters(sp({}));
  assert.equal(none.orderBy, "market_value DESC");
});

test("pagination: page defaults to 1, floors fractional/invalid input, and never goes below 1", () => {
  assert.equal(parseFilters(sp({})).page, 1);
  assert.equal(parseFilters(sp({ page: "3" })).page, 3);
  assert.equal(parseFilters(sp({ page: "3.9" })).page, 3);
  assert.equal(parseFilters(sp({ page: "0" })).page, 1);
  assert.equal(parseFilters(sp({ page: "-5" })).page, 1);
  assert.equal(parseFilters(sp({ page: "not-a-number" })).page, 1);
});

test("pagination: page_size defaults, is floored, and is capped at MAX_PAGE_SIZE", () => {
  assert.equal(parseFilters(sp({})).pageSize, DEFAULT_PAGE_SIZE);
  assert.equal(parseFilters(sp({ page_size: "25" })).pageSize, 25);
  assert.equal(parseFilters(sp({ page_size: "25.7" })).pageSize, 25);
  assert.equal(parseFilters(sp({ page_size: "0" })).pageSize, DEFAULT_PAGE_SIZE);
  assert.equal(parseFilters(sp({ page_size: "99999" })).pageSize, MAX_PAGE_SIZE);
});

test("an explicit opts.pageSize overrides the page_size query param and is still capped", () => {
  assert.equal(parseFilters(sp({ page_size: "10" }), { pageSize: 5 }).pageSize, 5);
  assert.equal(parseFilters(sp({}), { pageSize: 10_000 }).pageSize, MAX_PAGE_SIZE);
});

test("q free-text param is trimmed and surfaced separately, not folded into `where`", () => {
  const withQ = parseFilters(sp({ q: "  123 main st  " }));
  assert.equal(withQ.q, "123 main st");
  assert.equal(withQ.where, "1=1");

  const blankQ = parseFilters(sp({ q: "   " }));
  assert.equal(blankQ.q, null);

  const noQ = parseFilters(sp({}));
  assert.equal(noQ.q, null);
});

test("isBblLike recognizes digit-only strings up to 10 chars, rejects text/addresses", () => {
  assert.equal(isBblLike("1008910052"), true);
  assert.equal(isBblLike("100891"), true);
  assert.equal(isBblLike("12345678901"), false); // 11 digits, too long
  assert.equal(isBblLike("10 SNIFFEN COURT"), false);
  assert.equal(isBblLike(""), false);
});

test("ftsQuery quotes the input as a phrase literal and escapes embedded double-quotes", () => {
  assert.equal(ftsQuery("123 main st"), '"123 main st"');
  assert.equal(ftsQuery('say "hi"'), '"say ""hi"""');
});

test("q-driven FTS search integrates end-to-end against the real properties_fts index", async () => {
  const parsed = parseFilters(sp({ q: "SNIFFEN COURT" }));
  assert.equal(parsed.q, "SNIFFEN COURT");
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT bbl, full_address FROM properties_v2 WHERE id IN (SELECT rowid FROM properties_fts WHERE properties_fts MATCH ?) AND ${parsed.where} LIMIT 10`,
    args: [ftsQuery(parsed.q as string), ...parsed.params],
  });
  assert.ok(result.rows.length > 0, "expected at least one match for 'SNIFFEN COURT'");
  for (const row of result.rows as unknown as { full_address: string | null }[]) {
    assert.ok(row.full_address?.toUpperCase().includes("SNIFFEN"));
  }
});
