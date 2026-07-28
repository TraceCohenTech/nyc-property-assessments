import type { ReactNode } from "react";
import { ShareButton } from "@/components/ui/ShareButton";

export function ExtremesSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-card">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <ShareButton label="Share this list" />
      </div>
      <p className="text-sm text-slate-600 mb-4 max-w-2xl">{description}</p>
      {children}
    </section>
  );
}
