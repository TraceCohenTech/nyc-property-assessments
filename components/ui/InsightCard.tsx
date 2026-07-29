import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { CATEGORICAL } from "@/lib/colors";

export function InsightCard({
  eyebrow,
  headline,
  description,
  href,
  linkLabel = "Explore this",
  chart,
  accent = CATEGORICAL.blue,
}: {
  eyebrow: string;
  headline: string;
  description: string;
  href: string;
  linkLabel?: string;
  chart?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card card-hover h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: accent }} aria-hidden="true" />
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{eyebrow}</div>
      </div>
      <h3 className="text-lg font-bold text-slate-900 leading-snug">{headline}</h3>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">{description}</p>
      {chart && <div className="mt-4 h-[120px]">{chart}</div>}
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 active:scale-[0.98] min-h-[44px]"
      >
        {linkLabel}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}
