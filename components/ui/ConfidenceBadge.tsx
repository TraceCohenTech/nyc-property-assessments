type Level = "high" | "medium" | "low" | "planned";

const STYLES: Record<Level, string> = {
  high: "bg-emerald-50 border-emerald-200 text-emerald-700",
  medium: "bg-yellow-50 border-yellow-200 text-yellow-700",
  low: "bg-orange-50 border-orange-200 text-orange-700",
  planned: "bg-slate-100 border-slate-200 text-slate-500",
};

const LABELS: Record<Level, string> = {
  high: "Verified",
  medium: "Approximate",
  low: "Low confidence",
  planned: "Planned",
};

export function ConfidenceBadge({ level, label }: { level: Level; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STYLES[level]}`}>
      {label ?? LABELS[level]}
    </span>
  );
}
