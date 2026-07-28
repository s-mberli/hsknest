/**
 * Sort HSK word files by frequency rank so learners see the most common
 * words first. Words without a rank go to the end, alphabetically among
 * themselves.
 *
 * Usage: npx tsx scripts/sort-hsk-by-frequency.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(__dirname, "..", "prisma", "data", "hsk");

type WordEntry = {
  term: string;
  translation: string;
  phonetic: string;
  metadata: { frequencyRank?: number; [k: string]: unknown };
};

for (let level = 1; level <= 7; level++) {
  const path = join(DATA_DIR, `new${level}.json`);
  const words: WordEntry[] = JSON.parse(readFileSync(path, "utf-8"));

  const withRank = words.filter((w) => typeof w.metadata?.frequencyRank === "number");
  const withoutRank = words.filter((w) => typeof w.metadata?.frequencyRank !== "number");

  withRank.sort((a, b) => (a.metadata.frequencyRank as number) - (b.metadata.frequencyRank as number));
  withoutRank.sort((a, b) => a.term.localeCompare(b.term));

  const sorted = [...withRank, ...withoutRank];
  writeFileSync(path, JSON.stringify(sorted), "utf-8");

  console.log(
    `new${level}.json: ${sorted.length} words (${withRank.length} ranked, ${withoutRank.length} unranked)`
  );
}
