/**
 * Regenerate the vendored Chinese seed data in prisma/data/hsk/ from the
 * complete-hsk-vocabulary dataset (MIT, https://github.com/drkameleon/complete-hsk-vocabulary).
 *
 * Usage:
 *   1. Download the raw dataset (not committed to this repo):
 *      curl -L -o /tmp/complete.json \
 *        https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json
 *   2. npx tsx scripts/generate-hsk-data.ts /tmp/complete.json
 *
 * Outputs new1.json … new7.json (HSK 3.0 2021 levels; "new-N" tags in the
 * dataset) plus freq100.json / freq1000.json, each a compact JSON array of
 * { term, translation, phonetic, metadata } seed words with structured
 * senses in metadata.meanings. prisma/seed.ts detects content changes by
 * sampling word content, so regenerated data reaches existing installs
 * without a manual version bump.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildFrequencyList,
  buildLevel,
  type RawEntry,
} from "../src/lib/hskTransform";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npx tsx scripts/generate-hsk-data.ts <path-to-complete.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(inputPath, "utf8")) as RawEntry[];
const outDir = join(__dirname, "..", "prisma", "data", "hsk");

function write(file: string, words: unknown[]) {
  // Compact JSON, UTF-8 without BOM, matching the existing vendored files.
  writeFileSync(join(outDir, `${file}.json`), JSON.stringify(words), {
    encoding: "utf8",
  });
  console.log(`${file}.json: ${words.length} words`);
}

for (let level = 1; level <= 7; level++) {
  write(`new${level}`, buildLevel(data, level));
}
write("freq100", buildFrequencyList(data, 100));
write("freq1000", buildFrequencyList(data, 1000));
