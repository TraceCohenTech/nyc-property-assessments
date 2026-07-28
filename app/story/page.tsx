import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Layers, Users } from "lucide-react";

import storyRaw from "@/data/analytics/story.json";
import { formatNumber, formatUSDAuto } from "@/lib/format";
import { CATEGORICAL_ORDER } from "@/lib/colors";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { StorySection } from "@/components/story/StorySection";
import { StoryChart, type StorySeriesPoint, type StoryFormatKind } from "@/components/story/StoryChart";
import { ProgressIndicator } from "@/components/story/ProgressIndicator";
import { Reveal } from "@/components/story/Reveal";

type Finding = {
  id: string;
  headline_stat: string;
  value: number;
  comparison: Record<string, string | number>;
  supporting_series: StorySeriesPoint[];
  source_file: string;
};

const story = storyRaw as unknown as { findings: Finding[] };

export const metadata: Metadata = {
  title: "The State of NYC Property | NYC Property Assessment Explorer",
  description:
    "10 findings from NYC's $1.9T property tax base: the assessment gap between homes and apartments, JFK Airport as a single $18.88B tax lot, the 1920s construction boom, and who really owns the city.",
  openGraph: {
    title: "The State of NYC Property",
    description:
      "10 data-backed findings from every one of NYC's 1.17M tax lots — the FY2027 DOF assessment roll, distilled.",
    type: "article",
  },
};

const usdAuto = (v: number) => formatUSDAuto(v);
const num = (v: number) => formatNumber(v);
const acres = (v: number) => `${(v / 43560).toFixed(0)} ac`;

type Config = {
  eyebrow: string;
  displayStat: string;
  href: string;
  linkLabel: string;
  chart?: { series: StorySeriesPoint[]; formatKind: StoryFormatKind; ariaLabel: string; horizontal?: boolean };
};

function buildConfig(f: Finding): Config {
  switch (f.id) {
    case "class1-vs-class2-assessment-gap":
      return {
        eyebrow: "Tax burden",
        displayStat: "6% vs 45%",
        href: "/analytics/tax-burden",
        linkLabel: "See the full tax-burden breakdown",
        chart: { series: f.supporting_series, formatKind: "pct", ariaLabel: "Bar chart of effective assessment ratio by tax class, Class 1 far lower than Classes 2 through 4" },
      };
    case "top10-owner-groups-value-share":
      return {
        eyebrow: "Ownership concentration",
        displayStat: "8.02%",
        href: "/analytics/ownership-concentration",
        linkLabel: "Explore ownership concentration",
        chart: { series: f.supporting_series, formatKind: "pct", ariaLabel: "Bar chart of citywide value share held by the top N entity owner-groups, from top 10 to all tracked groups" },
      };
    case "largest-single-owner":
      return {
        eyebrow: "Ownership concentration",
        displayStat: usdAuto(f.value),
        href: "/owners/nyc-department-of-parks-and-recreation",
        linkLabel: "View this owner's full profile",
      };
    case "top-exempt-owner":
      return {
        eyebrow: "Exemptions",
        displayStat: usdAuto(f.value),
        href: "/analytics/exemptions",
        linkLabel: "See the exemptions breakdown",
      };
    case "individual-vs-corporate-value":
      return {
        eyebrow: "Ownership concentration",
        displayStat: "40.7%",
        href: "/analytics/ownership-concentration",
        linkLabel: "Compare ownership splits",
        chart: { series: f.supporting_series, formatKind: "pct", ariaLabel: "Bar chart comparing citywide market value share held by individuals, government, and private entities" },
      };
    case "most-valuable-lot":
      return {
        eyebrow: "Extremes",
        displayStat: usdAuto(f.value),
        href: "/properties/4142600001",
        linkLabel: "View this property record",
        chart: { series: f.supporting_series, formatKind: "usdAuto", ariaLabel: "Horizontal bar chart of the 5 most valuable single tax lots in NYC by market value", horizontal: true },
      };
    case "peak-construction-decade":
      return {
        eyebrow: "Timeline",
        displayStat: `${num(f.value)} lots`,
        href: "/analytics/timeline",
        linkLabel: "See the full construction timeline",
        chart: { series: f.supporting_series, formatKind: "num", ariaLabel: "Bar chart of still-standing lots by construction decade, the 1920s the tallest bar" },
      };
    case "rent-stabilization-borough-gap":
      return {
        eyebrow: "Rent regulation",
        displayStat: "83.5%",
        href: "/rent-regulation",
        linkLabel: "Explore rent regulation by borough",
        chart: { series: f.supporting_series, formatKind: "pct", ariaLabel: "Bar chart of rent-stabilized share of pre-1974 6-plus-unit apartment stock by borough, Queens highest, Staten Island lowest" },
      };
    case "richest-zip-by-median-value":
      return {
        eyebrow: "ZIP league",
        displayStat: usdAuto(f.value),
        href: "/analytics/zips",
        linkLabel: "Browse the ZIP league table",
        chart: { series: f.supporting_series, formatKind: "usdAuto", ariaLabel: "Horizontal bar chart of the 5 NYC ZIP codes with the highest median property value", horizontal: true },
      };
    case "largest-vacant-land-holder":
      return {
        eyebrow: "Extremes",
        displayStat: acres(f.value),
        href: "/analytics/extremes#vacant-land-owners",
        linkLabel: "See the vacant-land leaderboard",
        chart: { series: f.supporting_series, formatKind: "acres", ariaLabel: "Horizontal bar chart of the largest vacant-land holders by total lot area", horizontal: true },
      };
    default:
      return { eyebrow: "Finding", displayStat: String(f.value), href: "/analytics", linkLabel: "Explore analytics" };
  }
}

export default function StoryPage() {
  const findings = story.findings;
  const configs = findings.map(buildConfig);
  const sectionIds = findings.map((f) => f.id);
  const labels = configs.map((c) => c.eyebrow);

  return (
    <div className="pb-24">
      <ProgressIndicator sectionIds={sectionIds} labels={labels} />

      <div className="relative overflow-hidden pt-28 sm:pt-36 pb-16 sm:pb-24 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
        <div
          className="absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <div className="flex justify-center mb-4">
            <SourceBadge />
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900">The State of NYC Property</h1>
          <p className="mt-5 text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Ten findings pulled straight from every one of NYC&apos;s 1.17M tax lots — the FY2027 DOF assessment roll,
            distilled into the numbers that matter. Scroll to explore.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {findings.map((f, i) => {
          const c = configs[i];
          return (
            <StorySection
              key={f.id}
              id={f.id}
              index={i}
              eyebrow={c.eyebrow}
              displayStat={c.displayStat}
              headline={f.headline_stat}
              href={c.href}
              linkLabel={c.linkLabel}
              accent={CATEGORICAL_ORDER[i % CATEGORICAL_ORDER.length]}
              chart={
                c.chart ? (
                  <StoryChart series={c.chart.series} formatKind={c.chart.formatKind} ariaLabel={c.chart.ariaLabel} horizontal={c.chart.horizontal} />
                ) : undefined
              }
            />
          );
        })}
      </div>

      {/* CTA grid */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 mt-8 sm:mt-16">
        <Reveal>
          <div className="rounded-3xl border border-slate-200 bg-slate-900 p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Go deeper into the data</h2>
            <p className="mt-3 text-slate-300 max-w-xl mx-auto">
              Every number above is one query away from 1.17M individual tax lots. Start exploring.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <Link
                href="/explorer"
                className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:bg-white/10 active:scale-[0.98] transition-colors"
              >
                <Compass className="h-5 w-5 text-blue-400 mb-2" aria-hidden="true" />
                <div className="font-semibold text-white">Property Explorer</div>
                <div className="text-sm text-slate-400 mt-1">Search and filter all 1.17M tax lots.</div>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-400">
                  Open Explorer <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
              <Link
                href="/analytics"
                className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:bg-white/10 active:scale-[0.98] transition-colors"
              >
                <Layers className="h-5 w-5 text-orange-400 mb-2" aria-hidden="true" />
                <div className="font-semibold text-white">Analytics hub</div>
                <div className="text-sm text-slate-400 mt-1">Treemaps, timelines, tax burden, and more.</div>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-400">
                  Browse analytics <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
              <Link
                href="/owners"
                className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:bg-white/10 active:scale-[0.98] transition-colors"
              >
                <Users className="h-5 w-5 text-emerald-400 mb-2" aria-hidden="true" />
                <div className="font-semibold text-white">Entity owners</div>
                <div className="text-sm text-slate-400 mt-1">Profiles for the largest tracked owner-groups.</div>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-400">
                  Browse owners <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
