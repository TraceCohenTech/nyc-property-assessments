// Validated categorical order (dataviz skill) — no purple/violet/pink per standing design rule.
// Adjacent-pair CVD + normal-vision checks pass in both light and dark; the one WARN-band
// adjacent pair (green<->red) is mitigated by always pairing color with a visible legend/label.
export const CATEGORICAL = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  green: "#008300",
  red: "#e34948",
} as const;

export const CATEGORICAL_ORDER = [
  CATEGORICAL.blue,
  CATEGORICAL.orange,
  CATEGORICAL.aqua,
  CATEGORICAL.yellow,
  CATEGORICAL.green,
  CATEGORICAL.red,
];

export const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: "#0f172a", border: "none", borderRadius: 8, color: "#fff" },
  labelStyle: { color: "#94a3b8" },
} as const;

export const AXIS_TICK = { fill: "#475569", fontSize: 12 };
export const GRID_STROKE = "#e2e8f0";

// Sequential navy/blue ramp for choropleth fills (/map). 6 quantile bins, light -> dark.
// No purple/pink per standing design rule — this is a single-hue blue ramp, safe for
// colorblind viewers when paired with the legend's numeric labels (never color alone).
export const SEQUENTIAL_BLUE = [
  "#eaf2fc",
  "#c3daf5",
  "#93bfec",
  "#5c9de0",
  "#2f74c9",
  "#164a8a",
] as const;

/** Empty/no-data fill for choropleth areas with zero matching properties. */
export const CHOROPLETH_EMPTY = "#e5e9f0";

/** Quantile-break color scale: returns a hex fill for value `v` given ascending `breaks`. */
export function quantileColor(v: number, breaks: number[], ramp: readonly string[] = SEQUENTIAL_BLUE): string {
  for (let i = 0; i < breaks.length; i++) {
    if (v <= breaks[i]) return ramp[i];
  }
  return ramp[ramp.length - 1];
}

/** Computes `n` quantile breakpoints (ascending) from a numeric array, ignoring zeros/NaN. */
export function computeQuantileBreaks(values: number[], n = 6): number[] {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (clean.length === 0) return [0, 0, 0, 0, 0, 0];
  const breaks: number[] = [];
  for (let i = 1; i <= n; i++) {
    const idx = Math.min(clean.length - 1, Math.floor((i / n) * clean.length) - 1);
    breaks.push(clean[Math.max(0, idx)]);
  }
  return breaks;
}
