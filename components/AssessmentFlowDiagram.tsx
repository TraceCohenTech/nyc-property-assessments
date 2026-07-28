import { CATEGORICAL } from "@/lib/colors";

const STAGES = [
  {
    title: "Tentative Roll",
    when: "Published Jan 15",
    desc: "DOF sets a proposed market & assessed value for every property, based on sales, income, and cost data.",
    color: CATEGORICAL.blue,
  },
  {
    title: "Protest Window",
    when: "Jan 15 – Mar 1–15",
    desc: "Owners can challenge their value with the Tax Commission before the roll finalizes.",
    color: CATEGORICAL.orange,
  },
  {
    title: "Change by Notice",
    when: "Spring",
    desc: "DOF issues Notices of Property Value reflecting corrections, exemptions, and abatements.",
    color: CATEGORICAL.aqua,
  },
  {
    title: "Final Roll",
    when: "Published ~May 25",
    desc: "Values lock for the fiscal year and become the basis for property tax bills.",
    color: CATEGORICAL.green,
  },
];

export function AssessmentFlowDiagram() {
  return (
    <div
      role="img"
      aria-label="Four-stage diagram of the NYC Department of Finance property assessment process: Tentative Roll, Protest Window, Change by Notice, then Final Roll"
      className="w-full"
    >
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-0">
        {STAGES.map((s, i) => (
          <div key={s.title} className="relative flex-1 flex flex-col items-center text-center px-2">
            {i < STAGES.length - 1 && (
              <div
                className="hidden sm:block absolute top-6 left-1/2 w-full h-0.5"
                style={{ background: "linear-gradient(90deg, #cbd5e1, #cbd5e1)" }}
                aria-hidden="true"
              >
                <svg className="absolute -right-2 -top-[7px]" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M2 1 L11 7 L2 13" stroke="#94a3b8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
            <div
              className="relative z-10 h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: s.color }}
              aria-hidden="true"
            >
              {i + 1}
            </div>
            <div className="mt-3 font-bold text-slate-900 text-sm sm:text-base">{s.title}</div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mt-0.5">{s.when}</div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-[220px]">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
