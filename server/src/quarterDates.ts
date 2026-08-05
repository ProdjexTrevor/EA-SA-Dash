import { z } from "zod";

/** Normalize DB/JSON date values to YYYY-MM-DD (quarter-end). */
export function normalizeQuarterEnd(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Same quarter one year earlier (expects normalized YYYY-MM-DD). */
export function priorYearQuarterEnd(quarterEnd: string): string {
  const iso = normalizeQuarterEnd(quarterEnd);
  if (!iso) {
    throw new Error(`Invalid quarter date: ${quarterEnd}`);
  }
  return `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;
}

/** Prior quarter-end date for QoQ joins (expects normalized YYYY-MM-DD). */
export function priorQuarterEnd(quarterEnd: string): string {
  const iso = normalizeQuarterEnd(quarterEnd);
  if (!iso) {
    throw new Error(`Invalid quarter date: ${quarterEnd}`);
  }
  const y = Number(iso.slice(0, 4));
  const mo = Number(iso.slice(5, 7));
  if (mo <= 3) return `${y - 1}-12-31`;
  if (mo <= 6) return `${y}-03-31`;
  if (mo <= 9) return `${y}-06-30`;
  return `${y}-09-30`;
}

export const quarterEndParam = z
  .string()
  .min(1)
  .transform((s, ctx) => {
    const n = normalizeQuarterEnd(s);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Expected a valid quarter date (YYYY-MM-DD)" });
      return z.NEVER;
    }
    return n;
  });
