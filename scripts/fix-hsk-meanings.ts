/**
 * In-place content refresh for the seeded Chinese lists on an EXISTING
 * database. Reseeding would rename studied lists to "(legacy)" (and the next
 * seed run deletes those), losing progress — this script instead updates each
 * word's translation / phonetic / metadata in place, keyed by (list, term),
 * so UserProgress rows and schedules are untouched.
 *
 * Idempotent: re-running is a no-op once content matches. Usage:
 *   npx tsx scripts/fix-hsk-meanings.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type SeedWord = {
  term: string;
  translation: string;
  phonetic: string;
  metadata: unknown;
};

// Must mirror ZH_LISTS in prisma/seed.ts (file → seeded list name).
const LISTS: { file: string; name: string }[] = [
  { file: "new1", name: "HSK 1 — Foundation" },
  { file: "new2", name: "HSK 2 — Elementary" },
  { file: "new3", name: "HSK 3 — Intermediate" },
  { file: "new4", name: "HSK 4 — Upper Intermediate" },
  { file: "new5", name: "HSK 5 — Advanced" },
  { file: "new6", name: "HSK 6 — Proficient" },
  { file: "new7", name: "HSK 7–9 — Mastery" },
  { file: "freq100", name: "Top 100 Most Common Words" },
  { file: "freq1000", name: "Top 1000 Most Common Words" },
];

async function main() {
  let totalUpdated = 0;

  for (const { file, name } of LISTS) {
    const list = await prisma.wordList.findFirst({
      where: { name, createdById: null },
      select: { id: true },
    });
    if (!list) {
      console.log(`skip  ${name} (not seeded here)`);
      continue;
    }

    const seed = JSON.parse(
      readFileSync(join(__dirname, "..", "prisma", "data", "hsk", `${file}.json`), "utf8")
    ) as SeedWord[];
    const byTerm = new Map(seed.map((w) => [w.term, w]));

    const words = await prisma.word.findMany({
      where: { wordListId: list.id },
      select: { id: true, term: true, translation: true, phonetic: true, metadata: true },
    });

    let updated = 0;
    for (const w of words) {
      const fresh = byTerm.get(w.term);
      if (!fresh) continue;
      const same =
        w.translation === fresh.translation &&
        (w.phonetic ?? "") === fresh.phonetic &&
        JSON.stringify(w.metadata) === JSON.stringify(fresh.metadata);
      if (same) continue;
      await prisma.word.update({
        where: { id: w.id },
        data: {
          translation: fresh.translation,
          phonetic: fresh.phonetic,
          metadata: fresh.metadata as Prisma.InputJsonValue,
        },
      });
      updated++;
    }
    totalUpdated += updated;
    console.log(`${name}: ${updated}/${words.length} words refreshed`);
  }

  console.log(`Done — ${totalUpdated} words updated in place.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
