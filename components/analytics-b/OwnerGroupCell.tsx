import Link from "next/link";
import { Building2 } from "lucide-react";
import { displayOwner, isEntityOwner, PRIVATE_OWNER_LABEL } from "@/lib/ownerPrivacy";
import { ownerSlugFor } from "@/components/analytics-b/ownerLink";

/**
 * Renders an owner-group name from the analytics leaderboards. `name` is already entity-only
 * by data contract (see data/analytics/README.md privacy rule) — this still routes through
 * displayOwner/isEntityOwner as a defense-in-depth check, and links to the owner profile page
 * when the name resolves to a tracked owner-group slug.
 */
export function OwnerGroupCell({ name }: { name: string | null | undefined }) {
  const label = displayOwner(name);
  if (label === PRIVATE_OWNER_LABEL || !isEntityOwner(name)) {
    return <span className="text-slate-500 italic">{PRIVATE_OWNER_LABEL}</span>;
  }
  const slug = ownerSlugFor(name);
  if (slug) {
    return (
      <Link href={`/owners/${slug}`} className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:underline">
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {label}
      </Link>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
      <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
