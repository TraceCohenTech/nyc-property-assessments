import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 card-hover h-full flex flex-col">
      <div className="flex items-center gap-2">
        {accent && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: accent }} aria-hidden="true" />}
        {icon}
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      </div>
      <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}
