/** Minimal RFC-4180 CSV encoder. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((cols) => cols.map(csvField).join(","));
  return lines.join("\r\n") + "\r\n";
}
