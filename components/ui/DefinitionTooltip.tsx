"use client";

import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Inline glossary term. Click/focus-toggled (not hover-only) so it works on touch and keyboard.
 * Usage: <DefinitionTooltip term="Assessed value">The portion of market value...</DefinitionTooltip>
 */
export function DefinitionTooltip({ term, children }: { term: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center gap-1 border-b border-dotted border-blue-400 text-blue-700 font-medium hover:text-blue-800 active:scale-[0.98]"
      >
        {term}
        <HelpCircle className="h-3 w-3 text-blue-400" aria-hidden="true" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-slate-900 text-white text-xs leading-relaxed p-3 shadow-modal"
        >
          {children}
        </span>
      )}
    </span>
  );
}
