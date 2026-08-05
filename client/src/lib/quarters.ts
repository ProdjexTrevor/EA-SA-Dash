/** Turn quarter-end ISO date into label leaders use (e.g. Q1 2026). */
export function formatQuarterLabel(isoDate: string): string {
  const iso = normalizeQuarterDate(isoDate);
  if (!iso) return "—";
  const y = Number(iso.slice(0, 4));
  const mo = Number(iso.slice(5, 7));
  const q = mo <= 3 ? 1 : mo <= 6 ? 2 : mo <= 9 ? 3 : 4;
  return `Q${q} ${y}`;
}

/** API may return Date objects as ISO strings — always use YYYY-MM-DD for requests. */
export function normalizeQuarterDate(value: unknown): string {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : "";
}
