import type { ReactNode } from "react";

export function ChartCard({
  title,
  sub,
  height = 300,
  children,
  className = "",
}: {
  title: ReactNode;
  sub?: ReactNode;
  height?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card ${className}`}>
      <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
      {sub && <p className="text-xs text-slate-500 mb-3">{sub}</p>}
      <div style={{ height }}>{children}</div>
    </div>
  );
}
