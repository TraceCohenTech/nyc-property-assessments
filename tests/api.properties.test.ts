import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as listGET } from "../app/api/properties/route";
import { GET as detailGET } from "../app/api/properties/[bbl]/route";
import { getDb } from "../lib/db";

// Integration tests against the real route handlers + the real local db/properties.db.
// A known entity-owned BBL (a government-owned parcel) used across several assertions below.
const KNOWN_ENTITY_BBL = "4142600001"; // Port Authority NY & NJ, per lib/db.ts exploration

test("GET /api/properties returns 200 with the documented envelope shape", async () => {
  const req = new NextRequest("http://localhost/api/properties?page=1&page_size=5");
  const res = await listGET(req);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  const json = await res.json();
  assert.equal(typeof json.total, "number");
  assert.equal(json.page, 1);
  assert.equal(json.page_size, 5);
  assert.equal(typeof json.total_pages, "number");
  assert.ok(Array.isArray(json.results));
  assert.equal(json.results.length, 5);
  assert.ok(json.total > 1_000_000);
});

test("GET /api/properties applies filters and pagination consistently with total_pages math", async () => {
  const req = new NextRequest("http://localhost/api/properties?borough=Manhattan&page=2&page_size=10");
  const res = await listGET(req);
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.equal(json.results.length, 10);
  assert.equal(json.total_pages, Math.max(1, Math.ceil(json.total / 10)));
  for (const item of json.results) {
    assert.equal(item.borough, "Manhattan");
  }
});

test("GET /api/properties list items expose owner_is_entity + masked owner, never a raw individual field", async () => {
  const req = new NextRequest("http://localhost/api/properties?entity=llc&page_size=10");
  const res = await listGET(req);
  const json = await res.json();
  assert.equal(res.status, 200);
  for (const item of json.results) {
    assert.equal(typeof item.owner, "string");
    assert.equal(typeof item.owner_is_entity, "boolean");
    assert.ok(item.owner_is_entity, "entity=llc filter should only return entity-owned rows");
    assert.ok(!("owner_raw" in item), "owner_raw must never be exposed on the API shape");
    assert.ok(!("owner_normalized" in item), "owner_normalized must never be exposed on the API shape");
  }
});

test("GET /api/properties honors sort=year_asc (results are non-decreasing by year_built, nulls aside)", async () => {
  const req = new NextRequest("http://localhost/api/properties?sort=year_asc&year_built_min=1800&page_size=25");
  const res = await listGET(req);
  const json = await res.json();
  const years = json.results.map((r: { year_built: number | null }) => r.year_built).filter((y: number | null) => y !== null);
  for (let i = 1; i < years.length; i++) {
    assert.ok(years[i] >= years[i - 1], `expected non-decreasing years, got ${years[i - 1]} then ${years[i]}`);
  }
});

test("GET /api/properties q=<address text> returns full-text matches via the FTS index", async () => {
  const req = new NextRequest("http://localhost/api/properties?q=SNIFFEN+COURT&page_size=25");
  const res = await listGET(req);
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.ok(json.results.length > 0);
  for (const item of json.results) {
    assert.ok(item.full_address?.toUpperCase().includes("SNIFFEN"));
  }
});

test("GET /api/properties q=<BBL prefix> routes to the BBL-prefix branch, not FTS", async () => {
  const req = new NextRequest("http://localhost/api/properties?q=1008910052");
  const res = await listGET(req);
  const json = await res.json();
  assert.equal(res.status, 200);
  assert.ok(json.results.length >= 1);
  assert.ok(json.results.some((r: { bbl: string }) => r.bbl === "1008910052"));
});

test("GET /api/properties page_size is capped at MAX_PAGE_SIZE (100) even if a larger value is requested", async () => {
  const req = new NextRequest("http://localhost/api/properties?page_size=5000");
  const res = await listGET(req);
  const json = await res.json();
  assert.equal(json.page_size, 100);
  assert.equal(json.results.length, 100);
});

test("GET /api/properties/[bbl] returns the property + easements for a known BBL", async () => {
  const req = new NextRequest(`http://localhost/api/properties/${KNOWN_ENTITY_BBL}`);
  const res = await detailGET(req, { params: Promise.resolve({ bbl: KNOWN_ENTITY_BBL }) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.property.bbl, KNOWN_ENTITY_BBL);
  assert.ok(Array.isArray(json.easements));
});

test("GET /api/properties/[bbl] returns 404 for a well-formed but nonexistent BBL", async () => {
  const req = new NextRequest("http://localhost/api/properties/9999999999");
  const res = await detailGET(req, { params: Promise.resolve({ bbl: "9999999999" }) });
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.error, "Not found");
});

test("GET /api/properties/[bbl] returns 400 for a malformed BBL", async () => {
  const req = new NextRequest("http://localhost/api/properties/not-a-bbl");
  const res = await detailGET(req, { params: Promise.resolve({ bbl: "not-a-bbl" }) });
  assert.equal(res.status, 400);
});

test("GET /api/properties/[bbl] strips non-alphanumerics and accepts a bbl_full (bbl+ease code) form", async () => {
  const db = getDb();
  const easementRow = await db.execute(
    "SELECT bbl, bbl_full FROM properties_v2 WHERE ease_code IS NOT NULL LIMIT 1"
  );
  if (easementRow.rows.length === 0) return; // no easement rows in this dataset snapshot — skip gracefully
  const { bbl, bbl_full } = easementRow.rows[0] as unknown as { bbl: string; bbl_full: string };
  const req = new NextRequest(`http://localhost/api/properties/${bbl_full}`);
  const res = await detailGET(req, { params: Promise.resolve({ bbl: bbl_full }) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.property.bbl, bbl);
});
