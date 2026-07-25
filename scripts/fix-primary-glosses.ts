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

const META =
  /^(also pr\.|abbr\. for|variant of|see |old variant|used in|surname |CL:|erhua variant|old form of|see also)/i;

/** Whole gloss is nothing but a grammar label, e.g. "(adverb of degree)". */
const PURE_LABEL =
  /^\((adverb|specifier|classifier|prefix|modal particle|question particle|particle)[^)]*\)$/i;

/**
 * A leading uppercase letter in pinyin ⇒ CC-CEDICT proper-noun sense (Xīn, Rì,
 * Zhōng…). Pinyin readings are otherwise lowercase, so first-letter case is the
 * signal — and it must tolerate a tone-marked vowel as the second char.
 */
const properReading = (r?: string) => !!r && /^[A-Z]/.test(r);

/** Normalize a reading for pronunciation comparison (case + spacing only). */
const pron = (r: string) => r.toLowerCase().replace(/\s+/g, "");

/**
 * Real lexical content once a leading "(...)" qualifier is stripped — AND the
 * sense shares the pronunciation the card teaches. The pronunciation guard is
 * critical: a sense with a different reading (e.g. 吗 "(coll.) what?" má vs the
 * question-particle ma) is a different word on the same character, not a better
 * gloss for this card — promoting it would mis-teach the reading and flip the
 * audio logic. Capitalization-only differences (proper-noun casing Xīn vs xīn)
 * are treated as the same pronunciation and normalized separately.
 */
function isClean(m: Meaning, cardPhonetic: string): boolean {
  if (META.test(m.gloss)) return false;
  if (properReading(m.reading ?? cardPhonetic)) return false;
  if (PURE_LABEL.test(m.gloss.trim())) return false;
  const reading = m.reading ?? cardPhonetic;
  if (pron(reading) !== pron(cardPhonetic)) return false;
  const stripped = m.gloss.replace(/^\([^)]*\)\s*/, "").trim();
  return stripped.length > 0;
}

function badPrimary(m: Meaning, cardPhonetic: string): boolean {
  return (
    META.test(m.gloss) ||
    properReading(m.reading ?? cardPhonetic) ||
    PURE_LABEL.test(m.gloss.trim())
  );
}

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
    if (!badPrimary(ms[0], w.phonetic)) continue;

    const idx = ms.findIndex((m) => isClean(m, w.phonetic));
    if (idx > 0) {
      const [good] = ms.splice(idx, 1);
      ms.unshift(good);
      // The card's phonetic came from the proper-noun entry (capitalized, e.g.
      // 新 "Xīn"); the promoted common sense carries the everyday reading in
      // lowercase ("xīn"). Adopt it so the displayed pinyin is right and the
      // reading matches (keeps CardFace speaking the word, not the sentence).
      // Audio clips are keyed by the term, not the phonetic, so clips still match.
      if (properReading(w.phonetic) && good.reading && !properReading(good.reading)) {
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
