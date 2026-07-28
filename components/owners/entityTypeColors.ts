import { CATEGORICAL } from "@/lib/colors";

// Shared color assignment for owner entity types, used across the Owners directory, owner
// profile pages, and borough entity-mix charts so the same type always reads as the same
// color everywhere on the site. Individual is deliberately last / muted — it's shown only as
// an aggregate slice (never ranked, never a link) per the privacy rule.
export const ENTITY_TYPE_COLOR: Record<string, string> = {
  LLC: CATEGORICAL.blue,
  Corporation: CATEGORICAL.orange,
  Government: CATEGORICAL.aqua,
  "Trust/Estate": CATEGORICAL.yellow,
  "Nonprofit/Institution": CATEGORICAL.green,
  Partnership: CATEGORICAL.red,
  "Cooperative corporation": "#0e7490", // teal — distinct from aqua, still non-purple
  "Housing company": "#7c5a00", // brown/dark-gold — distinct from yellow
  Individual: "#94a3b8", // slate — muted, aggregate-only slice
  "Unknown/Other": "#cbd5e1",
};

export function entityTypeColor(type: string, fallbackIndex = 0): string {
  return ENTITY_TYPE_COLOR[type] ?? [CATEGORICAL.blue, CATEGORICAL.orange, CATEGORICAL.aqua, CATEGORICAL.yellow][fallbackIndex % 4];
}
