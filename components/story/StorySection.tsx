import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/story/Reveal";

export function StorySection({
  id,
  index,
  eyebrow,
  displayStat,
  headline,
  href,
  linkLabel,
  accent,
  chart,
}: {
  id: string;
  index: number;
  eyebrow: string;
  displayStat: string;
  headline: string;
  href: string;
  linkLabel: string;
  accent: string;
  chart?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 min-h-[70vh] sm:min-h-[80vh] flex items-center py-12 sm:py-16 border-t border-slate-100 first:border-t-0">
      <div className="w-full grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-center">
        <Reveal>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white shrink-0" style={{ background: accent }}>
              {index + 1}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{eyebrow}</span>
          </div>
          <div className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 tabular-nums leading-none">{displayStat}</div>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">{headline}</p>
          <Link
            href={href}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800 active:scale-[0.98] min-h-[36px]"
          >
            {linkLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Reveal>
        {chart && (
          <Reveal delay={0.12}>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-card" style={{ height: 280 }}>
              {chart}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
