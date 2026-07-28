import { CheckCircle2, Building2, Landmark, HelpCircle, XCircle } from "lucide-react";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";

type StatusDef = {
  key: string;
  label: string;
  icon: React.ReactNode;
  badgeLevel: "high" | "medium" | "low" | "planned";
  badgeLabel: string;
  description: string;
};

const STATUSES: StatusDef[] = [
  {
    key: "hcr_confirmed",
    label: "HCR confirmed",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />,
    badgeLevel: "high",
    badgeLabel: "Verified — in official list",
    description:
      "This building appears in NYS Homes & Community Renewal's official building registration file, published via the NYC Rent Guidelines Board. It has at least one apartment registered as rent-stabilized at some point — not that every unit is, or that any specific unit still is today.",
  },
  {
    key: "likely_structural_candidate",
    label: "Likely structural candidate",
    icon: <Building2 className="h-5 w-5 text-orange-600" aria-hidden="true" />,
    badgeLevel: "medium",
    badgeLabel: "Estimate — not a registration",
    description:
      "Built before 1974, has 6+ residential units, and is a multifamily building class (walk-up, elevator, or mixed residential/commercial) that isn't a condo-unit lot. This is the classic profile of a rent-stabilized building under NYC law — but it is a structural estimate derived from DOF roll fields, not a registration filing. Always labeled as an estimate.",
  },
  {
    key: "tax_benefit_regulated",
    label: "Tax-benefit regulated",
    icon: <Landmark className="h-5 w-5 text-blue-600" aria-hidden="true" />,
    badgeLevel: "high",
    badgeLabel: "Verified — 421-a / J-51 flag",
    description:
      "This building receives (or received) a 421-a or J-51 tax benefit, which comes with its own rent-stabilization requirement for the benefit period — independent of the building's age or size. Shown as a flag on HCR-confirmed buildings, sourced from the same registration file.",
  },
  {
    key: "unknown",
    label: "Unknown",
    icon: <HelpCircle className="h-5 w-5 text-slate-500" aria-hidden="true" />,
    badgeLevel: "low",
    badgeLabel: "Insufficient data",
    description:
      "The roll doesn't carry enough of the fields (year built, unit count, building class) needed to even estimate structural eligibility for this property, and it isn't in the HCR list. Distinct from \"not identified\" below — this is a data-completeness gap, not a stabilization judgment.",
  },
  {
    key: "not_identified",
    label: "Not identified",
    icon: <XCircle className="h-5 w-5 text-slate-400" aria-hidden="true" />,
    badgeLevel: "planned",
    badgeLabel: "Absence of evidence ≠ evidence of absence",
    description:
      "Not in the current HCR building list and doesn't match the structural-candidate profile. This does NOT mean the building is definitely market-rate — HCR's file can lag reality, buildings can be missing from it for administrative reasons, and stabilization status can change without ever showing up here.",
  },
];

export function StatusDefinitionCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {STATUSES.map((s) => (
        <div key={s.key} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2 card-hover h-full">
          <div className="flex items-center gap-2">
            {s.icon}
            <h3 className="font-bold text-sm text-slate-900">{s.label}</h3>
          </div>
          <ConfidenceBadge level={s.badgeLevel} label={s.badgeLabel} />
          <p className="text-xs text-slate-600 leading-relaxed">{s.description}</p>
        </div>
      ))}
    </div>
  );
}
