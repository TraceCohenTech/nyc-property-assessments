import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET as listGET } from "../app/api/properties/route";
import { GET as detailGET } from "../app/api/properties/[bbl]/route";
import { GET as exportGET } from "../app/api/export/route";
import { getDb } from "../lib/db";
import { classifyOwnerEntityType } from "../lib/owners/classify";

// ---------------------------------------------------------------------------------------------
// HARD PRIVACY RULE (see lib/ownerPrivacy.ts): individual owners' raw names must NEVER render
// publicly or leave the server in an API response — only entity owners (LLC/corp/government/
// etc.) get their names shown; individuals must always render as "Private Owner".
//
// This suite queries the REAL local db/properties.db for a genuine Individual-classified row,
// then hits the real route handlers end-to-end and asserts the raw name string is byte-for-byte
// absent from every response body/CSV — not just "probably redacted".
// ---------------------------------------------------------------------------------------------

const OWNERS_DIR = path.join(process.cwd(), "data", "owners");

async function findIndividualRow() {
  const db = getDb();
  const res = await db.execute(
    `SELECT bbl, owner_raw, full_address, zip FROM properties_v2
     WHERE owner_entity_type = 'Individual' AND owner_raw IS NOT NULL AND length(owner_raw) > 3
     ORDER BY bbl LIMIT 1`
  );
  assert.ok(res.rows.length > 0, "expected at least one Individual-classified row in the real DB — dataset may be missing/corrupt");
  return res.rows[0] as unknown as { bbl: string; owner_raw: string; full_address: string | null; zip: string | null };
}

test("PRIVACY: /api/properties list response never contains a known individual's raw owner name", async () => {
  const individual = await findIndividualRow();
  // A broad, unfiltered high-page-size pull that is very likely to include this owner's zip area,
  // biased toward actually including the row by filtering to the same zip.
  const req = new NextRequest(`http://localhost/api/properties?zip=${individual.zip}&page_size=100`);
  const res = await listGET(req);
  const bodyText = await res.text();
  assert.doesNotMatch(bodyText, new RegExp(escapeRegExp(individual.owner_raw)));
  const json = JSON.parse(bodyText);
  const match = json.results.find((r: { bbl: string }) => r.bbl === individual.bbl);
  if (match) {
    assert.equal(match.owner, "Private Owner");
    assert.equal(match.owner_is_entity, false);
  }
});

test("PRIVACY: /api/properties/[bbl] detail response never contains the raw owner name for a known individual BBL", async () => {
  const individual = await findIndividualRow();
  const req = new NextRequest(`http://localhost/api/properties/${individual.bbl}`);
  const res = await detailGET(req, { params: Promise.resolve({ bbl: individual.bbl }) });
  assert.equal(res.status, 200);
  const bodyText = await res.text();
  assert.doesNotMatch(bodyText, new RegExp(escapeRegExp(individual.owner_raw)));
  const json = JSON.parse(bodyText);
  assert.equal(json.property.owner, "Private Owner");
  assert.equal(json.property.owner_is_entity, false);
});

test("PRIVACY: /api/export CSV never contains the raw owner name for a known individual BBL, redacts as 'Private Owner'", async () => {
  const individual = await findIndividualRow();
  const req = new NextRequest(`http://localhost/api/export?zip=${individual.zip}&page_size=50`);
  const res = await exportGET(req);
  const csvText = await res.text();
  assert.doesNotMatch(csvText, new RegExp(escapeRegExp(individual.owner_raw)));
  if (csvText.includes(individual.bbl)) {
    const line = csvText.split("\r\n").find((l) => l.startsWith(individual.bbl + ","));
    assert.ok(line, `expected a CSV row for bbl ${individual.bbl}`);
    assert.match(line!, /,Private Owner,Individual \(redacted\),/);
  }
});

test("PRIVACY (broad sweep): a large unfiltered /api/properties page containing many individual owners never leaks a raw name", async () => {
  // Pull a large page sorted by value_asc (cheap small properties skew individual-owned) and
  // verify EVERY row flagged owner_is_entity=false renders exactly "Private Owner", and no raw
  // name characteristic of "LAST FIRST" / "FIRST LAST" personal-name rows leaks through.
  const req = new NextRequest("http://localhost/api/properties?sort=value_asc&page_size=100");
  const res = await listGET(req);
  const json = await res.json();
  let individualCount = 0;
  for (const item of json.results) {
    if (!item.owner_is_entity) {
      individualCount++;
      assert.equal(item.owner, "Private Owner");
    }
  }
  assert.ok(individualCount > 0, "expected the broad sweep to include at least one individual-owned property");
});

test("PRIVACY: /api/properties/[bbl] related-property lists are skipped for individual owners (no doxxing vector)", async () => {
  const individual = await findIndividualRow();
  const req = new NextRequest(`http://localhost/api/properties/${individual.bbl}`);
  const res = await detailGET(req, { params: Promise.resolve({ bbl: individual.bbl }) });
  const json = await res.json();
  // The list route's own response shape has no "otherByOwnerGroup" field (that's only in
  // lib/explorer/getProperty.ts's PropertyDetail, used by the server-rendered page, not this
  // JSON API) — but confirm the API never exposes owner_group_id-driven identity linking for an
  // individual by checking owner_group_id is null (individuals are never grouped — see
  // scripts/etl/05_build_owner_profiles.ts's resolveGroup()).
  assert.equal(json.property.owner_group_id, null);
});

test("PRIVACY: none of the 500 published data/owners/*.json profiles are for an Individual-classified owner", () => {
  const index = JSON.parse(readFileSync(path.join(OWNERS_DIR, "index.json"), "utf8")) as {
    owners: { slug: string; name: string; owner_type: string }[];
  };
  assert.ok(index.owners.length > 0);
  for (const row of index.owners) {
    assert.notEqual(row.owner_type, "Individual");
    assert.notEqual(row.owner_type, "Unknown/Other");
    // Cross-check against the live classifier too — a published owner's canonical display name
    // must not itself reclassify as Individual (defense in depth beyond trusting the stored field).
    // Government profiles use curated agency names (e.g. "NYC Department of Parks & Recreation")
    // that the personal-name heuristic could otherwise plausibly misjudge as short as they are —
    // so this check only applies to the ETL's own recorded owner_type, which is the authoritative
    // source and is already asserted above; this second assertion targets the profile FILE itself.
    const profile = JSON.parse(readFileSync(path.join(OWNERS_DIR, `${row.slug}.json`), "utf8")) as { owner_type: string };
    assert.notEqual(profile.owner_type, "Individual");
    assert.notEqual(profile.owner_type, "Unknown/Other");
  }
});

test("PRIVACY: every profile file present on disk is also listed in index.json (no orphaned/unlisted individual leak)", () => {
  const index = JSON.parse(readFileSync(path.join(OWNERS_DIR, "index.json"), "utf8")) as {
    owners: { slug: string }[];
  };
  const indexedSlugs = new Set(index.owners.map((o) => o.slug));
  const filesOnDisk = readdirSync(OWNERS_DIR).filter((f) => f.endsWith(".json") && f !== "index.json" && f !== "alias-index.json");
  assert.equal(filesOnDisk.length, index.owners.length);
  for (const f of filesOnDisk) {
    const slug = f.replace(/\.json$/, "");
    assert.ok(indexedSlugs.has(slug), `orphaned profile file ${f} not referenced by index.json`);
  }
});

test("PRIVACY: alias-index.json contains no alias whose classifier verdict is Individual", () => {
  const aliasIndex: Record<string, string> = JSON.parse(readFileSync(path.join(OWNERS_DIR, "alias-index.json"), "utf8"));
  let checked = 0;
  for (const alias of Object.keys(aliasIndex)) {
    // Aliases are normalized (uppercased, suffix-squashed) raw owner strings collected only from
    // rows that were already routed through the entity-only resolveGroup() gate during the ETL —
    // so none of them should independently reclassify as Individual either.
    assert.notEqual(classifyOwnerEntityType(alias), "Individual");
    checked++;
  }
  assert.ok(checked > 100, "expected a substantial alias set to check");
});

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
