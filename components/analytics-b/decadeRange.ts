// Pure helper, deliberately NOT in a "use client" file — server components (app/analytics/timeline/page.tsx)
// need to call this directly, and a client-only module's exports can't be invoked from server code.
export function decadeToYearRange(decade: string): { min: number; max: number } | null {
  if (decade === "Unknown") return null;
  if (decade === "<1900") return { min: 1400, max: 1899 };
  const start = parseInt(decade, 10);
  if (Number.isNaN(start)) return null;
  return { min: start, max: start + 9 };
}
