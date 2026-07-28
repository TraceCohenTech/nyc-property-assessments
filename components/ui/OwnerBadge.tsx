import { displayOwner, isEntityOwner, PRIVATE_OWNER_LABEL } from "@/lib/ownerPrivacy";
import { Building2, Lock } from "lucide-react";

/**
 * Renders an owner string safely: entity owners (LLC/corp/trust/gov/nonprofit) render as-is
 * with an entity icon; individual owners always render as "Private Owner" with a lock icon.
 * Never pass a raw, unfiltered owner string anywhere else in the UI — always go through this.
 */
export function OwnerBadge({ owner }: { owner: string | null | undefined }) {
  const entity = isEntityOwner(owner);
  const label = displayOwner(owner);
  return (
    <span className={`inline-flex items-center gap-1.5 ${entity ? "text-slate-900 font-semibold" : "text-slate-500 italic"}`}>
      {entity ? (
        <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
      ) : (
        <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
      )}
      {label === PRIVATE_OWNER_LABEL ? <span>{PRIVATE_OWNER_LABEL}</span> : <span>{label}</span>}
    </span>
  );
}
