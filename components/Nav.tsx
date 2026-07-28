"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import { PRIMARY_NAV, PRODUCT_SHORT_NAME } from "@/lib/nav";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Homepage hero is dark, so nav starts transparent/white-on-dark there; every other page
  // has a light background from the top, so the nav should start in its "scrolled" (light) style.
  const solid = scrolled || pathname !== "/";

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        solid ? "bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className={`font-bold text-sm sm:text-base shrink-0 ${solid ? "text-slate-900" : "text-white"}`}>
          {PRODUCT_SHORT_NAME} <span className="hidden sm:inline opacity-60">· FY2027</span>
        </Link>
        <div className="hidden lg:flex items-center gap-0.5 overflow-x-auto no-scrollbar">
          {PRIMARY_NAV.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative px-2.5 py-1.5 rounded-md text-[13px] font-medium transition active:scale-[0.97] whitespace-nowrap nav-link ${
                  active
                    ? solid
                      ? "bg-blue-50 text-blue-700"
                      : "bg-white/20 text-white"
                    : solid
                      ? "text-slate-700 hover:bg-slate-100"
                      : "text-white/85 hover:text-white hover:bg-white/10"
                }`}
              >
                {l.label}
                {!active && (
                  <span
                    aria-hidden="true"
                    className={`nav-link-underline ${solid ? "bg-blue-600" : "bg-white"}`}
                  />
                )}
              </Link>
            );
          })}
        </div>
        <Link
          href="/explorer"
          className={`hidden lg:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-md transition active:scale-[0.97] shrink-0 ${
            solid ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white/15 text-white hover:bg-white/25 backdrop-blur"
          }`}
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Search
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className={`lg:hidden inline-flex items-center justify-center h-11 w-11 rounded-md active:scale-[0.97] shrink-0 ${
            solid ? "text-slate-900" : "text-white"
          }`}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden bg-white border-b border-slate-200 shadow-sm max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col px-4 py-2">
            {PRIMARY_NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === l.href ? "page" : undefined}
                className={`py-3 text-sm font-medium border-b border-slate-100 last:border-0 min-h-[44px] flex items-center ${
                  pathname === l.href ? "text-blue-700 font-semibold" : "text-slate-700"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
