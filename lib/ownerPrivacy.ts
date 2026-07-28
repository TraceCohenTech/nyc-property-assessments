// Distinguishes business/institutional/government property owners (safe to display as-is)
// from individual people (redacted everywhere in the public UI — API + rendered pages).
//
// This module now delegates the actual heuristic to lib/owners/classify.ts (the shared
// entity-type classifier used by the ETL owner-consolidation pipeline), so the privacy rule
// and the data-layer's entity typing can never drift apart. The exported API below
// (isEntityOwner, displayOwner, PRIVATE_OWNER_LABEL) is UNCHANGED — app code importing this
// file keeps working exactly as before. See lib/owners/classify.ts for the rule set and the
// explicit guarantee that this refactor only ever extends privacy coverage, never weakens it.

// Note: Next.js's bundler resolves extensionless TS imports fine; the extension-less form is
// kept here for app compatibility. If ever run directly under plain Node ESM, use
// `--experimental-specifier-resolution=node` or resolve `lib/owners/classify.ts` explicitly.
import { isEntityOwner as classifyIsEntityOwner } from "./owners/classify";

export function isEntityOwner(owner: string | null | undefined): boolean {
  return classifyIsEntityOwner(owner);
}

export const PRIVATE_OWNER_LABEL = "Private Owner";

/** Returns the owner string if it's a business/institutional/government entity, else a redaction label. */
export function displayOwner(owner: string | null | undefined): string {
  if (!owner) return PRIVATE_OWNER_LABEL;
  return isEntityOwner(owner) ? owner : PRIVATE_OWNER_LABEL;
}
