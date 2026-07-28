// Fixed vocab produced by the ETL transform (transform.ts / 06_build_sqlite.ts) — documented
// in DATA_DICTIONARY.md. Kept as UI-layer constants rather than queried at runtime since the
// rollup logic (not the underlying data) determines the set.

export const PROPERTY_TYPES = [
  "one-family",
  "two-family",
  "small multifamily",
  "walk-up apt",
  "elevator apt",
  "condo",
  "coop",
  "office",
  "retail",
  "industrial",
  "hotel",
  "parking/garage",
  "mixed-use residential",
  "utility",
  "vacant land",
  "government/institutional",
  "entertainment/assembly",
  "other",
] as const;

export const VALUE_BANDS = [
  "<$500K",
  "$500K–1M",
  "$1M–2M",
  "$2M–5M",
  "$5M–10M",
  "$10M–20M",
  "$20M–50M",
  "$50M+",
] as const;

export const ENTITY_OPTIONS = [
  { value: "all", label: "All owner types" },
  { value: "llc", label: "LLC" },
  { value: "corp", label: "Corporation" },
  { value: "trust", label: "Trust / Estate" },
  { value: "government", label: "Government" },
  { value: "nonprofit", label: "Nonprofit / Institution" },
] as const;

export const SORT_OPTIONS = [
  { value: "value_desc", label: "Market value (high to low)" },
  { value: "value_asc", label: "Market value (low to high)" },
  { value: "year_desc", label: "Year built (newest)" },
  { value: "year_asc", label: "Year built (oldest)" },
  { value: "units_desc", label: "Total units (most)" },
  { value: "units_asc", label: "Total units (fewest)" },
  { value: "address_asc", label: "Address (A-Z)" },
] as const;

export const TAX_CLASSES = ["1", "1A", "1B", "1C", "1D", "2", "2A", "2B", "2C", "3", "4"];
