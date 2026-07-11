/**
 * Build prisma/data/hsk/sentences.json from the Tatoeba-derived zh↔en pair
 * file (CC-BY 2.0 FR, per-line attribution preserved in `source`).
 *
 * Usage:
 *   1. Download the pair file (not committed to this repo):
 *      curl -L -o /tmp/cmn-eng.zip https://www.manythings.org/anki/cmn-eng.zip
 *      unzip /tmp/cmn-eng.zip   # yields cmn.txt: english \t chinese \t attribution
 *   2. npx tsx scripts/generate-sentences.ts /tmp/cmn.txt
 *
 * Only sentences fully covered by the vendored HSK vocabulary are kept
 * (≤3 per word, shortest first), so every sentence is linkable to studyable
 * words. Run scripts/generate-hsk-data.ts first if the word data changed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { selectSentences, type PairInput } from "../src/lib/sentenceBuild";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npx tsx scripts/generate-sentences.ts <path-to-cmn.txt>");
  process.exit(1);
}

const dataDir = join(__dirname, "..", "prisma", "data", "hsk");

// term → lowest HSK level it appears in (sentence difficulty stamp).
const vocab = new Map<string, number>();
for (let level = 7; level >= 1; level--) {
  const words = JSON.parse(
    readFileSync(join(dataDir, `new${level}.json`), "utf8")
  ) as { term: string }[];
  for (const w of words) vocab.set(w.term, level);
}

const pairs: PairInput[] = readFileSync(inputPath, "utf8")
  .split("\n")
  .map((line) => line.split("\t"))
  .filter((cols) => cols.length >= 3)
  .map(([translation, text, source]) => ({ translation, text, source }));

const sentences = selectSentences(pairs, vocab);
writeFileSync(join(dataDir, "sentences.json"), JSON.stringify(sentences), {
  encoding: "utf8",
});

const byLevel: Record<number, number> = {};
for (const s of sentences) byLevel[s.metadata.level] = (byLevel[s.metadata.level] ?? 0) + 1;
console.log(`sentences.json: ${sentences.length} sentences`, byLevel);
