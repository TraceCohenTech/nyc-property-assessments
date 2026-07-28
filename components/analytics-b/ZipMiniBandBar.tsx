// Sequential single-hue scale (light -> dark blue) for the 8 value bands — this is a
// magnitude/ordinal scale (low value -> high value), not a categorical one, per the design
// system rule ("single-hue only for magnitude scales").
const BAND_SHADES = ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e3a8a"];

export type ValueBandCount = { band: string; count: number };

/**
 * Tiny inline stacked bar — a small multiple showing one ZIP's value-band mix at a glance,
 * meant to sit inline in a dense table row (not a full chart).
 */
export function ZipMiniBandBar({ bands, totalLots }: { bands: ValueBandCount[]; totalLots: number }) {
  if (totalLots <= 0) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <div
      className="flex h-3 w-24 sm:w-32 overflow-hidden rounded-sm border border-slate-200 shrink-0"
      role="img"
      aria-label={`Value band distribution: ${bands.map((b) => `${b.band} ${b.count} lots`).join(", ")}`}
      title={bands.map((b) => `${b.band}: ${b.count.toLocaleString()} lots`).join(" · ")}
    >
      {bands.map((b, i) => {
        const pct = (b.count / totalLots) * 100;
        if (pct <= 0) return null;
        return <div key={b.band} style={{ width: `${pct}%`, background: BAND_SHADES[i % BAND_SHADES.length] }} />;
      })}
    </div>
  );
}

export { BAND_SHADES };
