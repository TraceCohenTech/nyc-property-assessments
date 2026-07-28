"use client";

import { useEffect, useState } from "react";

/**
 * Fixed dot-rail scroll progress indicator. Tracks which /story section is currently most in
 * view via IntersectionObserver and highlights the matching dot; clicking a dot scrolls to
 * that section. Hidden on small screens (a thin top progress bar takes over there instead)
 * since a vertical rail eats too much width on mobile.
 */
export function ProgressIndicator({ sectionIds, labels }: { sectionIds: string[]; labels: string[] }) {
  const [active, setActive] = useState(0);
  const [scrollPct, setScrollPct] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = sectionIds.indexOf(entry.target.id);
            if (idx !== -1) setActive(idx);
          }
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    function onScroll() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setScrollPct(max > 0 ? (doc.scrollTop / max) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [sectionIds]);

  return (
    <>
      {/* Mobile: thin top progress bar */}
      <div className="sm:hidden fixed top-0 left-0 right-0 h-1 bg-slate-100 z-40" aria-hidden="true">
        <div className="h-full bg-blue-600 transition-[width] duration-150" style={{ width: `${scrollPct}%` }} />
      </div>

      {/* Desktop: dot rail */}
      <nav
        aria-label="Story progress"
        className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-3"
      >
        {sectionIds.map((id, i) => (
          <button
            key={id}
            type="button"
            aria-label={`Jump to: ${labels[i]}`}
            aria-current={active === i}
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="group relative flex items-center justify-center"
          >
            <span
              className={`block rounded-full transition-all ${active === i ? "h-3 w-3 bg-blue-600" : "h-2 w-2 bg-slate-300 group-hover:bg-slate-400"}`}
            />
            <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
              {labels[i]}
            </span>
          </button>
        ))}
      </nav>
    </>
  );
}
