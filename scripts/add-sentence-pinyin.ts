/**
 * Fill the `phonetic` (pinyin) field on prisma/data/hsk/sentences.json in place,
 * using pinyin-pro. Run once after regenerating sentences, then commit the file;
 * the seed reads `phonetic` straight from the JSON so fresh installs get it.
 *
 * Usage: npx tsx scripts/add-sentence-pinyin.ts
 *
 * pinyin-pro is a devDependency — this is a data-build step, never a runtime
 * path. Deployed databases that were already seeded are handled separately by
 * scripts/backfill-sentence-pinyin.ts (which reads this committed JSON).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { pinyin } from "pinyin-pro";

type Sentence = {
  text: string;
  translation: string;
  source: string;
  terms: string[];
  phonetic?: string;
  metadata: { level: number };
};

/** Toned pinyin for a sentence, with the stray spaces before CJK/ASCII
 * punctuation that word-segmentation leaves behind tidied up. */
function toPinyin(text: string): string {
  const raw = pinyin(text, { toneType: "symbol", type: "string" });
  return raw
    .replace(/\s+([，。！？；：、）】」』%…])/g, "$1")
    .replace(/([（【「『])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const file = join(__dirname, "..", "prisma", "data", "hsk", "sentences.json");
const sentences = JSON.parse(readFileSync(file, "utf8")) as Sentence[];

for (const s of sentences) s.phonetic = toPinyin(s.text);

writeFileSync(file, JSON.stringify(sentences), { encoding: "utf8" });
console.log(`add-sentence-pinyin: filled phonetic on ${sentences.length} sentences`);
console.log("sample:", sentences[0]?.text, "→", sentences[0]?.phonetic);
