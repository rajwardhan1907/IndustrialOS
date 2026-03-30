// Phase 17: Data Export — CSV download utility (no external packages needed)

/**
 * Convert an array of objects to a CSV string.
 * Keys from the first row become the header row.
 */
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape  = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    // Wrap in quotes if contains comma, quote, or newline
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(",")),
  ];
  return lines.join("\r\n");
}

/**
 * Trigger a browser file download for the given CSV content.
 */
export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (typeof window === "undefined") return;
  const csv  = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
