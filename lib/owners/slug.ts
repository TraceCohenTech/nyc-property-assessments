// Owner-profile slug generation — used by scripts/etl/05_build_owner_profiles.ts to derive
// data/owners/[slug].json filenames + data/owners/index.json's `slug` field from an owner's
// canonical display name. Extracted into lib/owners/ (rather than living only in the ETL
// script) so it's a single source of truth and unit-testable; behavior is unchanged from the
// original inline implementation.
//
// Must be deterministic (same name -> same slug, run after run) and URL-safe (lowercase
// letters/digits/hyphens only, no leading/trailing hyphen). Collision suffixing (`-2`, `-3`, ...)
// is handled by the caller, not here — this function only does the base slugify.

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "owner"
  );
}
