import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyOwnerEntityType, isEntityOwner } from "../lib/owners/classify";
import { normalizeOwnerName } from "../lib/owners/normalize";
import { isEntityOwner as legacyIsEntityOwner, displayOwner, PRIVATE_OWNER_LABEL } from "../lib/ownerPrivacy";

test("spec examples — entity type classification", () => {
  assert.equal(classifyOwnerEntityType("DEPARTMENT OF EDUCATION"), "Government");
  assert.equal(classifyOwnerEntityType("NYC PARKS"), "Government");
  assert.equal(classifyOwnerEntityType("NEW YORK UNIVERSITY"), "Nonprofit/Institution");
  assert.equal(classifyOwnerEntityType("XYZ OWNER LLC"), "LLC");
  assert.equal(classifyOwnerEntityType("JOHN SMITH"), "Individual");
  assert.equal(classifyOwnerEntityType("JOHN SMITH REVOCABLE TRUST"), "Trust/Estate");
  assert.equal(classifyOwnerEntityType("RIVERBAY CORPORATION"), "Housing company");
  assert.equal(classifyOwnerEntityType("GLEN OAKS VILLAGE OWNERS INC"), "Cooperative corporation");
});

test("additional government agencies", () => {
  assert.equal(classifyOwnerEntityType("NYS DOT"), "Government");
  assert.equal(classifyOwnerEntityType("NYC DEPT OF ENVIR PROT"), "Government");
  assert.equal(classifyOwnerEntityType("METRO NORTH"), "Government");
  assert.equal(classifyOwnerEntityType("CITY OF NEW YORK"), "Government");
  assert.equal(classifyOwnerEntityType("NYCHA"), "Government");
});

test("private corporation vs government utility distinction", () => {
  assert.equal(classifyOwnerEntityType("CON EDISON"), "Corporation");
  assert.equal(classifyOwnerEntityType("VERIZON NEW YORK INC"), "Corporation");
});

test("housing company vs cooperative corporation vs generic corp", () => {
  assert.equal(classifyOwnerEntityType("PARKCHESTER PRESERVATION"), "Housing company");
  assert.equal(classifyOwnerEntityType("123 MAIN STREET OWNERS CORP"), "Cooperative corporation");
  assert.equal(classifyOwnerEntityType("ACME REALTY CORP"), "Corporation");
});

test("HDFC classified as housing company", () => {
  assert.equal(classifyOwnerEntityType("123 WEST 145 STREET HDFC"), "Housing company");
});

test("partnership and LLC distinction", () => {
  assert.equal(classifyOwnerEntityType("MAIN STREET PARTNERS LP"), "Partnership");
  assert.equal(classifyOwnerEntityType("123 REALTY LLC"), "LLC");
});

test("blank / unavailable owner treated as Unknown/Other but privacy-safe", () => {
  assert.equal(classifyOwnerEntityType(""), "Unknown/Other");
  assert.equal(classifyOwnerEntityType("UNAVAILABLE OWNER"), "Unknown/Other");
  assert.equal(isEntityOwner(""), true);
  assert.equal(isEntityOwner("UNAVAILABLE OWNER"), true);
});

test("isEntityOwner masks individuals, shows entities", () => {
  assert.equal(isEntityOwner("JANE DOE"), false);
  assert.equal(isEntityOwner("JANE DOE REVOCABLE TRUST"), true);
  assert.equal(isEntityOwner("123 MAIN ST LLC"), true);
});

test("ownerPrivacy.ts public API unchanged and delegates correctly", () => {
  assert.equal(PRIVATE_OWNER_LABEL, "Private Owner");
  assert.equal(legacyIsEntityOwner("JOHN SMITH"), false);
  assert.equal(legacyIsEntityOwner("XYZ OWNER LLC"), true);
  assert.equal(displayOwner("JOHN SMITH"), "Private Owner");
  assert.equal(displayOwner("XYZ OWNER LLC"), "XYZ OWNER LLC");
  assert.equal(displayOwner(null), "Private Owner");
});

test("normalizeOwnerName collapses formatting variants to the same key", () => {
  const a = normalizeOwnerName("123 Main St. L.L.C.");
  const b = normalizeOwnerName("123  MAIN   ST   L L C");
  const c = normalizeOwnerName("123 MAIN ST LLC");
  assert.equal(a, b);
  assert.equal(b, c);
});

test("normalizeOwnerName standardizes INC/INCORPORATED and CORP/CORPORATION", () => {
  assert.equal(normalizeOwnerName("ACME INCORPORATED"), normalizeOwnerName("ACME INC"));
  assert.equal(normalizeOwnerName("ACME CORPORATION"), normalizeOwnerName("ACME CORP"));
});
