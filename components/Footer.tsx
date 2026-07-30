import Link from "next/link";
import { DATA_SOURCE_LABEL, DISCLAIMER, PRIMARY_NAV, PRODUCT_NAME } from "@/lib/nav";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-10 mt-auto">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-1 mb-8 text-sm">
          {PRIMARY_NAV.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-slate-600 hover:text-blue-700 hover:underline py-2 min-h-[44px] flex items-center"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="border-t border-slate-100 pt-6 text-center">
          <p className="text-sm font-semibold text-slate-700 mb-1">{PRODUCT_NAME}</p>
          <p className="text-xs text-slate-500 mb-3">
            Data source: {DATA_SOURCE_LABEL}. {DISCLAIMER}
          </p>
          <p className="text-sm text-gray-500">
            <a href="https://x.com/Trace_Cohen" target="_blank" rel="noopener" className="text-blue-600 hover:underline font-semibold">
              Twitter
            </a>
            {" | "}
            <a href="mailto:t@nyvp.com" className="text-blue-600 hover:underline font-semibold">
              t@nyvp.com
            </a>
            {" | "}
            <a href="https://valueaddvc.com" target="_blank" rel="noopener" className="text-blue-600 hover:underline font-semibold">
              More dashboards at ValueAddVC.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
