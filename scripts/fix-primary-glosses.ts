/**
 * Promote a sensible primary gloss for Chinese words whose first CC-CEDICT
 * sense is a proper-noun, abbreviation, or "erhua variant of …" pointer — e.g.
 * 新 led with "abbr. for Xinjiang" instead of "new", 女孩儿 with "erhua variant
 * of 女孩" instead of "girl". Beginners see meanings[0], so a wrong lead is a
 * real teaching bug.
 *
 * Conservative: only reorders a word's `metadata.meanings` when the current
 * primary is bad AND a cleaner sense already exists deeper in the same list;
 * correct proper nouns (中秋节 = "the Mid-Autumn Festival") are left untouched.
 * The top-level `translation` is rebuilt from the reordered senses so every
 * surface (cards, quiz, summaries) agrees. Edits the source JSON in place.
 *
 *   npx tsx scripts/fix-primary-glosses.ts --write   (omit --write for dry run)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  isCleanSense,
  isBadLead,
  isProperNounReading,
  type GuardedGloss,
} from "../src/lib/glossGuard";

type Meaning = { gloss: string; reading?: string };
type SeedWord = {
  term: string;
  translation: string;
  phonetic: string;
  metadata: { meanings?: Meaning[] } & Record<string, unknown>;
};

const FILES = [
  "new1", "new2", "new3", "new4", "new5", "new6", "new7", "freq100", "freq1000",
];

// Genuinely stuck terms (no clean sense in the data) with a hand-written gloss.
const MANUAL: Record<string, string> = {
  "馅儿": "filling; stuffing (in food)",
  "老伴儿": "(of an elderly couple) husband or wife",
  "大腕儿": "bigshot; big-name celebrity",
  "体检": "physical examination; medical checkup",
};

const write = process.argv.includes("--write");
let changed = 0;
const stuck: string[] = [];

for (const file of FILES) {
  const path = join(__dirname, "..", "prisma", "data", "hsk", `${file}.json`);
  const data = JSON.parse(readFileSync(path, "utf8")) as SeedWord[];
  let fileChanged = 0;

  for (const w of data) {
    const ms = w.metadata?.meanings;
    if (!ms || ms.length === 0) continue;
    if (!isBadLead(ms[0] as GuardedGloss, w.phonetic)) continue;

    const idx = ms.findIndex((m) => isCleanSense(m as GuardedGloss, w.phonetic));
    if (idx > 0) {
      const [good] = ms.splice(idx, 1);
      ms.unshift(good);
      // The card's phonetic came from the proper-noun entry (capitalized, e.g.
      // 新 "Xīn"); the promoted common sense carries the everyday reading in
      // lowercase ("xīn"). Adopt it so the displayed pinyin is right and the
      // reading matches (keeps CardFace speaking the word, not the sentence).
      // Audio clips are keyed by the term, not the phonetic, so clips still match.
      if (
        isProperNounReading(w.phonetic) &&
        good.reading &&
        !isProperNounReading(good.reading)
      ) {
        w.phonetic = good.reading;
      }
      w.translation = ms.map((m) => m.gloss).join("; ");
      fileChanged++;
    } else if (idx === -1) {
      if (MANUAL[w.term]) {
        ms.unshift({ gloss: MANUAL[w.term] });
        w.translation = ms.map((m) => m.gloss).join("; ");
        fileChanged++;
      } else {
        stuck.push(`${file} ${w.term} [${w.phonetic}] ${ms[0].gloss.slice(0, 50)}`);
      }
    }
  }

  if (fileChanged && write) writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  if (fileChanged) console.log(`${file}: ${fileChanged} primaries promoted`);
  changed += fileChanged;
}

console.log(`\n${write ? "WROTE" : "DRY RUN"} — ${changed} words would change.`);
console.log(`Left as-is (likely correct proper nouns): ${stuck.length}`);
stuck.forEach((s) => console.log("  " + s));
