"use client";

import { Download } from "lucide-react";

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

/** Client-side CSV export of any array of flat objects — no server round trip. */
export function ExportButton({ rows, filename = "export.csv", label = "Export CSV" }: { rows: Record<string, unknown>[]; filename?: string; label?: string }) {
  function handleClick() {
    if (rows.length === 0) return;
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-md text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.97] disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
