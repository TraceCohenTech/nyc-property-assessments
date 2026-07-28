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
