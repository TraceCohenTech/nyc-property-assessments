export function formatUSD(v: number, decimals = 2): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(decimals)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(decimals)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/**
 * Auto-scaled USD formatter matching the site's canonical style guide:
 * $1.92T (2dp) / $656.3B (1dp) / $12.4M (1dp) / $429,591 (whole dollars, comma-grouped).
 */
export function formatUSDAuto(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

export function formatUSDFull(v: number): string {
  return `$${Math.round(v).toLocaleString()}`;
}

export function formatNumber(v: number): string {
  return Math.round(v).toLocaleString();
}

export function formatPct(v: number, decimals = 0): string {
  return `${(v * 100).toFixed(decimals)}%`;
}
