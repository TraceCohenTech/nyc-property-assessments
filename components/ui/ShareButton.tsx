"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

/** Copies the current page URL (including query params) to the clipboard. */
export function ShareButton({ label = "Copy link" }: { label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.97]"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Share2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {copied ? "Copied!" : label}
    </button>
  );
}
