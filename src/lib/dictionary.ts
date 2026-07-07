import { gunzipSync } from "zlib";
import { readFileSync } from "fs";
import path from "path";

/**
 * Lazy CC-CEDICT lookup for word-entry suggestions on Chinese lists. The
 * dataset (prisma/data/cedict/cedict.json.gz, CC BY-SA 4.0 — see its README)
 * maps a headword (simplified or traditional) to up to three
 * [numberedPinyin, meanings[]] entries. Loaded once per process on first use;
 * ~40 MB resident, fine for a single-instance deployment.
 */

type RawEntry = [string, string[]];

let table: Record<string, RawEntry[]> | null = null;

function load(): Record<string, RawEntry[]> {
  if (!table) {
    const file = path.join(
      process.cwd(),
      "prisma",
      "data",
      "cedict",
      "cedict.json.gz"
    );
    table = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  }
  return table!;
}

const TONE_MARKS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à", "a"],
  e: ["ē", "é", "ě", "è", "e"],
  i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"],
  u: ["ū", "ú", "ǔ", "ù", "u"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

/** "ni3 hao3" → "nǐ hǎo". Standard placement: a/e first, ou → o, else last vowel. */
export function toneMarks(numbered: string): string {
  return numbered
    .split(" ")
    .map((syl) => {
      const m = syl.match(/^([a-zA-Zü:]+)([1-5])$/);
      if (!m) return syl;
      let [, letters, toneStr] = m;
      letters = letters.replace(/u:/g, "ü").replace(/v/g, "ü");
      const tone = Number(toneStr) - 1;
      if (tone === 4) return letters; // neutral tone: no mark
      const lower = letters.toLowerCase();
      let idx = -1;
      if (lower.includes("a")) idx = lower.indexOf("a");
      else if (lower.includes("e")) idx = lower.indexOf("e");
      else if (lower.includes("ou")) idx = lower.indexOf("o");
      else {
        for (let i = lower.length - 1; i >= 0; i--) {
          if ("iouü".includes(lower[i])) {
            idx = i;
            break;
          }
        }
      }
      if (idx === -1) return letters;
      const ch = lower[idx];
      const marked = TONE_MARKS[ch]?.[tone];
      if (!marked) return letters;
      return letters.slice(0, idx) + marked + letters.slice(idx + 1);
    })
    .join(" ");
}

export interface DictionarySuggestion {
  phonetic: string; // pinyin with tone marks
  translation: string; // meanings joined with "; "
}

/** Exact-headword lookup; returns [] for unknown terms. */
export function lookupChinese(term: string): DictionarySuggestion[] {
  const entries = load()[term.trim()];
  if (!entries) return [];
  return entries.map(([pinyin, meanings]) => ({
    phonetic: toneMarks(pinyin.toLowerCase()),
    translation: meanings.join("; "),
  }));
}
