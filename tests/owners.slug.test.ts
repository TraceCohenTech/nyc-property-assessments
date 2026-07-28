import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { slugify } from "../lib/owners/slug";
import type { OwnersIndex } from "../lib/types";

const OWNERS_DIR = path.join(process.cwd(), "data", "owners");
const index: OwnersIndex = JSON.parse(readFileSync(path.join(OWNERS_DIR, "index.json"), "utf8"));

test("slugify is deterministic — same name always yields the same slug across calls", () => {
  const name = "1-10 Bush Terminal Owner, L.P.";
  const first = slugify(name);
  for (let i = 0; i < 5; i++) assert.equal(slugify(name), first);
});

test("slugify is URL-safe: lowercase, hyphen-delimited, no leading/trailing/double hyphens", () => {
  const samples = [
    "1-10 Bush Terminal Owner LP",
    "Con Edison of New York, Inc.",
    "NYC Dept. of Parks & Recreation",
    "  Leading/Trailing Spaces  ",
    "!!!Only Punctuation!!!",
    "Ünïcode Ñame",
  ];
  for (const s of samples) {
    const slug = slugify(s);
    assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `slug "${slug}" from "${s}" is not URL-safe`);
  }
});

test("slugify replaces '&' with 'and' rather than dropping it", () => {
  assert.equal(slugify("A & B Realty"), "a-and-b-realty");
});

test("slugify falls back to 'owner' for a name with no sluggable characters", () => {
  assert.equal(slugify("!!!"), "owner");
  assert.equal(slugify(""), "owner");
});

test("slugify caps length at 80 characters", () => {
  const longName = "A ".repeat(100) + "Realty LLC";
  const slug = slugify(longName);
  assert.ok(slug.length <= 80, `expected slug.length <= 80, got ${slug.length}`);
});

test("slugify collapses consecutive non-alphanumeric runs into a single hyphen", () => {
  assert.equal(slugify("A---B...C"), "a-b-c");
});

test("every published owner-profile filename is the slugify() of some real owner name (base or a numbered collision suffix)", () => {
  for (const row of index.owners) {
    const base = slugify(row.name);
    const isExactBase = row.slug === base;
    const isNumberedCollision = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d+$`).test(row.slug);
    assert.ok(
      isExactBase || isNumberedCollision,
      `owner "${row.name}" has slug "${row.slug}" which doesn't match slugify() output "${base}" (or a numbered variant)`
    );
  }
});

test("every index.json slug is URL-safe and has a matching data/owners/<slug>.json file on disk", () => {
  const filesOnDisk = new Set(readdirSync(OWNERS_DIR));
  for (const row of index.owners) {
    assert.match(row.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `index slug "${row.slug}" is not URL-safe`);
    assert.ok(filesOnDisk.has(`${row.slug}.json`), `missing data/owners/${row.slug}.json for "${row.name}"`);
  }
});

test("index.json slugs are unique (no silent collision overwrite)", () => {
  const slugs = index.owners.map((o) => o.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("alias-index.json values are all valid, existing slugs", () => {
  const aliasIndex: Record<string, string> = JSON.parse(readFileSync(path.join(OWNERS_DIR, "alias-index.json"), "utf8"));
  const validSlugs = new Set(index.owners.map((o) => o.slug));
  for (const [alias, slug] of Object.entries(aliasIndex)) {
    assert.ok(alias.length > 0);
    assert.ok(validSlugs.has(slug), `alias-index.json maps "${alias}" -> unknown slug "${slug}"`);
  }
});
