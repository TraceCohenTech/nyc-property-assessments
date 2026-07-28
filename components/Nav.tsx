"use client";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "#boroughs", label: "Boroughs" },
  { href: "#tax-equity", label: "Tax Equity" },
  { href: "#neighborhoods", label: "Zips" },
  { href: "#buildings", label: "Buildings" },
  { href: "#owners", label: "Owners" },
  { href: "#search", label: "Search" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-14 flex items-center justify-between">
        <a href="#top" className={`font-bold text-sm sm:text-base ${scrolled ? "text-slate-900" : "text-white"}`}>
          NYC Property Roll <span className="hidden sm:inline opacity-60">· FY2027</span>
        </a>
        <div className="hidden md:flex items-center gap-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition active:scale-[0.97] ${
                scrolled
                  ? "text-slate-700 hover:bg-slate-100"
                  : "text-white hover:text-white hover:bg-white/10"
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>
        <a
          href="#search"
          className={`hidden sm:inline-flex items-center text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-md transition active:scale-[0.97] ${
            scrolled
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-white/15 text-white hover:bg-white/25 backdrop-blur"
          }`}
        >
          Look up a property →
        </a>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className={`md:hidden inline-flex items-center justify-center h-11 w-11 rounded-md active:scale-[0.97] ${
            scrolled ? "text-slate-900" : "text-white"
          }`}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden bg-white border-b border-slate-200 shadow-sm">
          <div className="flex flex-col px-4 py-2">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-slate-700 border-b border-slate-100 last:border-0 min-h-[44px] flex items-center"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
