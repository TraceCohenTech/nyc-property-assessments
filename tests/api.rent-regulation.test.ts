import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as lookupGET } from "../app/rent-regulation/api/lookup/route";

// Real BBLs pulled directly from db/properties.db + rent_stabilized for this integration suite.
const HCR_CONFIRMED_BBL = "1007220003"; // present in rent_stabilized, y421a=0/j51=0 -> hcr_confirmed
const STRUCTURAL_CANDIDATE_BBL = "3024310020"; // pre-1974, 6+ units, tax class 2, not in rent_stabilized

test("GET lookup?q=<missing> returns 400", async () => {
  const req = new NextRequest("http://localhost/api/lookup?q=");
  const res = await lookupGET(req);
  assert.equal(res.status, 400);
});

test("GET lookup?q=<BBL> for a bare BBL pads to 10 digits and resolves hcr_confirmed status", async () => {
  const req = new NextRequest(`http://localhost/api/lookup?q=${HCR_CONFIRMED_BBL}`);
  const res = await lookupGET(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.found, true);
  assert.equal(json.bbl, HCR_CONFIRMED_BBL);
  assert.equal(json.hcr_listed, true);
  assert.equal(json.status, "hcr_confirmed");
});

test("GET lookup?q=<address text> resolves the same building via FTS", async () => {
  const req = new NextRequest("http://localhost/api/lookup?q=246 10 AVENUE");
  const res = await lookupGET(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.found, true);
  assert.equal(json.bbl, HCR_CONFIRMED_BBL);
});

test("GET lookup?q=<structural candidate not in HCR list> resolves likely_structural_candidate", async () => {
  const req = new NextRequest(`http://localhost/api/lookup?q=${STRUCTURAL_CANDIDATE_BBL}`);
  const res = await lookupGET(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.found, true);
  assert.equal(json.hcr_listed, false);
  assert.equal(json.status, "likely_structural_candidate");
});

test("GET lookup?q=<nonexistent BBL> returns found=false, status=not_identified", async () => {
  const req = new NextRequest("http://localhost/api/lookup?q=9999999999");
  const res = await lookupGET(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.found, false);
  assert.equal(json.status, "not_identified");
  assert.equal(json.hcr_listed, false);
});

test("GET lookup response never includes an owner field (route doesn't select owner columns at all)", async () => {
  const req = new NextRequest(`http://localhost/api/lookup?q=${HCR_CONFIRMED_BBL}`);
  const res = await lookupGET(req);
  const json = await res.json();
  assert.ok(!("owner" in json));
  assert.ok(!("owner_raw" in json));
});
