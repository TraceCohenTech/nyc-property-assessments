// Owner name normalization — produces a canonical string used for grouping (owner_normalized)
// and as the join key when clustering formatting-variant spellings of the same owner.
//
// Rules (documented in OWNER_CONSOLIDATION_METHODOLOGY.md):
//   1. Uppercase.
//   2. Replace "&" with "AND".
//   3. Strip periods, commas, apostrophes, and other punctuation noise (keep letters/digits/spaces/hyphen).
//   4. Collapse whitespace runs to a single space; trim.
//   5. Standardize common entity-suffix formatting variants to one canonical spelling so that
//      "L L C", "L.L.C.", "LLC" all normalize identically, etc. This is a formatting
//      normalization only — it does NOT change entity-type classification, which is decided
//      separately in classify.ts against the ORIGINAL (pre-suffix-squash) uppercased text so
//      classification signal (e.g. "CORPORATION" vs "CORP") isn't lost.

const SUFFIX_REPLACEMENTS: [RegExp, string][] = [
  [/\bL\s*L\s*C\b\.?/g, "LLC"],
  [/\bL\.?L\.?C\.?\b/g, "LLC"],
  [/\bL\s*L\s*P\b\.?/g, "LLP"],
  [/\bL\.?L\.?P\.?\b/g, "LLP"],
  [/\bINCORPORATED\b/g, "INC"],
  [/\bINC\.?\b/g, "INC"],
  [/\bCORPORATION\b/g, "CORP"],
  [/\bCORP\.?\b/g, "CORP"],
  [/\bCOMPANY\b/g, "CO"],
  [/\bCO\.?\b(?!\w)/g, "CO"],
  [/\bASSOCIATES\b/g, "ASSOC"],
  [/\bASSOCIATION\b/g, "ASSN"],
];

export function normalizeOwnerName(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.toUpperCase();
  s = s.replace(/&/g, " AND ");
  // strip punctuation noise, keep alnum/space/hyphen
  s = s.replace(/[.,'"`;:()#]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of SUFFIX_REPLACEMENTS) {
    s = s.replace(pattern, replacement);
  }
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
