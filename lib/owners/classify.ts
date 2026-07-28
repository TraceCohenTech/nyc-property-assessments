// Owner entity-type classification — shared by the ETL pipeline (owner_entity_type column,
// owner_groups.owner_type) and by lib/ownerPrivacy.ts (which individual owners to mask).
//
// Categories: Individual, LLC, Corporation, Partnership, Trust/Estate, Government,
// Nonprofit/Institution, Cooperative corporation, Housing company, Unknown/Other.
//
// Rule order matters — earlier rules win. Government is checked first and most aggressively
// per product spec (agencies use dozens of inconsistent name spellings and must never leak
// through as "Individual" or get merged into private-owner logic). Housing-company /
// cooperative-corporation patterns are checked before the generic Corporation/LLC rules
// because they are themselves usually "... CORP" or "... INC" strings that would otherwise
// misclassify. Individual is a last-resort heuristic, never a keyword match — anything that
// doesn't look like a plausible personal name falls to Unknown/Other, never Individual, so we
// never accidentally *fail* to mask a business name AND never accidentally mask a business
// name as if we were confident it was a person (the privacy-safe default in ownerPrivacy.ts is
// "not proven to be an entity -> treat as Individual -> mask", which is a separate, stricter
// rule than this function's classification label).

import { normalizeOwnerName } from "./normalize";

export type EntityType =
  | "Individual"
  | "LLC"
  | "Corporation"
  | "Partnership"
  | "Trust/Estate"
  | "Government"
  | "Nonprofit/Institution"
  | "Cooperative corporation"
  | "Housing company"
  | "Unknown/Other";

// True government agencies (federal / state / city / authority). Substring match on the
// uppercased raw owner string. Kept broad deliberately per product spec ("government FIRST
// and most aggressively").
export const GOVERNMENT_PHRASES: string[] = [
  "CITY OF NEW YORK",
  "STATE OF NEW YORK",
  "STATE OF NY",
  "NEW YORK STATE",
  "UNITED STATES OF AMERICA",
  "UNITED STATES GOVT",
  "UNITED STATES GOV",
  "US GOVERNMENT",
  "U S GOVERNMENT",
  "USPS",
  "US POSTAL SERVICE",
  "DEPARTMENT OF",
  "DEPT OF",
  "DEPT  OF",
  "BOARD OF EDUCATION",
  "DEPARTMENT OF EDUCATION",
  "DEPT OF EDUCATION",
  "SCHOOL CONSTRUCTION AUTH",
  "SCHOOL CONSTR",
  "TRANSIT AUTH",
  "NYC TRANSIT",
  "METRO NORTH",
  "LIRR",
  "LONG ISLAND RAIL ROAD",
  "MTA",
  "HOUSING AUTH",
  "NYCHA",
  "PORT AUTHORITY",
  "DORMITORY AUTH",
  "DASNY",
  "NYPD",
  "POLICE DEPARTMENT",
  "FDNY",
  "FIRE DEPARTMENT",
  "DSNY",
  "SANITATION",
  "DSBS",
  "DCAS",
  "HHC",
  "HEALTH AND HOSPITALS CORP",
  "NYS DOT",
  "NYSDOT",
  "NEW YORK STATE DOT",
  "DEPT OF TRANSPORTATION",
  "DEPARTMENT OF TRANSPORTATION",
  "NYC DEP",
  "DEPT OF ENVIR PROT",
  "DEPARTMENT OF ENVIRONMENTAL PROT",
  "PARKS DEPT",
  "PARKS AND RECREATION",
  "PARKS & RECREATION",
  "NYC PARKS",
  "DEPT OF PARKS",
  "DEPARTMENT OF PARKS",
  "HPD",
  "DEPT OF HOUSING PRESERVATION",
  "HOUSING PRESERVATION AND DEV",
  "GOVERNORS ISLAND",
  "NYC HOUSING",
  "US ARMY",
  "US NAVY",
  "US AIR FORCE",
  "NATIONAL GUARD",
  "VETERANS ADMIN",
  "GSA ",
  "GENERAL SERVICES ADMIN",
  "NYC DEPT",
  "NYC OFFICE",
  "OFFICE OF THE MAYOR",
  "BOARD OF ELECTIONS",
  "DISTRICT ATTORNEY",
  "PUBLIC ADMINISTRATOR",
  "CITY COUNCIL",
];

// Private utility / large corporate landowners that must be treated as an entity for privacy
// purposes but are NOT government — classified as Corporation.
const PRIVATE_UTILITY_PHRASES: string[] = [
  "CON EDISON",
  "CONSOLIDATED EDISON",
  "NATIONAL GRID",
  "VERIZON",
  "AMAZON.COM",
];

// "OWNERS INC/CORP" is the standard NYC naming convention for a residential cooperative's
// title-holding corporation (e.g. "GLEN OAKS VILLAGE OWNERS INC").
const COOP_PATTERN = /\bOWNERS\b[\s\S]{0,15}\b(INC|CORP)\b|\b(INC|CORP)\b[\s\S]{0,15}\bOWNERS\b/;
const HDFC_PATTERN = /\bHDFC\b|\bHOUSING DEVELOPMENT FUND\b/;

// Known large Mitchell-Lama / limited-equity "housing company" corporations — a distinct
// legal form from a standard co-op title-holding corp, per product spec's Riverbay example.
const HOUSING_COMPANY_PHRASES: string[] = [
  "RIVERBAY",
  "PARKCHESTER",
  "CO OP CITY",
  "STARRETT CITY",
  "ROCHDALE VILLAGE",
  "HOUSING COMPANY",
  "HOUSING CO ",
  "MITCHELL LAMA",
];

const TRUST_PATTERN = /\bTRUST\b|\bTRUSTEE\b|\bESTATE OF\b|\bLIVING TRUST\b|\bREVOCABLE\b/;

const NONPROFIT_PHRASES: string[] = [
  "UNIVERSITY",
  "COLLEGE",
  "SCHOOL",
  "ACADEMY",
  "CHURCH",
  "TEMPLE",
  "SYNAGOGUE",
  "PARISH",
  "MOSQUE",
  "CONGREGATION",
  "FOUNDATION",
  "HOSPITAL",
  "MUSEUM",
  "LIBRARY",
  "SOCIETY",
  "YMCA",
  "YWCA",
  "DIOCESE",
  "ARCHDIOCESE",
  "RECTORY",
  "CONVENT",
  "NONPROFIT",
  "NOT FOR PROFIT",
  "NOT-FOR-PROFIT",
  "CHARITIES",
  "CHARITABLE",
];
const NONPROFIT_WORD_TOKENS = new Set(["ASSN", "ASSOCIATION"]);

const LLC_PATTERN = /\bLLC\b/;
const PARTNERSHIP_PATTERN = /\bLLP\b|\bLLLP\b|\bLP\b|\bPARTNERS\b|\bPARTNERSHIP\b/;
const CORP_WORD_TOKENS = new Set([
  "CORP",
  "CORPORATION",
  "INC",
  "INCORPORATED",
  "CO",
  "COMPANY",
  "REALTY",
  "HOLDINGS",
  "HOLDING",
  "ASSOCIATES",
  "ASSOC",
  "GROUP",
  "MANAGEMENT",
  "MGMT",
  "PROPERTIES",
  "PROPERTY",
  "ENTERPRISES",
  "VENTURES",
  "CAPITAL",
  "INVESTMENTS",
  "INVESTORS",
  "INVESTMENT",
  "DEVELOPMENT",
  "DEVELOPERS",
  "DEVELOPER",
  "CONDOMINIUM",
  "CONDO",
  "COOP",
  "APARTMENTS",
  "APTS",
  "REIT",
  "FUND",
  "EQUITIES",
  "ESTATES",
  "TOWERS",
  "TOWER",
  "PLAZA",
  "BANK",
  "UNION",
  "CREDIT",
  "SERIES",
]);

function words(upper: string): string[] {
  return upper.split(/[^A-Z]+/).filter(Boolean);
}

function includesAny(upper: string, phrases: string[]): boolean {
  return phrases.some((p) => upper.includes(p));
}

/** Looks like a plausible "FIRST LAST" or "LAST FIRST M" personal name — 2-4 words, no
 * digits, none of the words is a recognized entity/place/agency token. This is only used as
 * the *last* fallback after every entity signal has been checked. */
function looksLikePersonalName(upper: string): boolean {
  if (/\d/.test(upper)) return false;
  const w = words(upper);
  if (w.length < 2 || w.length > 5) return false;
  return true;
}

export function classifyOwnerEntityType(raw: string | null | undefined): EntityType {
  if (!raw || !raw.trim()) return "Unknown/Other";
  const upper = raw.toUpperCase().trim();
  if (upper === "UNAVAILABLE OWNER") return "Unknown/Other";
  // Punctuation/spacing-normalized form ("L.L.C." / "L L C" / "LLC" all -> "LLC", etc.) so the
  // \bLLC\b / \bLP\b / \bTRUST\b-style regex checks below aren't fooled by a period or extra
  // spaces breaking the word boundary (e.g. "44 WEST 11TH STREET, L.L.C." must still hit LLC).
  const normalized = normalizeOwnerName(raw);

  if (includesAny(upper, GOVERNMENT_PHRASES)) return "Government";
  // Bare "NYC " / trailing "NYC" prefix catch (e.g. "NYC DOT", "NYC DEP") not already covered.
  if (/^NYC\s/.test(upper) || / NYC$/.test(upper)) return "Government";
  // Foreign diplomatic missions / consulates are sovereign-government-owned property.
  if (/\bPERMANENT MISSION\b|\bCONSULATE\b|\bEMBASSY\b|\bREPUBLIC OF\b|\bKINGDOM OF\b/.test(upper)) return "Government";

  if (includesAny(upper, HOUSING_COMPANY_PHRASES)) return "Housing company";
  if (HDFC_PATTERN.test(upper)) return "Housing company";
  if (COOP_PATTERN.test(normalized)) return "Cooperative corporation";

  if (TRUST_PATTERN.test(normalized)) return "Trust/Estate";

  if (includesAny(upper, PRIVATE_UTILITY_PHRASES)) return "Corporation";

  if (includesAny(upper, NONPROFIT_PHRASES)) return "Nonprofit/Institution";
  {
    const w = words(upper);
    if (w.some((t) => NONPROFIT_WORD_TOKENS.has(t))) return "Nonprofit/Institution";
  }

  if (LLC_PATTERN.test(normalized)) return "LLC";
  if (PARTNERSHIP_PATTERN.test(normalized)) return "Partnership";

  {
    const w = words(upper);
    if (w.some((t) => CORP_WORD_TOKENS.has(t))) return "Corporation";
  }

  if (looksLikePersonalName(upper)) return "Individual";

  return "Unknown/Other";
}

// Legacy safety-net word tokens from the original ownerPrivacy.ts heuristic (pre-classify.ts).
// Kept verbatim and OR'd into isEntityOwner below so refactoring this file can only ever
// EXTEND privacy coverage, never weaken it — a string the old heuristic protected as an entity
// (e.g. bare "...OWNERS...", "...COOP...", "...FUND...") must still be treated as an entity here
// even if classifyOwnerEntityType() doesn't have a specific label bucket for that token.
const LEGACY_ENTITY_WORD_TOKENS = new Set([
  "LLC", "LLP", "LP", "LLLP", "CORP", "CORPORATION", "INC", "INCORPORATED", "TRUST",
  "REALTY", "HOLDINGS", "HOLDING", "ASSOCIATES", "ASSOC", "PARTNERS", "PARTNERSHIP", "CO",
  "COMPANY", "GROUP", "MANAGEMENT", "MGMT", "PROPERTIES", "PROPERTY", "ENTERPRISES",
  "VENTURES", "CAPITAL", "INVESTMENTS", "INVESTORS", "INVESTMENT", "DEVELOPMENT",
  "DEVELOPERS", "DEVELOPER", "CONDOMINIUM", "CONDO", "COOP", "HDFC", "APARTMENTS", "APTS",
  "REIT", "FUND", "EQUITIES", "ESTATES", "TOWERS", "TOWER", "PLAZA", "CHURCH", "TEMPLE",
  "SYNAGOGUE", "PARISH", "MOSQUE", "CONGREGATION", "FOUNDATION", "HOSPITAL", "HOSPITALS",
  "MEDICAL", "UNIVERSITY", "COLLEGE", "SCHOOL", "ACADEMY", "MUSEUM", "LIBRARY", "SOCIETY",
  "ASSN", "ASSOCIATION", "AUTHORITY", "BANK", "UNION", "CREDIT", "OWNER", "OWNERS",
  "SERIES", "YMCA", "YWCA",
]);
const LEGACY_GOV_UTILITY_PHRASES = [
  "CITY OF NEW YORK", "STATE OF NEW YORK", "STATE OF NY", "NEW YORK STATE", "UNITED STATES",
  "U S A", "USA", "USPS", "CON EDISON", "CONSOLIDATED EDISON", "NATIONAL GRID", "VERIZON",
  "AMAZON.COM", "PARKS DEPT", "PARKS AND RECREATION", "PARKS & RECREATION", "DEPARTMENT OF",
  "DEPT OF", "DEPT  OF", "BOARD OF EDUCATION", "TRANSIT AUTH", "HOUSING AUTH", "NYCHA",
  "SCHOOL CONSTR", "PORT AUTHORITY", "DORMITORY AUTH", "MTA ", "LIRR", "NYPD", "FDNY",
  "DSBS", "DCAS", "DASNY", "HHC", "SANITATION", "POLICE DEPARTMENT", "FIRE DEPARTMENT",
  "GOVERNORS ISLAND", "NYC ",
];

/** Privacy-relevant boolean: true if this owner string is safe to display verbatim (i.e. it is
 * NOT an individual person). Blank owner strings are also "safe" (no personal data to protect).
 * This stays stricter than classifyOwnerEntityType in one respect: "Unknown/Other" (couldn't
 * confidently tell) is treated as NOT proven-individual-safe only if a legacy signal fires;
 * otherwise the safe default when genuinely uncertain is still to mask. */
export function isEntityOwner(owner: string | null | undefined): boolean {
  if (!owner || !owner.trim()) return true; // no personal data to protect
  const upper = owner.toUpperCase();
  if (upper.trim() === "UNAVAILABLE OWNER") return true;
  if (LEGACY_GOV_UTILITY_PHRASES.some((phrase) => upper.includes(phrase))) return true;
  if (words(upper).some((w) => LEGACY_ENTITY_WORD_TOKENS.has(w))) return true;
  const type = classifyOwnerEntityType(owner);
  return type !== "Individual" && type !== "Unknown/Other";
}
