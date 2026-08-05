/** Display names stored in ALL CAPS → title case (e.g. SIERRA LEONE → Sierra Leone). */

const KEEP_UPPER = new Set(["usa", "uk", "drc", "car", "uae", "dprk", "prc", "mba", "mbb"]);
const MINOR_WORDS = new Set(["of", "the", "and", "in", "de", "du", "la", "le", "des", "das", "dos"]);

function titleWord(word: string): string {
  const w = word.toLowerCase();
  if (KEEP_UPPER.has(w)) return w.toUpperCase();
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** True when string is mostly uppercase letters (database export style). */
function isMostlyUppercase(s: string): boolean {
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 2) return false;
  const upper = (s.match(/[A-ZÀ-Ý]/g) ?? []).length;
  return upper / letters.length >= 0.85;
}

export function formatPlaceName(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s || !isMostlyUppercase(s)) return s;

  const words = s.toLowerCase().split(/\s+/);
  return words
    .map((word, i) =>
      word
        .split("-")
        .map((part, j) => {
          const tw = titleWord(part);
          if ((i > 0 || j > 0) && MINOR_WORDS.has(tw.toLowerCase())) return tw.toLowerCase();
          return tw;
        })
        .join("-")
    )
    .join(" ")
    .replace(/,\s*([a-z])/g, (_, c) => `, ${c.toUpperCase()}`)
    .replace(/'([a-z])/g, (_, c) => `'${c.toUpperCase()}`);
}
