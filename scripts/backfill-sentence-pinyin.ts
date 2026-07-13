/**
 * Backfill `Sentence.phonetic` (pinyin) on databases that were seeded before
 * readings existed. Idempotent: reads the committed sentence data and only
 * updates rows whose `phonetic` is still null, matching by `text`.
 *
 * Safe to run at container boot or by hand:
 *   npx tsx scripts/backfill-sentence-pinyin.ts
 *
 * No pinyin-pro dependency at runtime — the readings come from the vendored
 * prisma/data/hsk/sentences.json (filled by scripts/add-sentence-pinyin.ts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Sentence = { text: string; phonetic?: string };

async function main() {
  const file = join(__dirname, "..", "prisma", "data", "hsk", "sentences.json");
  const data = JSON.parse(readFileSync(file, "utf8")) as Sentence[];
  const byText = new Map(
    data.filter((s) => s.phonetic).map((s) => [s.text, s.phonetic as string])
  );

  // Only touch rows still missing a reading, so re-runs are no-ops.
  const missing = await prisma.sentence.findMany({
    where: { phonetic: null },
    select: { id: true, text: true },
  });

  let updated = 0;
  for (const row of missing) {
    const phonetic = byText.get(row.text);
    if (!phonetic) continue;
    await prisma.sentence.update({ where: { id: row.id }, data: { phonetic } });
    updated += 1;
  }

  console.log(
    `backfill-sentence-pinyin: ${updated} updated, ${missing.length - updated} left without a match`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
