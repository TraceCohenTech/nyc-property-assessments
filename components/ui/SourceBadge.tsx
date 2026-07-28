import { DATA_SOURCE_LABEL } from "@/lib/nav";
import { Database } from "lucide-react";

export function SourceBadge({ label = DATA_SOURCE_LABEL }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600">
      <Database className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}
