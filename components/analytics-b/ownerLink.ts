import ownersIndexRaw from "@/data/owners/index.json";
import type { OwnersIndex } from "@/lib/types";

const ownersIndex = ownersIndexRaw as unknown as OwnersIndex;

// Exact-name lookup against the top-500 tracked owner-group index (same `owner_group_name`
// values the ETL emits into treemap/extremes/story). Not every entity name in the analytics
// files clears the top-500 cutoff, so this can legitimately miss — callers must render the
// plain name (no link) when it does, never guess a slug.
const NAME_TO_SLUG = new Map(ownersIndex.owners.map((o) => [o.name, o.slug]));

export function ownerSlugFor(name: string | null | undefined): string | null {
  if (!name) return null;
  return NAME_TO_SLUG.get(name) ?? null;
}
