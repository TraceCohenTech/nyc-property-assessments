// Distinguishes business/institutional/government property owners (safe to display as-is)
// from individual people (redacted everywhere in the public UI — API + rendered pages).
//
// Heuristic: uppercase the owner string, then match either (a) a government/utility/
// institutional phrase as a substring, or (b) a whole word matching a known entity
// suffix/keyword (word-boundary match, so "CO" doesn't false-positive on "COLE").

const GOV_UTILITY_PHRASES = [
  "CITY OF NEW YORK",
  "STATE OF NEW YORK",
  "STATE OF NY",
  "NEW YORK STATE",
  "UNITED STATES",
  "U S A",
  "USA",
  "USPS",
  "CON EDISON",
  "CONSOLIDATED EDISON",
  "NATIONAL GRID",
  "VERIZON",
  "AMAZON.COM",
  "PARKS DEPT",
  "PARKS AND RECREATION",
  "PARKS & RECREATION",
  "DEPARTMENT OF",
  "DEPT OF",
  "DEPT  OF",
  "BOARD OF EDUCATION",
  "TRANSIT AUTH",
  "HOUSING AUTH",
  "NYCHA",
  "SCHOOL CONSTR",
  "PORT AUTHORITY",
  "DORMITORY AUTH",
  "MTA ",
  "LIRR",
  "NYPD",
  "FDNY",
  "DSBS",
  "DCAS",
  "DASNY",
  "HHC",
  "SANITATION",
  "POLICE DEPARTMENT",
  "FIRE DEPARTMENT",
  "GOVERNORS ISLAND",
  "NYC ",
];

// Whole-word tokens (matched after splitting the uppercased owner on non-letter runs).
const ENTITY_WORD_TOKENS = new Set([
  "LLC",
  "LLP",
  "LP",
  "LLLP",
  "CORP",
  "CORPORATION",
  "INC",
  "INCORPORATED",
  "TRUST",
  "REALTY",
  "HOLDINGS",
  "HOLDING",
  "ASSOCIATES",
  "ASSOC",
  "PARTNERS",
  "PARTNERSHIP",
  "CO",
  "COMPANY",
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
  "HDFC",
  "APARTMENTS",
  "APTS",
  "REIT",
  "FUND",
  "EQUITIES",
  "ESTATES",
  "TOWERS",
  "TOWER",
  "PLAZA",
  "CHURCH",
  "TEMPLE",
  "SYNAGOGUE",
  "PARISH",
  "MOSQUE",
  "CONGREGATION",
  "FOUNDATION",
  "HOSPITAL",
  "HOSPITALS",
  "MEDICAL",
  "UNIVERSITY",
  "COLLEGE",
  "SCHOOL",
  "ACADEMY",
  "MUSEUM",
  "LIBRARY",
  "SOCIETY",
  "ASSN",
  "ASSOCIATION",
  "AUTHORITY",
  "BANK",
  "UNION",
  "CREDIT",
  "OWNER",
  "OWNERS",
  "SERIES",
  "YMCA",
  "YWCA",
]);

export function isEntityOwner(owner: string | null | undefined): boolean {
  if (!owner) return false;
  const upper = owner.toUpperCase();
  if (upper === "UNAVAILABLE OWNER" || upper.trim() === "") return true; // no personal data to protect
  if (GOV_UTILITY_PHRASES.some((phrase) => upper.includes(phrase))) return true;
  const words = upper.split(/[^A-Z]+/).filter(Boolean);
  return words.some((w) => ENTITY_WORD_TOKENS.has(w));
}

export const PRIVATE_OWNER_LABEL = "Private Owner";

/** Returns the owner string if it's a business/institutional/government entity, else a redaction label. */
export function displayOwner(owner: string | null | undefined): string {
  if (!owner) return PRIVATE_OWNER_LABEL;
  return isEntityOwner(owner) ? owner : PRIVATE_OWNER_LABEL;
}
